import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { AccountRole, DocumentType, type Prisma } from "@prisma/client";
import { paginatedResponse, type PaginatedResponse } from "../../common/dto/paginated-response.dto";
import { DocumentSequenceService } from "../../common/services/document-sequence.service";
import { DecimalUtil } from "../../common/utils/decimal.helper";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditAction, AuditEntityType, AuditService } from "../audit/audit.service";
import { CreateInvoiceDto, CreateInvoiceLineDto } from "./dto/create-invoice.dto";
import { InvoiceFilterDto } from "./dto/invoice-filter.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { InvoiceCalc, type LineCalcOutput } from "./invoice-calc.helper";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: DocumentSequenceService,
    private readonly audit: AuditService,
  ) {}

  // ===================================================================
  // Listing & lookup
  // ===================================================================

  async findAll(companyId: string, filters: InvoiceFilterDto): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.issuedFrom || filters.issuedTo) {
      where.issueDate = {
        ...(filters.issuedFrom ? { gte: filters.issuedFrom } : {}),
        ...(filters.issuedTo ? { lte: filters.issuedTo } : {}),
      };
    }

    const sortBy = filters.sortBy ?? "issueDate";
    const sortOrder = filters.sortOrder ?? "desc";
    const orderBy = { [sortBy]: sortOrder } as Prisma.InvoiceOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { contact: { select: { id: true, displayName: true } } },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findById(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        contact: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return invoice;
  }

  // ===================================================================
  // Create (DRAFT)
  // ===================================================================

  async create(companyId: string, dto: CreateInvoiceDto, userId: string) {
    await this.assertCustomer(companyId, dto.contactId);

    const computedLines = await this.resolveAndCalculate(companyId, dto.lines);
    const totals = InvoiceCalc.calculateInvoiceTotals(computedLines.map((c) => c.calc));

    const invoice = await this.prisma.invoice.create({
      data: {
        companyId,
        createdBy: userId,
        contactId: dto.contactId,
        issueDate: dto.issueDate,
        dueDate: dto.dueDate,
        currency: dto.currency ?? "EUR",
        subtotalAmount: totals.subtotalAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        balanceDue: totals.totalAmount,
        notes: dto.notes,
        status: "DRAFT",
        lines: {
          create: computedLines.map((c, idx) => ({
            lineNumber: idx + 1,
            productServiceId: c.input.productServiceId,
            description: c.input.description,
            quantity: c.input.quantity,
            unitPrice: c.input.unitPrice,
            discountType: c.input.discountType,
            discountValue: c.input.discountValue,
            taxRateId: c.input.taxRateId,
            incomeAccountId: c.input.incomeAccountId,
            netAmount: c.calc.netAmount,
            taxAmount: c.calc.taxAmount,
            totalAmount: c.calc.totalAmount,
          })),
        },
      },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });
    return invoice;
  }

  // ===================================================================
  // Update (DRAFT only)
  // ===================================================================

  async update(companyId: string, id: string, dto: UpdateInvoiceDto) {
    const current = await this.findById(companyId, id);
    if (current.status !== "DRAFT") {
      throw new BadRequestException("Only DRAFT invoices can be edited");
    }

    if (dto.contactId) {
      await this.assertCustomer(companyId, dto.contactId);
    }

    const lines = dto.lines ?? current.lines.map((l) => this.lineRowToDto(l));
    const computedLines = await this.resolveAndCalculate(companyId, lines);
    const totals = InvoiceCalc.calculateInvoiceTotals(computedLines.map((c) => c.calc));

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLine.createMany({
          data: computedLines.map((c, idx) => ({
            invoiceId: id,
            lineNumber: idx + 1,
            productServiceId: c.input.productServiceId,
            description: c.input.description,
            quantity: c.input.quantity,
            unitPrice: c.input.unitPrice,
            discountType: c.input.discountType,
            discountValue: c.input.discountValue,
            taxRateId: c.input.taxRateId,
            incomeAccountId: c.input.incomeAccountId,
            netAmount: c.calc.netAmount,
            taxAmount: c.calc.taxAmount,
            totalAmount: c.calc.totalAmount,
          })),
        });
      }
      return tx.invoice.update({
        where: { id },
        data: {
          contactId: dto.contactId,
          issueDate: dto.issueDate,
          dueDate: dto.dueDate,
          currency: dto.currency,
          notes: dto.notes,
          subtotalAmount: totals.subtotalAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          balanceDue: totals.totalAmount,
        },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });
    });
  }

  // ===================================================================
  // Delete (DRAFT only)
  // ===================================================================

  async delete(companyId: string, id: string) {
    const current = await this.findById(companyId, id);
    if (current.status !== "DRAFT") {
      throw new BadRequestException("Only DRAFT invoices can be deleted");
    }
    // Cascade on invoice_lines is configured in schema; just delete the parent.
    await this.prisma.invoice.delete({ where: { id } });
  }

  // ===================================================================
  // Issue — the transactional core flow
  // ===================================================================

  async issue(companyId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Load invoice with lines + tax rates.
      const invoice = await tx.invoice.findFirst({
        where: { id, companyId },
        include: {
          lines: { include: { taxRate: true }, orderBy: { lineNumber: "asc" } },
          contact: true,
        },
      });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (invoice.status !== "DRAFT") {
        throw new BadRequestException(`Cannot issue invoice in status ${invoice.status}`);
      }
      if (invoice.lines.length === 0) {
        throw new BadRequestException("Invoice has no lines");
      }
      if (!invoice.contact.isCustomer || !invoice.contact.isActive) {
        throw new BadRequestException("Invoice contact is not an active customer");
      }

      // 2. Recalculate defensively from primary sources (tax rates may have
      //    changed between draft creation and issue).
      const recalc = invoice.lines.map((l) => ({
        line: l,
        calc: InvoiceCalc.calculateLine({
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountType: l.discountType ?? undefined,
          discountValue: l.discountValue ?? undefined,
          taxRate: l.taxRate
            ? { rate: l.taxRate.rate, calculationType: l.taxRate.calculationType }
            : null,
        }),
      }));
      const totals = InvoiceCalc.calculateInvoiceTotals(recalc.map((r) => r.calc));

      // 3. Period.
      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: invoice.issueDate },
          endDate: { gte: invoice.issueDate },
          status: "OPEN",
        },
      });
      if (!period) {
        throw new BadRequestException(
          `No open accounting period contains issue date ${invoice.issueDate.toISOString().slice(0, 10)}`,
        );
      }

      // 4. Document numbers.
      const invoiceNumber = await this.docSeq.nextNumber(
        tx,
        companyId,
        DocumentType.INVOICE,
        period.fiscalYear,
      );

      // 5. Account defaults.
      const arAccountId = await this.lookupAccountDefault(
        tx,
        companyId,
        AccountRole.ACCOUNTS_RECEIVABLE,
      );
      const salesAccountId = await this.lookupAccountDefault(
        tx,
        companyId,
        AccountRole.SALES_REVENUE,
      );
      const vatAccountId = DecimalUtil.isPositive(totals.taxAmount)
        ? await this.lookupAccountDefault(tx, companyId, AccountRole.VAT_PAYABLE)
        : null;

      // 6. Journal entry header.
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          createdBy: userId,
          entryDate: invoice.issueDate,
          sourceDocumentType: "INVOICE",
          sourceDocumentId: invoice.id,
          memo: `Invoice ${invoiceNumber}`,
          status: "POSTED",
          postedAt: new Date(),
          postedBy: userId,
          periodId: period.id,
        },
      });
      const entryNumber = await this.docSeq.nextNumber(
        tx,
        companyId,
        DocumentType.JOURNAL_ENTRY,
        period.fiscalYear,
      );
      await tx.journalEntry.update({ where: { id: journalEntry.id }, data: { entryNumber } });

      // 7. Build journal entry lines.
      const journalLines: Prisma.JournalEntryLineCreateManyInput[] = [];
      let lineNo = 1;

      // DEBIT Accounts Receivable.
      journalLines.push({
        journalEntryId: journalEntry.id,
        lineNumber: lineNo++,
        accountId: arAccountId,
        description: `Invoice ${invoiceNumber}`,
        debitAmount: totals.totalAmount,
        creditAmount: 0,
        currency: invoice.currency,
        contactId: invoice.contactId,
      });

      // CREDIT per-line revenue (use line's incomeAccountId or default).
      for (const r of recalc) {
        journalLines.push({
          journalEntryId: journalEntry.id,
          lineNumber: lineNo++,
          accountId: r.line.incomeAccountId ?? salesAccountId,
          description: r.line.description ?? null,
          debitAmount: 0,
          creditAmount: r.calc.netAmount,
          currency: invoice.currency,
          contactId: invoice.contactId,
        });
      }

      // CREDIT VAT Payable (if any).
      if (vatAccountId) {
        journalLines.push({
          journalEntryId: journalEntry.id,
          lineNumber: lineNo++,
          accountId: vatAccountId,
          description: `VAT on ${invoiceNumber}`,
          debitAmount: 0,
          creditAmount: totals.taxAmount,
          currency: invoice.currency,
          contactId: invoice.contactId,
        });
      }

      await tx.journalEntryLine.createMany({ data: journalLines });

      // 8. Balance check. If this fires, we have a calculation bug.
      // `createMany` accepts DecimalJsLike too, which DecimalUtil doesn't know
      // about — stringify so every numeric variant flows through cleanly.
      const debits = DecimalUtil.sum(journalLines.map((l) => String(l.debitAmount ?? 0)));
      const credits = DecimalUtil.sum(journalLines.map((l) => String(l.creditAmount ?? 0)));
      if (!DecimalUtil.isEqual(debits, credits)) {
        throw new InternalServerErrorException(
          `Journal entry unbalanced (debits=${DecimalUtil.toString(debits)}, credits=${DecimalUtil.toString(credits)}) — invoice issue aborted`,
        );
      }

      // 9. Update invoice.
      const issued = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "ISSUED",
          invoiceNumber,
          postedJournalEntryId: journalEntry.id,
          subtotalAmount: totals.subtotalAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          balanceDue: totals.totalAmount,
        },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });

      // 10. Audit.
      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.INVOICE,
          entityId: invoice.id,
          action: AuditAction.ISSUED,
          before: { status: "DRAFT" },
          after: { status: "ISSUED", invoiceNumber, entryNumber },
        },
        tx,
      );

      return issued;
    });
  }

  // ===================================================================
  // Void — reversal entry
  // ===================================================================

  async void(companyId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id, companyId } });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (
        invoice.status !== "ISSUED" &&
        invoice.status !== "PARTIALLY_PAID" &&
        invoice.status !== "PAID"
      ) {
        throw new BadRequestException(`Cannot void invoice in status ${invoice.status}`);
      }
      // No payments allowed on a void.
      if (!DecimalUtil.isEqual(invoice.balanceDue, invoice.totalAmount)) {
        throw new ConflictException("Cannot void an invoice that has payments allocated");
      }
      if (!invoice.postedJournalEntryId) {
        throw new InternalServerErrorException("Issued invoice missing posted_journal_entry_id");
      }

      const original = await tx.journalEntry.findUnique({
        where: { id: invoice.postedJournalEntryId },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });
      if (!original) throw new InternalServerErrorException("Original journal entry missing");
      if (original.reversedByEntryId) {
        throw new ConflictException("Original journal entry already reversed");
      }

      // Reversal entry uses TODAY as the entry date — the void event itself.
      const today = new Date();
      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: today },
          endDate: { gte: today },
          status: "OPEN",
        },
      });
      if (!period) {
        throw new BadRequestException(
          "No open accounting period contains today's date — cannot post reversal",
        );
      }

      const reversal = await tx.journalEntry.create({
        data: {
          companyId,
          createdBy: userId,
          entryDate: today,
          sourceDocumentType: "INVOICE_VOID",
          sourceDocumentId: invoice.id,
          memo: `Void of invoice ${invoice.invoiceNumber ?? "(no number)"}`,
          status: "POSTED",
          postedAt: today,
          postedBy: userId,
          periodId: period.id,
          reversalOfEntryId: original.id,
        },
      });
      const entryNumber = await this.docSeq.nextNumber(
        tx,
        companyId,
        DocumentType.JOURNAL_ENTRY,
        period.fiscalYear,
      );
      await tx.journalEntry.update({ where: { id: reversal.id }, data: { entryNumber } });

      // Mirror lines, swapping debit ↔ credit.
      await tx.journalEntryLine.createMany({
        data: original.lines.map((l) => ({
          journalEntryId: reversal.id,
          lineNumber: l.lineNumber,
          accountId: l.accountId,
          description: l.description ? `Reversal: ${l.description}` : null,
          debitAmount: l.creditAmount,
          creditAmount: l.debitAmount,
          currency: l.currency,
          contactId: l.contactId,
        })),
      });

      // Bidirectional link.
      await tx.journalEntry.update({
        where: { id: original.id },
        data: { reversedByEntryId: reversal.id },
      });

      const voided = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "VOID", voidedJournalEntryId: reversal.id },
      });

      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.INVOICE,
          entityId: invoice.id,
          action: AuditAction.VOIDED,
          before: { status: invoice.status },
          after: { status: "VOID", reversalEntryNumber: entryNumber },
        },
        tx,
      );

      return voided;
    });
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private async assertCustomer(companyId: string, contactId: string): Promise<void> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId, isCustomer: true, isActive: true },
    });
    if (!contact) {
      throw new BadRequestException("Contact not found or is not an active customer");
    }
  }

  /**
   * Validates every line's FK references and computes net/tax/total. Returns
   * the parallel array of inputs + outputs so the caller can persist both.
   */
  private async resolveAndCalculate(
    companyId: string,
    lines: CreateInvoiceLineDto[],
  ): Promise<{ input: CreateInvoiceLineDto; calc: LineCalcOutput }[]> {
    const productIds = lines.map((l) => l.productServiceId).filter((x): x is string => !!x);
    const accountIds = lines.map((l) => l.incomeAccountId).filter((x): x is string => !!x);
    const taxRateIds = lines.map((l) => l.taxRateId).filter((x): x is string => !!x);

    const [products, accounts, taxRates] = await Promise.all([
      productIds.length
        ? this.prisma.productService.findMany({ where: { id: { in: productIds }, companyId } })
        : Promise.resolve([]),
      accountIds.length
        ? this.prisma.account.findMany({ where: { id: { in: accountIds }, companyId } })
        : Promise.resolve([]),
      taxRateIds.length
        ? this.prisma.taxRate.findMany({
            where: { id: { in: taxRateIds }, OR: [{ companyId }, { companyId: null }] },
          })
        : Promise.resolve([]),
    ]);

    const productSet = new Set(products.map((p) => p.id));
    const accountSet = new Set(accounts.map((a) => a.id));
    const taxRateMap = new Map(taxRates.map((t) => [t.id, t]));

    return lines.map((line) => {
      if (line.productServiceId && !productSet.has(line.productServiceId)) {
        throw new BadRequestException(`Unknown product/service ${line.productServiceId}`);
      }
      if (line.incomeAccountId && !accountSet.has(line.incomeAccountId)) {
        throw new BadRequestException(`Unknown income account ${line.incomeAccountId}`);
      }
      const taxRate = line.taxRateId ? taxRateMap.get(line.taxRateId) : null;
      if (line.taxRateId && !taxRate) {
        throw new BadRequestException(`Unknown tax rate ${line.taxRateId}`);
      }

      const calc = InvoiceCalc.calculateLine({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountType: line.discountType,
        discountValue: line.discountValue,
        taxRate: taxRate ? { rate: taxRate.rate, calculationType: taxRate.calculationType } : null,
      });
      return { input: line, calc };
    });
  }

  /** Tx-scoped variant of CompanyAccountDefaultsService.getAccountForRole. */
  private async lookupAccountDefault(
    tx: Prisma.TransactionClient,
    companyId: string,
    role: AccountRole,
  ): Promise<string> {
    const row = await tx.companyAccountDefaults.findUnique({
      where: { companyId_accountRole: { companyId, accountRole: role } },
    });
    if (!row) {
      throw new BadRequestException(
        `Company account default not configured for role ${role}. Set it in company settings.`,
      );
    }
    return row.accountId;
  }

  /** Converts a persisted line back into the create-DTO shape for the "keep existing lines" path of update. */
  private lineRowToDto(line: {
    productServiceId: string | null;
    description: string | null;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    discountType: Prisma.InvoiceLineCreateInput["discountType"] | null;
    discountValue: Prisma.Decimal | null;
    taxRateId: string | null;
    incomeAccountId: string | null;
  }): CreateInvoiceLineDto {
    return {
      productServiceId: line.productServiceId ?? undefined,
      description: line.description ?? undefined,
      quantity: Number(line.quantity.toString()),
      unitPrice: Number(line.unitPrice.toString()),
      discountType: (line.discountType as CreateInvoiceLineDto["discountType"]) ?? undefined,
      discountValue: line.discountValue ? Number(line.discountValue.toString()) : undefined,
      taxRateId: line.taxRateId ?? undefined,
      incomeAccountId: line.incomeAccountId ?? undefined,
    };
  }
}
