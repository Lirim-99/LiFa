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
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentFilterDto } from "./dto/payment-filter.dto";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: DocumentSequenceService,
    private readonly audit: AuditService,
  ) {}

  // ===================================================================
  // Listing & lookup
  // ===================================================================

  async findAll(companyId: string, filters: PaymentFilterDto): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.paidFrom || filters.paidTo) {
      where.paymentDate = {
        ...(filters.paidFrom ? { gte: filters.paidFrom } : {}),
        ...(filters.paidTo ? { lte: filters.paidTo } : {}),
      };
    }

    const sortBy = filters.sortBy ?? "paymentDate";
    const sortOrder = filters.sortOrder ?? "desc";
    const orderBy = { [sortBy]: sortOrder } as Prisma.PaymentOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { contact: { select: { id: true, displayName: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findById(companyId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, companyId },
      include: {
        allocations: {
          include: {
            invoice: {
              select: { id: true, invoiceNumber: true, totalAmount: true, balanceDue: true },
            },
            bill: {
              select: { id: true, billNumber: true, totalAmount: true, balanceDue: true },
            },
          },
        },
        contact: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }

  // ===================================================================
  // Create — record payment with full allocation, post journal entry
  // ===================================================================

  async create(companyId: string, dto: CreatePaymentDto, userId: string) {
    // Allocation sum equality is the MVP rule (PRODUCT_BRIEF §2.9, D3).
    const allocSum = DecimalUtil.sum(dto.allocations.map((a) => a.allocatedAmount));
    if (!DecimalUtil.isEqual(allocSum, dto.totalAmount)) {
      throw new BadRequestException(
        "Payment must be fully allocated: allocations must sum to the payment total",
      );
    }

    if ((dto.paymentType ?? "RECEIVED") === "MADE") {
      return this.createBillPayment(companyId, dto, userId);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Validate contact = active customer of this company.
      const contact = await tx.contact.findFirst({
        where: { id: dto.contactId, companyId, isCustomer: true, isActive: true },
      });
      if (!contact) {
        throw new BadRequestException("Contact not found or is not an active customer");
      }

      // 2. Load + validate invoices.
      const invoiceIds = dto.allocations.map((a) => a.invoiceId).filter((x): x is string => !!x);
      if (invoiceIds.length !== dto.allocations.length) {
        throw new BadRequestException("Each allocation must reference an invoiceId");
      }
      const invoices = await tx.invoice.findMany({
        where: { id: { in: invoiceIds }, companyId },
      });
      if (invoices.length !== new Set(invoiceIds).size) {
        throw new BadRequestException("One or more invoices not found in this company");
      }
      for (const alloc of dto.allocations) {
        const invoice = invoices.find((i) => i.id === alloc.invoiceId);
        if (!invoice) {
          throw new BadRequestException(`Invoice ${alloc.invoiceId} not found`);
        }
        if (invoice.contactId !== dto.contactId) {
          throw new BadRequestException(
            `Invoice ${invoice.invoiceNumber ?? invoice.id} belongs to a different contact`,
          );
        }
        if (invoice.status !== "ISSUED" && invoice.status !== "PARTIALLY_PAID") {
          throw new BadRequestException(
            `Invoice ${invoice.invoiceNumber ?? invoice.id} cannot accept payment (status ${invoice.status})`,
          );
        }
        if (DecimalUtil.from(alloc.allocatedAmount).gt(invoice.balanceDue)) {
          throw new BadRequestException(
            `Allocation to invoice ${invoice.invoiceNumber ?? invoice.id} exceeds balance due`,
          );
        }
      }

      // 3. Find period for payment date.
      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: dto.paymentDate },
          endDate: { gte: dto.paymentDate },
          status: "OPEN",
        },
      });
      if (!period) {
        throw new BadRequestException(
          `No open accounting period contains payment date ${dto.paymentDate.toISOString().slice(0, 10)}`,
        );
      }

      // 4. Account defaults.
      const arAccountId = await this.lookupAccountDefault(
        tx,
        companyId,
        AccountRole.ACCOUNTS_RECEIVABLE,
      );
      const cashOrBankRole = dto.paymentMethod === "CASH" ? AccountRole.CASH : AccountRole.BANK;
      const receivingAccountId = await this.lookupAccountDefault(tx, companyId, cashOrBankRole);

      // 5. Create payment.
      const payment = await tx.payment.create({
        data: {
          companyId,
          createdBy: userId,
          contactId: dto.contactId,
          paymentType: "RECEIVED",
          paymentMethod: dto.paymentMethod,
          paymentDate: dto.paymentDate,
          totalAmount: dto.totalAmount,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          status: "RECORDED",
        },
      });

      // 6. Create allocations + update invoice balances.
      for (const alloc of dto.allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: alloc.invoiceId,
            allocatedAmount: alloc.allocatedAmount,
            allocationDate: dto.paymentDate,
            createdBy: userId,
          },
        });

        const invoice = invoices.find((i) => i.id === alloc.invoiceId);
        if (!invoice) throw new InternalServerErrorException("invoice lookup lost");
        const newPaid = DecimalUtil.add(invoice.paidAmount, alloc.allocatedAmount);
        const newBalance = DecimalUtil.subtract(invoice.totalAmount, newPaid);
        const newStatus = DecimalUtil.isZero(newBalance) ? "PAID" : "PARTIALLY_PAID";
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paidAmount: newPaid, balanceDue: newBalance, status: newStatus },
        });
      }

      // 7. Journal entry.
      const journal = await tx.journalEntry.create({
        data: {
          companyId,
          createdBy: userId,
          entryDate: dto.paymentDate,
          sourceDocumentType: "PAYMENT",
          sourceDocumentId: payment.id,
          memo: `Payment received from ${contact.displayName}`,
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
      await tx.journalEntry.update({ where: { id: journal.id }, data: { entryNumber } });

      // 8. Lines: DEBIT cash/bank, CREDIT AR.
      const lines: Prisma.JournalEntryLineCreateManyInput[] = [
        {
          journalEntryId: journal.id,
          lineNumber: 1,
          accountId: receivingAccountId,
          description: `Payment ${dto.referenceNumber ?? payment.id}`,
          debitAmount: dto.totalAmount,
          creditAmount: 0,
          contactId: dto.contactId,
        },
        {
          journalEntryId: journal.id,
          lineNumber: 2,
          accountId: arAccountId,
          description: `Payment ${dto.referenceNumber ?? payment.id}`,
          debitAmount: 0,
          creditAmount: dto.totalAmount,
          contactId: dto.contactId,
        },
      ];
      await tx.journalEntryLine.createMany({ data: lines });

      // 9. Update payment with journal link.
      await tx.payment.update({
        where: { id: payment.id },
        data: { postedJournalEntryId: journal.id },
      });

      // 10. Audit.
      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.PAYMENT,
          entityId: payment.id,
          action: AuditAction.CREATED,
          after: {
            totalAmount: dto.totalAmount,
            paymentMethod: dto.paymentMethod,
            allocations: dto.allocations.length,
            entryNumber,
          },
        },
        tx,
      );

      return tx.payment.findUnique({
        where: { id: payment.id },
        include: { allocations: true },
      });
    });
  }

  // ===================================================================
  // Void — soft-void allocations, restore balances, reverse journal
  // ===================================================================

  async void(companyId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id, companyId },
        include: { allocations: { where: { isVoided: false } } },
      });
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.status !== "RECORDED") {
        throw new BadRequestException(`Cannot void payment in status ${payment.status}`);
      }
      if (!payment.postedJournalEntryId) {
        throw new InternalServerErrorException("Recorded payment missing posted_journal_entry_id");
      }

      // 1. Reverse each active allocation: restore invoice/bill balances + soft-void.
      for (const alloc of payment.allocations) {
        if (alloc.invoiceId) {
          const invoice = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } });
          if (!invoice) {
            throw new InternalServerErrorException(`Invoice ${alloc.invoiceId} missing`);
          }
          const newPaid = DecimalUtil.subtract(invoice.paidAmount, alloc.allocatedAmount);
          const newBalance = DecimalUtil.add(invoice.balanceDue, alloc.allocatedAmount);
          let newStatus = invoice.status;
          if (invoice.status === "PAID" || invoice.status === "PARTIALLY_PAID") {
            newStatus = DecimalUtil.isZero(newPaid) ? "ISSUED" : "PARTIALLY_PAID";
          }
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { paidAmount: newPaid, balanceDue: newBalance, status: newStatus },
          });
        } else if (alloc.billId) {
          const bill = await tx.bill.findUnique({ where: { id: alloc.billId } });
          if (!bill) {
            throw new InternalServerErrorException(`Bill ${alloc.billId} missing`);
          }
          const newPaid = DecimalUtil.subtract(bill.paidAmount, alloc.allocatedAmount);
          const newBalance = DecimalUtil.add(bill.balanceDue, alloc.allocatedAmount);
          let newStatus = bill.status;
          if (bill.status === "PAID" || bill.status === "PARTIALLY_PAID") {
            newStatus = DecimalUtil.isZero(newPaid) ? "OPEN" : "PARTIALLY_PAID";
          }
          await tx.bill.update({
            where: { id: bill.id },
            data: { paidAmount: newPaid, balanceDue: newBalance, status: newStatus },
          });
        }
        await tx.paymentAllocation.update({
          where: { id: alloc.id },
          data: { isVoided: true, voidedAt: new Date() },
        });
      }

      // 2. Load original entry + create reversal.
      const original = await tx.journalEntry.findUnique({
        where: { id: payment.postedJournalEntryId },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });
      if (!original) throw new InternalServerErrorException("Original journal entry missing");
      if (original.reversedByEntryId) {
        throw new ConflictException("Payment journal entry already reversed");
      }

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
          sourceDocumentType: "PAYMENT_VOID",
          sourceDocumentId: payment.id,
          memo: `Void of payment ${payment.referenceNumber ?? payment.id}`,
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

      const voided = await tx.payment.update({
        where: { id: payment.id },
        data: { status: "VOID", voidedJournalEntryId: reversal.id },
      });

      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.PAYMENT,
          entityId: payment.id,
          action: AuditAction.VOIDED,
          after: {
            reversalEntryNumber: entryNumber,
            restoredAllocations: payment.allocations.length,
          },
        },
        tx,
      );

      return voided;
    });
  }

  // ===================================================================
  // MADE — we pay one or more vendor bills (DEBIT AP, CREDIT cash/bank)
  // ===================================================================

  private async createBillPayment(companyId: string, dto: CreatePaymentDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.findFirst({
        where: { id: dto.contactId, companyId, isVendor: true, isActive: true },
      });
      if (!contact) {
        throw new BadRequestException("Contact not found or is not an active vendor");
      }

      const billIds = dto.allocations.map((a) => a.billId).filter((x): x is string => !!x);
      if (billIds.length !== dto.allocations.length) {
        throw new BadRequestException("Each allocation must reference a billId");
      }
      const bills = await tx.bill.findMany({ where: { id: { in: billIds }, companyId } });
      if (bills.length !== new Set(billIds).size) {
        throw new BadRequestException("One or more bills not found in this company");
      }
      for (const alloc of dto.allocations) {
        const bill = bills.find((b) => b.id === alloc.billId);
        if (!bill) throw new BadRequestException(`Bill ${alloc.billId} not found`);
        if (bill.contactId !== dto.contactId) {
          throw new BadRequestException(`Bill ${bill.billNumber} belongs to a different vendor`);
        }
        if (bill.status !== "OPEN" && bill.status !== "PARTIALLY_PAID") {
          throw new BadRequestException(
            `Bill ${bill.billNumber} cannot accept payment (status ${bill.status})`,
          );
        }
        if (DecimalUtil.from(alloc.allocatedAmount).gt(bill.balanceDue)) {
          throw new BadRequestException(
            `Allocation to bill ${bill.billNumber} exceeds balance due`,
          );
        }
      }

      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: dto.paymentDate },
          endDate: { gte: dto.paymentDate },
          status: "OPEN",
        },
      });
      if (!period) {
        throw new BadRequestException(
          `No open accounting period contains payment date ${dto.paymentDate.toISOString().slice(0, 10)}`,
        );
      }

      const apAccountId = await this.lookupAccountDefault(
        tx,
        companyId,
        AccountRole.ACCOUNTS_PAYABLE,
      );
      const payingRole = dto.paymentMethod === "CASH" ? AccountRole.CASH : AccountRole.BANK;
      const payingAccountId = await this.lookupAccountDefault(tx, companyId, payingRole);

      const payment = await tx.payment.create({
        data: {
          companyId,
          createdBy: userId,
          contactId: dto.contactId,
          paymentType: "MADE",
          paymentMethod: dto.paymentMethod,
          paymentDate: dto.paymentDate,
          totalAmount: dto.totalAmount,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          status: "RECORDED",
        },
      });

      for (const alloc of dto.allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            billId: alloc.billId,
            allocatedAmount: alloc.allocatedAmount,
            allocationDate: dto.paymentDate,
            createdBy: userId,
          },
        });
        const bill = bills.find((b) => b.id === alloc.billId);
        if (!bill) throw new InternalServerErrorException("bill lookup lost");
        const newPaid = DecimalUtil.add(bill.paidAmount, alloc.allocatedAmount);
        const newBalance = DecimalUtil.subtract(bill.totalAmount, newPaid);
        const newStatus = DecimalUtil.isZero(newBalance) ? "PAID" : "PARTIALLY_PAID";
        await tx.bill.update({
          where: { id: bill.id },
          data: { paidAmount: newPaid, balanceDue: newBalance, status: newStatus },
        });
      }

      const journal = await tx.journalEntry.create({
        data: {
          companyId,
          createdBy: userId,
          entryDate: dto.paymentDate,
          sourceDocumentType: "PAYMENT",
          sourceDocumentId: payment.id,
          memo: `Payment to ${contact.displayName}`,
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
      await tx.journalEntry.update({ where: { id: journal.id }, data: { entryNumber } });

      // DEBIT Accounts Payable, CREDIT cash/bank.
      const lines: Prisma.JournalEntryLineCreateManyInput[] = [
        {
          journalEntryId: journal.id,
          lineNumber: 1,
          accountId: apAccountId,
          description: `Payment ${dto.referenceNumber ?? payment.id}`,
          debitAmount: dto.totalAmount,
          creditAmount: 0,
          contactId: dto.contactId,
        },
        {
          journalEntryId: journal.id,
          lineNumber: 2,
          accountId: payingAccountId,
          description: `Payment ${dto.referenceNumber ?? payment.id}`,
          debitAmount: 0,
          creditAmount: dto.totalAmount,
          contactId: dto.contactId,
        },
      ];
      await tx.journalEntryLine.createMany({ data: lines });

      await tx.payment.update({
        where: { id: payment.id },
        data: { postedJournalEntryId: journal.id },
      });

      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.PAYMENT,
          entityId: payment.id,
          action: AuditAction.CREATED,
          after: {
            paymentType: "MADE",
            totalAmount: dto.totalAmount,
            paymentMethod: dto.paymentMethod,
            allocations: dto.allocations.length,
            entryNumber,
          },
        },
        tx,
      );

      return tx.payment.findUnique({ where: { id: payment.id }, include: { allocations: true } });
    });
  }

  // ===================================================================
  // Helpers
  // ===================================================================

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
}
