import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { AccountRole, CreditNoteType, DocumentType, type Prisma } from "@prisma/client";
import { paginatedResponse, type PaginatedResponse } from "../../common/dto/paginated-response.dto";
import { DocumentSequenceService } from "../../common/services/document-sequence.service";
import { DecimalUtil } from "../../common/utils/decimal.helper";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditAction, AuditEntityType, AuditService } from "../audit/audit.service";
import { FiscalizationService } from "../fiscalization/fiscalization.service";
import { InvoiceCalc, type LineCalcOutput } from "../sales/invoice-calc.helper";
import { CreateCreditNoteDto, CreateCreditNoteLineDto } from "./dto/create-credit-note.dto";
import { CreditNoteFilterDto } from "./dto/credit-note-filter.dto";
import { UpdateCreditNoteDto } from "./dto/update-credit-note.dto";

@Injectable()
export class CreditNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: DocumentSequenceService,
    private readonly audit: AuditService,
    private readonly fiscalization: FiscalizationService,
  ) {}

  // ===================================================================
  // Listing & lookup
  // ===================================================================

  async findAll(companyId: string, filters: CreditNoteFilterDto): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.CreditNoteWhereInput = { companyId };
    if (filters.type) where.type = filters.type;
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
    const orderBy = { [sortBy]: sortOrder } as Prisma.CreditNoteOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.prisma.creditNote.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { contact: { select: { id: true, displayName: true } } },
      }),
      this.prisma.creditNote.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findById(companyId: string, id: string) {
    const cn = await this.prisma.creditNote.findFirst({
      where: { id, companyId },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        contact: { select: { id: true, displayName: true, email: true } },
        originalInvoice: { select: { id: true, invoiceNumber: true } },
        originalBill: { select: { id: true, billNumber: true } },
      },
    });
    if (!cn) throw new NotFoundException("Credit note not found");
    return cn;
  }

  // ===================================================================
  // Create (DRAFT)
  // ===================================================================

  async create(companyId: string, dto: CreateCreditNoteDto, userId: string) {
    await this.assertContact(companyId, dto.contactId, dto.type);

    if (dto.type === "SALES" && dto.originalInvoiceId) {
      await this.assertOriginalInvoice(companyId, dto.originalInvoiceId, dto.contactId);
    }
    if (dto.type === "PURCHASE" && dto.originalBillId) {
      await this.assertOriginalBill(companyId, dto.originalBillId, dto.contactId);
    }

    const computedLines = await this.resolveAndCalculate(companyId, dto.lines);
    const totals = InvoiceCalc.calculateInvoiceTotals(computedLines.map((c) => c.calc));

    const creditNote = await this.prisma.creditNote.create({
      data: {
        companyId,
        createdBy: userId,
        type: dto.type,
        contactId: dto.contactId,
        issueDate: dto.issueDate,
        currency: dto.currency ?? "EUR",
        subtotalAmount: totals.subtotalAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        reason: dto.reason,
        originalInvoiceId: dto.type === "SALES" ? dto.originalInvoiceId : undefined,
        originalBillId: dto.type === "PURCHASE" ? dto.originalBillId : undefined,
        status: "DRAFT",
        lines: {
          create: computedLines.map((c, idx) => ({
            lineNumber: idx + 1,
            productServiceId: c.input.productServiceId ?? undefined,
            description: c.input.description ?? undefined,
            quantity: c.input.quantity,
            unitPrice: c.input.unitPrice,
            discountType: c.input.discountType ?? undefined,
            discountValue: c.input.discountValue ?? undefined,
            taxRateId: c.input.taxRateId ?? undefined,
            netAmount: c.calc.netAmount,
            taxAmount: c.calc.taxAmount,
            totalAmount: c.calc.totalAmount,
            accountId: c.input.accountId ?? undefined,
          })),
        },
      },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });

    return creditNote;
  }

  // ===================================================================
  // Update (DRAFT only)
  // ===================================================================

  async update(companyId: string, id: string, dto: UpdateCreditNoteDto) {
    const current = await this.findById(companyId, id);
    if (current.status !== "DRAFT") {
      throw new BadRequestException("Only DRAFT credit notes can be edited");
    }

    const updateData: Prisma.CreditNoteUpdateInput = {};
    if (dto.contactId) {
      await this.assertContact(companyId, dto.contactId, current.type);
      updateData.contact = { connect: { id: dto.contactId } };
    }
    if (dto.issueDate) updateData.issueDate = dto.issueDate;
    if (dto.reason !== undefined) updateData.reason = dto.reason;
    if (dto.originalInvoiceId !== undefined) {
      if (current.type === "SALES" && dto.originalInvoiceId) {
        await this.assertOriginalInvoice(companyId, dto.originalInvoiceId, dto.contactId ?? current.contactId);
      }
      updateData.originalInvoice = dto.originalInvoiceId
        ? { connect: { id: dto.originalInvoiceId } }
        : { disconnect: true };
    }
    if (dto.originalBillId !== undefined) {
      if (current.type === "PURCHASE" && dto.originalBillId) {
        await this.assertOriginalBill(companyId, dto.originalBillId, dto.contactId ?? current.contactId);
      }
      updateData.originalBill = dto.originalBillId
        ? { connect: { id: dto.originalBillId } }
        : { disconnect: true };
    }

    if (dto.lines) {
      const computedLines = await this.resolveAndCalculate(companyId, dto.lines);
      const totals = InvoiceCalc.calculateInvoiceTotals(computedLines.map((c) => c.calc));

      await this.prisma.creditNoteLine.deleteMany({ where: { creditNoteId: id } });

      updateData.subtotalAmount = totals.subtotalAmount;
      updateData.taxAmount = totals.taxAmount;
      updateData.totalAmount = totals.totalAmount;
      updateData.lines = {
        create: computedLines.map((c, idx) => ({
          lineNumber: idx + 1,
          productServiceId: c.input.productServiceId ?? undefined,
          description: c.input.description ?? undefined,
          quantity: c.input.quantity,
          unitPrice: c.input.unitPrice,
          discountType: c.input.discountType ?? undefined,
          discountValue: c.input.discountValue ?? undefined,
          taxRateId: c.input.taxRateId ?? undefined,
          netAmount: c.calc.netAmount,
          taxAmount: c.calc.taxAmount,
          totalAmount: c.calc.totalAmount,
          accountId: c.input.accountId ?? undefined,
        })),
      };
    }

    return this.prisma.creditNote.update({
      where: { id },
      data: updateData,
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });
  }

  // ===================================================================
  // Delete (DRAFT only)
  // ===================================================================

  async delete(companyId: string, id: string) {
    const current = await this.findById(companyId, id);
    if (current.status !== "DRAFT") {
      throw new BadRequestException("Only DRAFT credit notes can be deleted");
    }
    await this.prisma.creditNote.delete({ where: { id } });
  }

  // ===================================================================
  // Issue — transactional core flow
  // ===================================================================

  async issue(companyId: string, id: string, userId: string) {
    const issued = await this.prisma.$transaction(async (tx) => {
      const cn = await tx.creditNote.findFirst({
        where: { id, companyId },
        include: {
          lines: { include: { taxRate: true }, orderBy: { lineNumber: "asc" } },
          contact: true,
        },
      });
      if (!cn) throw new NotFoundException("Credit note not found");
      if (cn.status !== "DRAFT") {
        throw new BadRequestException(`Cannot issue credit note in status ${cn.status}`);
      }
      if (cn.lines.length === 0) {
        throw new BadRequestException("Credit note has no lines");
      }

      // Validate contact role
      if (cn.type === "SALES" && (!cn.contact.isCustomer || !cn.contact.isActive)) {
        throw new BadRequestException("Contact is not an active customer");
      }
      if (cn.type === "PURCHASE" && (!cn.contact.isVendor || !cn.contact.isActive)) {
        throw new BadRequestException("Contact is not an active vendor");
      }

      // Recalculate defensively
      const recalc = cn.lines.map((l) => ({
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

      // Find open period
      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: cn.issueDate },
          endDate: { gte: cn.issueDate },
          status: "OPEN",
        },
      });
      if (!period) {
        throw new BadRequestException(
          `No open accounting period contains date ${cn.issueDate.toISOString().slice(0, 10)}`,
        );
      }

      // Assign credit note number
      const cnNumber = await this.docSeq.nextNumber(
        tx,
        companyId,
        DocumentType.CREDIT_NOTE,
        period.fiscalYear,
      );

      // Build journal entry lines based on type
      const journalLines: Prisma.JournalEntryLineCreateManyInput[] = [];
      let lineNo = 1;

      if (cn.type === "SALES") {
        // Sales credit note reverses an invoice posting:
        // DEBIT Revenue (reduce revenue)
        // DEBIT VAT Payable (reduce VAT owed, if any)
        // CREDIT Accounts Receivable (reduce what customer owes)
        const arAccountId = await this.lookupAccountDefault(tx, companyId, AccountRole.ACCOUNTS_RECEIVABLE);
        const salesAccountId = await this.lookupAccountDefault(tx, companyId, AccountRole.SALES_REVENUE);
        const vatAccountId = DecimalUtil.isPositive(totals.taxAmount)
          ? await this.lookupAccountDefault(tx, companyId, AccountRole.VAT_PAYABLE)
          : null;

        // DEBIT per-line revenue
        for (const r of recalc) {
          journalLines.push({
            journalEntryId: "", // placeholder, set after JE creation
            lineNumber: lineNo++,
            accountId: r.line.accountId ?? salesAccountId,
            description: r.line.description ?? null,
            debitAmount: r.calc.netAmount,
            creditAmount: 0,
            currency: cn.currency,
            contactId: cn.contactId,
          });
        }

        // DEBIT VAT Payable
        if (vatAccountId) {
          journalLines.push({
            journalEntryId: "",
            lineNumber: lineNo++,
            accountId: vatAccountId,
            description: `VAT on ${cnNumber}`,
            debitAmount: totals.taxAmount,
            creditAmount: 0,
            currency: cn.currency,
            contactId: cn.contactId,
          });
        }

        // CREDIT Accounts Receivable
        journalLines.push({
          journalEntryId: "",
          lineNumber: lineNo++,
          accountId: arAccountId,
          description: `Credit note ${cnNumber}`,
          debitAmount: 0,
          creditAmount: totals.totalAmount,
          currency: cn.currency,
          contactId: cn.contactId,
        });
      } else {
        // Purchase credit note (vendor credit) reverses a bill posting:
        // DEBIT Accounts Payable (reduce what we owe vendor)
        // CREDIT Expense (reduce expenses)
        // CREDIT VAT Receivable (reduce input VAT, if any)
        const apAccountId = await this.lookupAccountDefault(tx, companyId, AccountRole.ACCOUNTS_PAYABLE);
        const expenseAccountId = await this.lookupAccountDefault(tx, companyId, AccountRole.EXPENSE);
        const vatRecAccountId = DecimalUtil.isPositive(totals.taxAmount)
          ? await this.lookupAccountDefault(tx, companyId, AccountRole.VAT_RECEIVABLE)
          : null;

        // DEBIT Accounts Payable
        journalLines.push({
          journalEntryId: "",
          lineNumber: lineNo++,
          accountId: apAccountId,
          description: `Credit note ${cnNumber}`,
          debitAmount: totals.totalAmount,
          creditAmount: 0,
          currency: cn.currency,
          contactId: cn.contactId,
        });

        // CREDIT per-line expense
        for (const r of recalc) {
          journalLines.push({
            journalEntryId: "",
            lineNumber: lineNo++,
            accountId: r.line.accountId ?? expenseAccountId,
            description: r.line.description ?? null,
            debitAmount: 0,
            creditAmount: r.calc.netAmount,
            currency: cn.currency,
            contactId: cn.contactId,
          });
        }

        // CREDIT VAT Receivable
        if (vatRecAccountId) {
          journalLines.push({
            journalEntryId: "",
            lineNumber: lineNo++,
            accountId: vatRecAccountId,
            description: `VAT on ${cnNumber}`,
            debitAmount: 0,
            creditAmount: totals.taxAmount,
            currency: cn.currency,
            contactId: cn.contactId,
          });
        }
      }

      // Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          createdBy: userId,
          entryDate: cn.issueDate,
          sourceDocumentType: "CREDIT_NOTE",
          sourceDocumentId: cn.id,
          memo: `Credit note ${cnNumber}`,
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

      // Set journalEntryId on all lines and create them
      const linesWithEntry = journalLines.map((l) => ({
        ...l,
        journalEntryId: journalEntry.id,
      }));
      await tx.journalEntryLine.createMany({ data: linesWithEntry });

      // Balance check
      const debits = DecimalUtil.sum(linesWithEntry.map((l) => Number(l.debitAmount ?? 0)));
      const credits = DecimalUtil.sum(linesWithEntry.map((l) => Number(l.creditAmount ?? 0)));
      if (!DecimalUtil.isEqual(debits, credits)) {
        throw new InternalServerErrorException(
          `Journal entry unbalanced (debits=${DecimalUtil.toString(debits)}, credits=${DecimalUtil.toString(credits)}) — credit note issue aborted`,
        );
      }

      // Update credit note
      const issued = await tx.creditNote.update({
        where: { id: cn.id },
        data: {
          status: "ISSUED",
          creditNoteNumber: cnNumber,
          postedJournalEntryId: journalEntry.id,
          subtotalAmount: totals.subtotalAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
        },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });

      // Audit
      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.CREDIT_NOTE,
          entityId: cn.id,
          action: AuditAction.ISSUED,
          before: { status: "DRAFT" },
          after: { status: "ISSUED", creditNoteNumber: cnNumber, entryNumber },
        },
        tx,
      );

      return issued;
    });

    await this.fiscalization.onCreditNoteIssued(companyId, issued.id);
    return issued;
  }

  // ===================================================================
  // Void — reversal-based
  // ===================================================================

  async void(companyId: string, id: string, userId: string) {
    const voided = await this.prisma.$transaction(async (tx) => {
      const cn = await tx.creditNote.findFirst({
        where: { id, companyId },
        include: { postedJournalEntry: { include: { lines: true } } },
      });
      if (!cn) throw new NotFoundException("Credit note not found");
      if (cn.status !== "ISSUED") {
        throw new BadRequestException(`Cannot void credit note in status ${cn.status}`);
      }
      if (!cn.postedJournalEntry) {
        throw new InternalServerErrorException("Credit note has no posted journal entry");
      }

      const originalEntry = cn.postedJournalEntry;

      // Find open period
      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: cn.issueDate },
          endDate: { gte: cn.issueDate },
          status: "OPEN",
        },
      });
      if (!period) {
        throw new BadRequestException("No open accounting period for reversal");
      }

      // Create reversal journal entry
      const reversalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          createdBy: userId,
          entryDate: cn.issueDate,
          sourceDocumentType: "CREDIT_NOTE_VOID",
          sourceDocumentId: cn.id,
          memo: `Void credit note ${cn.creditNoteNumber}`,
          status: "POSTED",
          postedAt: new Date(),
          postedBy: userId,
          periodId: period.id,
          reversalOfEntryId: originalEntry.id,
        },
      });
      const entryNumber = await this.docSeq.nextNumber(
        tx,
        companyId,
        DocumentType.JOURNAL_ENTRY,
        period.fiscalYear,
      );
      await tx.journalEntry.update({ where: { id: reversalEntry.id }, data: { entryNumber } });

      // Reversal lines: swap debits and credits
      const reversalLines = originalEntry.lines.map((l, idx) => ({
        journalEntryId: reversalEntry.id,
        lineNumber: idx + 1,
        accountId: l.accountId,
        description: l.description,
        debitAmount: l.creditAmount,
        creditAmount: l.debitAmount,
        currency: l.currency,
        contactId: l.contactId,
      }));
      await tx.journalEntryLine.createMany({ data: reversalLines });

      // Link original entry to reversal
      await tx.journalEntry.update({
        where: { id: originalEntry.id },
        data: { reversedByEntryId: reversalEntry.id },
      });

      // Update credit note
      const voided = await tx.creditNote.update({
        where: { id: cn.id },
        data: {
          status: "VOID",
          voidedJournalEntryId: reversalEntry.id,
        },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });

      // Audit
      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.CREDIT_NOTE,
          entityId: cn.id,
          action: AuditAction.VOIDED,
          before: { status: "ISSUED" },
          after: { status: "VOID" },
        },
        tx,
      );

      return voided;
    });

    await this.fiscalization.onCreditNoteVoided(companyId, id);
    return voided;
  }

  // ===================================================================
  // Private helpers
  // ===================================================================

  private async assertContact(companyId: string, contactId: string, type: CreditNoteType) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId, isActive: true },
    });
    if (!contact) throw new BadRequestException("Contact not found or inactive");
    if (type === "SALES" && !contact.isCustomer) {
      throw new BadRequestException("Contact must be a customer for sales credit notes");
    }
    if (type === "PURCHASE" && !contact.isVendor) {
      throw new BadRequestException("Contact must be a vendor for purchase credit notes");
    }
  }

  private async assertOriginalInvoice(companyId: string, invoiceId: string, contactId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });
    if (!invoice) throw new BadRequestException("Original invoice not found");
    if (invoice.contactId !== contactId) {
      throw new BadRequestException("Original invoice belongs to a different contact");
    }
  }

  private async assertOriginalBill(companyId: string, billId: string, contactId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, companyId },
    });
    if (!bill) throw new BadRequestException("Original bill not found");
    if (bill.contactId !== contactId) {
      throw new BadRequestException("Original bill belongs to a different contact");
    }
  }

  private async resolveAndCalculate(
    companyId: string,
    dtoLines: CreateCreditNoteLineDto[],
  ): Promise<{ input: CreateCreditNoteLineDto; calc: LineCalcOutput }[]> {
    const taxRateIds = [...new Set(dtoLines.filter((l) => l.taxRateId).map((l) => l.taxRateId!))];
    const taxRates = taxRateIds.length
      ? await this.prisma.taxRate.findMany({
          where: { id: { in: taxRateIds }, companyId },
        })
      : [];
    const taxMap = new Map(taxRates.map((t) => [t.id, t]));

    return dtoLines.map((input) => {
      const tr = input.taxRateId ? taxMap.get(input.taxRateId) : undefined;
      const calc = InvoiceCalc.calculateLine({
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        discountType: input.discountType,
        discountValue: input.discountValue,
        taxRate: tr ? { rate: tr.rate, calculationType: tr.calculationType } : null,
      });
      return { input, calc };
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
        `Company account default not configured for role ${role}. Set it in Settings → Account Defaults.`,
      );
    }
    return row.accountId;
  }
}
