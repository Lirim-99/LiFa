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
import { InvoiceCalc, type LineCalcOutput } from "../sales/invoice-calc.helper";
import { CreateBillDto, CreateBillLineDto } from "./dto/create-bill.dto";
import { BillFilterDto } from "./dto/bill-filter.dto";
import { UpdateBillDto } from "./dto/update-bill.dto";

/**
 * Purchases / Accounts Payable. Mirrors the Sales (invoices) module: a vendor
 * bill is DRAFT → OPEN (posted) → PARTIALLY_PAID → PAID, or VOID (reversal).
 * Posting a bill DEBITs the expense/asset accounts + input VAT and CREDITs
 * Accounts Payable. Reuses the pure `InvoiceCalc` line math.
 */
@Injectable()
export class BillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: DocumentSequenceService,
    private readonly audit: AuditService,
  ) {}

  // ===================================================================
  // Listing & lookup
  // ===================================================================

  async findAll(companyId: string, filters: BillFilterDto): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.BillWhereInput = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.billedFrom || filters.billedTo) {
      where.billDate = {
        ...(filters.billedFrom ? { gte: filters.billedFrom } : {}),
        ...(filters.billedTo ? { lte: filters.billedTo } : {}),
      };
    }

    const sortBy = filters.sortBy ?? "billDate";
    const sortOrder = filters.sortOrder ?? "desc";
    const orderBy = { [sortBy]: sortOrder } as Prisma.BillOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.prisma.bill.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { contact: { select: { id: true, displayName: true } } },
      }),
      this.prisma.bill.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findById(companyId: string, id: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id, companyId },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        contact: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!bill) throw new NotFoundException("Bill not found");
    return bill;
  }

  // ===================================================================
  // Create (DRAFT)
  // ===================================================================

  async create(companyId: string, dto: CreateBillDto, userId: string) {
    await this.assertVendor(companyId, dto.contactId);

    const computedLines = await this.resolveAndCalculate(companyId, dto.lines);
    const totals = InvoiceCalc.calculateInvoiceTotals(computedLines.map((c) => c.calc));

    return this.prisma.bill.create({
      data: {
        companyId,
        createdBy: userId,
        contactId: dto.contactId,
        billNumber: dto.billNumber,
        billDate: dto.billDate,
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
            expenseAccountId: c.input.expenseAccountId,
            netAmount: c.calc.netAmount,
            taxAmount: c.calc.taxAmount,
            totalAmount: c.calc.totalAmount,
          })),
        },
      },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });
  }

  // ===================================================================
  // Update (DRAFT only)
  // ===================================================================

  async update(companyId: string, id: string, dto: UpdateBillDto) {
    const current = await this.findById(companyId, id);
    if (current.status !== "DRAFT") {
      throw new BadRequestException("Only DRAFT bills can be edited");
    }
    if (dto.contactId) {
      await this.assertVendor(companyId, dto.contactId);
    }

    const lines = dto.lines ?? current.lines.map((l) => this.lineRowToDto(l));
    const computedLines = await this.resolveAndCalculate(companyId, lines);
    const totals = InvoiceCalc.calculateInvoiceTotals(computedLines.map((c) => c.calc));

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.billLine.deleteMany({ where: { billId: id } });
        await tx.billLine.createMany({
          data: computedLines.map((c, idx) => ({
            billId: id,
            lineNumber: idx + 1,
            productServiceId: c.input.productServiceId,
            description: c.input.description,
            quantity: c.input.quantity,
            unitPrice: c.input.unitPrice,
            discountType: c.input.discountType,
            discountValue: c.input.discountValue,
            taxRateId: c.input.taxRateId,
            expenseAccountId: c.input.expenseAccountId,
            netAmount: c.calc.netAmount,
            taxAmount: c.calc.taxAmount,
            totalAmount: c.calc.totalAmount,
          })),
        });
      }
      return tx.bill.update({
        where: { id },
        data: {
          contactId: dto.contactId,
          billNumber: dto.billNumber,
          billDate: dto.billDate,
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
      throw new BadRequestException("Only DRAFT bills can be deleted");
    }
    await this.prisma.bill.delete({ where: { id } });
  }

  // ===================================================================
  // Post — DRAFT → OPEN, the transactional core flow
  // ===================================================================

  async post(companyId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({
        where: { id, companyId },
        include: {
          lines: { include: { taxRate: true }, orderBy: { lineNumber: "asc" } },
          contact: true,
        },
      });
      if (!bill) throw new NotFoundException("Bill not found");
      if (bill.status !== "DRAFT") {
        throw new BadRequestException(`Cannot post bill in status ${bill.status}`);
      }
      if (bill.lines.length === 0) {
        throw new BadRequestException("Bill has no lines");
      }
      if (!bill.contact.isVendor || !bill.contact.isActive) {
        throw new BadRequestException("Bill contact is not an active vendor");
      }

      // Recalculate defensively from primary sources.
      const recalc = bill.lines.map((l) => ({
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

      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: bill.billDate },
          endDate: { gte: bill.billDate },
          status: "OPEN",
        },
      });
      if (!period) {
        throw new BadRequestException(
          `No open accounting period contains bill date ${bill.billDate.toISOString().slice(0, 10)}`,
        );
      }

      // Account defaults.
      const apAccountId = await this.lookupAccountDefault(
        tx,
        companyId,
        AccountRole.ACCOUNTS_PAYABLE,
      );
      const defaultExpenseId = await this.lookupAccountDefault(tx, companyId, AccountRole.EXPENSE);
      const vatAccountId = DecimalUtil.isPositive(totals.taxAmount)
        ? await this.lookupAccountDefault(tx, companyId, AccountRole.VAT_RECEIVABLE)
        : null;

      // Journal entry header.
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          createdBy: userId,
          entryDate: bill.billDate,
          sourceDocumentType: "BILL",
          sourceDocumentId: bill.id,
          memo: `Bill ${bill.billNumber}`,
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

      const journalLines: Prisma.JournalEntryLineCreateManyInput[] = [];
      let lineNo = 1;

      // DEBIT per-line expense (line override or company default).
      for (const r of recalc) {
        journalLines.push({
          journalEntryId: journalEntry.id,
          lineNumber: lineNo++,
          accountId: r.line.expenseAccountId ?? defaultExpenseId,
          description: r.line.description ?? null,
          debitAmount: r.calc.netAmount,
          creditAmount: 0,
          currency: bill.currency,
          contactId: bill.contactId,
        });
      }

      // DEBIT input VAT (VAT Receivable).
      if (vatAccountId) {
        journalLines.push({
          journalEntryId: journalEntry.id,
          lineNumber: lineNo++,
          accountId: vatAccountId,
          description: `Input VAT on ${bill.billNumber}`,
          debitAmount: totals.taxAmount,
          creditAmount: 0,
          currency: bill.currency,
          contactId: bill.contactId,
        });
      }

      // CREDIT Accounts Payable (total).
      journalLines.push({
        journalEntryId: journalEntry.id,
        lineNumber: lineNo++,
        accountId: apAccountId,
        description: `Bill ${bill.billNumber}`,
        debitAmount: 0,
        creditAmount: totals.totalAmount,
        currency: bill.currency,
        contactId: bill.contactId,
      });

      await tx.journalEntryLine.createMany({ data: journalLines });

      const debits = DecimalUtil.sum(journalLines.map((l) => Number(l.debitAmount ?? 0)));
      const credits = DecimalUtil.sum(journalLines.map((l) => Number(l.creditAmount ?? 0)));
      if (!DecimalUtil.isEqual(debits, credits)) {
        throw new InternalServerErrorException(
          `Journal entry unbalanced (debits=${DecimalUtil.toString(debits)}, credits=${DecimalUtil.toString(credits)}) — bill post aborted`,
        );
      }

      const posted = await tx.bill.update({
        where: { id: bill.id },
        data: {
          status: "OPEN",
          postedJournalEntryId: journalEntry.id,
          subtotalAmount: totals.subtotalAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          balanceDue: totals.totalAmount,
        },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });

      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.BILL,
          entityId: bill.id,
          action: AuditAction.POSTED,
          before: { status: "DRAFT" },
          after: { status: "OPEN", entryNumber },
        },
        tx,
      );

      return posted;
    });
  }

  // ===================================================================
  // Void — reversal entry
  // ===================================================================

  async void(companyId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, companyId } });
      if (!bill) throw new NotFoundException("Bill not found");
      if (bill.status !== "OPEN" && bill.status !== "PARTIALLY_PAID" && bill.status !== "PAID") {
        throw new BadRequestException(`Cannot void bill in status ${bill.status}`);
      }
      if (!DecimalUtil.isEqual(bill.balanceDue, bill.totalAmount)) {
        throw new ConflictException("Cannot void a bill that has payments allocated");
      }
      if (!bill.postedJournalEntryId) {
        throw new InternalServerErrorException("Posted bill missing posted_journal_entry_id");
      }

      const original = await tx.journalEntry.findUnique({
        where: { id: bill.postedJournalEntryId },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });
      if (!original) throw new InternalServerErrorException("Original journal entry missing");
      if (original.reversedByEntryId) {
        throw new ConflictException("Original journal entry already reversed");
      }

      const today = new Date();
      const period = await tx.accountingPeriod.findFirst({
        where: { companyId, startDate: { lte: today }, endDate: { gte: today }, status: "OPEN" },
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
          sourceDocumentType: "BILL_VOID",
          sourceDocumentId: bill.id,
          memo: `Void of bill ${bill.billNumber}`,
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

      await tx.journalEntry.update({
        where: { id: original.id },
        data: { reversedByEntryId: reversal.id },
      });

      const voided = await tx.bill.update({
        where: { id: bill.id },
        data: { status: "VOID", voidedJournalEntryId: reversal.id },
      });

      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.BILL,
          entityId: bill.id,
          action: AuditAction.VOIDED,
          before: { status: bill.status },
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

  private async assertVendor(companyId: string, contactId: string): Promise<void> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId, isVendor: true, isActive: true },
    });
    if (!contact) {
      throw new BadRequestException("Contact not found or is not an active vendor");
    }
  }

  private async resolveAndCalculate(
    companyId: string,
    lines: CreateBillLineDto[],
  ): Promise<{ input: CreateBillLineDto; calc: LineCalcOutput }[]> {
    const productIds = lines.map((l) => l.productServiceId).filter((x): x is string => !!x);
    const accountIds = lines.map((l) => l.expenseAccountId).filter((x): x is string => !!x);
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
      if (line.expenseAccountId && !accountSet.has(line.expenseAccountId)) {
        throw new BadRequestException(`Unknown expense account ${line.expenseAccountId}`);
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

  private lineRowToDto(line: {
    productServiceId: string | null;
    description: string | null;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    discountType: Prisma.BillLineCreateInput["discountType"] | null;
    discountValue: Prisma.Decimal | null;
    taxRateId: string | null;
    expenseAccountId: string | null;
  }): CreateBillLineDto {
    return {
      productServiceId: line.productServiceId ?? undefined,
      description: line.description ?? undefined,
      quantity: Number(line.quantity.toString()),
      unitPrice: Number(line.unitPrice.toString()),
      discountType: (line.discountType as CreateBillLineDto["discountType"]) ?? undefined,
      discountValue: line.discountValue ? Number(line.discountValue.toString()) : undefined,
      taxRateId: line.taxRateId ?? undefined,
      expenseAccountId: line.expenseAccountId ?? undefined,
    };
  }
}
