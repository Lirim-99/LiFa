import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { DocumentType, Prisma } from "@prisma/client";
import { paginatedResponse, type PaginatedResponse } from "../../common/dto/paginated-response.dto";
import { DocumentSequenceService } from "../../common/services/document-sequence.service";
import { DecimalUtil } from "../../common/utils/decimal.helper";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditAction, AuditEntityType, AuditService } from "../audit/audit.service";
import { CreateJournalEntryDto, CreateJournalEntryLineDto } from "./dto/create-journal-entry.dto";
import { JournalEntryFilterDto } from "./dto/journal-entry-filter.dto";
import { UpdateJournalEntryDto } from "./dto/update-journal-entry.dto";

const SOURCE_MANUAL = "MANUAL";

@Injectable()
export class JournalEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: DocumentSequenceService,
    private readonly audit: AuditService,
  ) {}

  // ===================================================================
  // Listing & lookup
  // ===================================================================

  async findAll(
    companyId: string,
    filters: JournalEntryFilterDto,
  ): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.sourceType) where.sourceDocumentType = filters.sourceType;
    if (filters.reversed === true) where.reversedByEntryId = { not: null };
    if (filters.reversed === false) where.reversedByEntryId = null;
    if (filters.from || filters.to) {
      where.entryDate = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const sortBy = filters.sortBy ?? "entryDate";
    const sortOrder = filters.sortOrder ?? "desc";
    const orderBy = { [sortBy]: sortOrder } as Prisma.JournalEntryOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findById(companyId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });
    if (!entry) throw new NotFoundException("Journal entry not found");
    return entry;
  }

  // ===================================================================
  // Create (DRAFT)
  // ===================================================================

  async create(companyId: string, dto: CreateJournalEntryDto, userId: string) {
    this.validateLineShape(dto.lines);
    await this.assertOwnedPostableAccounts(
      companyId,
      dto.lines.map((l) => l.accountId),
    );

    return this.prisma.journalEntry.create({
      data: {
        companyId,
        createdBy: userId,
        entryDate: dto.entryDate,
        sourceDocumentType: SOURCE_MANUAL,
        memo: dto.memo,
        status: "DRAFT",
        lines: {
          create: dto.lines.map((l, idx) => ({
            lineNumber: idx + 1,
            accountId: l.accountId,
            description: l.description,
            debitAmount: l.debitAmount,
            creditAmount: l.creditAmount,
            contactId: l.contactId,
          })),
        },
      },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });
  }

  // ===================================================================
  // Update (DRAFT only)
  // ===================================================================

  async update(companyId: string, id: string, dto: UpdateJournalEntryDto) {
    const current = await this.findById(companyId, id);
    if (current.status !== "DRAFT") {
      throw new BadRequestException("Only DRAFT journal entries can be edited");
    }
    if (current.sourceDocumentType !== SOURCE_MANUAL) {
      throw new BadRequestException("System-generated journal entries cannot be edited directly");
    }

    if (dto.lines) {
      this.validateLineShape(dto.lines);
      await this.assertOwnedPostableAccounts(
        companyId,
        dto.lines.map((l) => l.accountId),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: id } });
        await tx.journalEntryLine.createMany({
          data: dto.lines.map((l, idx) => ({
            journalEntryId: id,
            lineNumber: idx + 1,
            accountId: l.accountId,
            description: l.description,
            debitAmount: l.debitAmount,
            creditAmount: l.creditAmount,
            contactId: l.contactId,
          })),
        });
      }
      return tx.journalEntry.update({
        where: { id },
        data: { entryDate: dto.entryDate, memo: dto.memo },
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
      throw new BadRequestException("Only DRAFT journal entries can be deleted");
    }
    if (current.sourceDocumentType !== SOURCE_MANUAL) {
      throw new BadRequestException("System-generated journal entries cannot be deleted directly");
    }
    await this.prisma.journalEntry.delete({ where: { id } });
  }

  // ===================================================================
  // Post — transactional
  // ===================================================================

  async post(companyId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: { id, companyId },
        include: { lines: true },
      });
      if (!entry) throw new NotFoundException("Journal entry not found");
      if (entry.status !== "DRAFT") {
        throw new BadRequestException(`Cannot post entry in status ${entry.status}`);
      }

      // Balance.
      const debits = DecimalUtil.sum(entry.lines.map((l) => l.debitAmount));
      const credits = DecimalUtil.sum(entry.lines.map((l) => l.creditAmount));
      if (!DecimalUtil.isEqual(debits, credits)) {
        throw new BadRequestException(
          `Unbalanced entry: debits=${DecimalUtil.toString(debits)} credits=${DecimalUtil.toString(credits)}`,
        );
      }
      if (DecimalUtil.isZero(debits)) {
        throw new BadRequestException("Journal entry totals cannot be zero");
      }

      // Period.
      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: entry.entryDate },
          endDate: { gte: entry.entryDate },
          status: "OPEN",
        },
      });
      if (!period) {
        throw new BadRequestException(
          `No open accounting period contains entry date ${entry.entryDate.toISOString().slice(0, 10)}`,
        );
      }

      // Account postability check (in case an account got flipped after draft).
      const accountIds = [...new Set(entry.lines.map((l) => l.accountId))];
      const accounts = await tx.account.findMany({
        where: { id: { in: accountIds }, companyId },
      });
      if (accounts.length !== accountIds.length) {
        throw new BadRequestException("One or more accounts no longer exist in this company");
      }
      const nonPostable = accounts.filter((a) => !a.isPostable || !a.isActive);
      if (nonPostable.length > 0) {
        throw new BadRequestException(
          `Account(s) cannot accept postings: ${nonPostable.map((a) => a.code).join(", ")}`,
        );
      }

      const entryNumber = await this.docSeq.nextNumber(
        tx,
        companyId,
        DocumentType.JOURNAL_ENTRY,
        period.fiscalYear,
      );

      const posted = await tx.journalEntry.update({
        where: { id: entry.id },
        data: {
          status: "POSTED",
          entryNumber,
          periodId: period.id,
          postedAt: new Date(),
          postedBy: userId,
        },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });

      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: entry.id,
          action: AuditAction.POSTED,
          before: { status: "DRAFT" },
          after: { status: "POSTED", entryNumber },
        },
        tx,
      );

      return posted;
    });
  }

  // ===================================================================
  // Void — reversal entry, MANUAL only
  // ===================================================================

  async void(companyId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.journalEntry.findFirst({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });
      if (!original) throw new NotFoundException("Journal entry not found");
      if (original.status !== "POSTED") {
        throw new BadRequestException("Only POSTED entries can be voided");
      }
      if (original.sourceDocumentType !== SOURCE_MANUAL) {
        throw new BadRequestException(
          "Only MANUAL journal entries may be voided directly. " +
            "System-generated entries (INVOICE, PAYMENT) must be voided through their source document.",
        );
      }
      if (original.reversedByEntryId) {
        throw new ConflictException("Journal entry already reversed");
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
          sourceDocumentType: SOURCE_MANUAL,
          memo: `Reversal of ${original.entryNumber ?? original.id}`,
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

      await this.audit.log(
        {
          companyId,
          userId,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: original.id,
          action: AuditAction.VOIDED,
          after: { reversalEntryNumber: entryNumber },
        },
        tx,
      );

      return reversal;
    });
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  /**
   * Per-line rule: exactly one of {debit, credit} must be > 0 (not both, not
   * neither). Balance (sum debits == sum credits) is checked at post-time,
   * not here — drafts can be unbalanced during editing.
   */
  private validateLineShape(lines: CreateJournalEntryLineDto[]): void {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const hasDebit = DecimalUtil.isPositive(l.debitAmount);
      const hasCredit = DecimalUtil.isPositive(l.creditAmount);
      if (hasDebit && hasCredit) {
        throw new BadRequestException(
          `Line ${i + 1}: cannot have both debit and credit amounts > 0`,
        );
      }
      if (!hasDebit && !hasCredit) {
        throw new BadRequestException(
          `Line ${i + 1}: must have either a debit or a credit amount > 0`,
        );
      }
    }
  }

  /** Loose check at create/update time — full postability re-checked at post. */
  private async assertOwnedPostableAccounts(
    companyId: string,
    accountIds: string[],
  ): Promise<void> {
    const unique = [...new Set(accountIds)];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: unique }, companyId },
    });
    if (accounts.length !== unique.length) {
      throw new BadRequestException("One or more accounts not found in this company");
    }
    const bad = accounts.find((a) => !a.isPostable || !a.isActive);
    if (bad) {
      throw new BadRequestException(`Account ${bad.code} cannot accept postings`);
    }
    if (accounts.length === 0) {
      // Should be unreachable given the DTO min-array constraints — defensive.
      throw new InternalServerErrorException("No accounts to validate");
    }
  }
}
