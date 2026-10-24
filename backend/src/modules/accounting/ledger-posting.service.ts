import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { DocumentType, Prisma } from "@prisma/client";
import { DocumentSequenceService } from "../../common/services/document-sequence.service";
import { DecimalUtil, type Money } from "../../common/utils/decimal.helper";

export interface LedgerLine {
  accountId: string;
  debit?: Money;
  credit?: Money;
  description?: string | null;
  contactId?: string | null;
  currency?: string;
}

/**
 * Posts one balanced journal entry inside the caller's transaction.
 * Returns null when every line is zero (nothing to record).
 */
@Injectable()
export class LedgerPostingService {
  constructor(private readonly docSeq: DocumentSequenceService) {}

  async post(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      userId: string;
      entryDate: Date;
      sourceDocumentType: string;
      sourceDocumentId: string;
      memo: string;
      lines: LedgerLine[];
    },
  ): Promise<{ id: string; entryNumber: string } | null> {
    const lines = params.lines
      .map((line) => ({
        ...line,
        debit: DecimalUtil.round(line.debit ?? 0),
        credit: DecimalUtil.round(line.credit ?? 0),
      }))
      .filter((line) => !line.debit.isZero() || !line.credit.isZero());

    if (lines.length === 0) return null;

    const debits = DecimalUtil.sum(lines.map((line) => line.debit));
    const credits = DecimalUtil.sum(lines.map((line) => line.credit));
    if (!DecimalUtil.isEqual(debits, credits)) {
      throw new InternalServerErrorException(
        `Journal entry unbalanced (debits=${DecimalUtil.toString(debits)}, credits=${DecimalUtil.toString(credits)})`,
      );
    }

    const period = await tx.accountingPeriod.findFirst({
      where: {
        companyId: params.companyId,
        startDate: { lte: params.entryDate },
        endDate: { gte: params.entryDate },
        status: "OPEN",
      },
    });
    if (!period) {
      throw new BadRequestException(
        `No open accounting period contains ${params.entryDate.toISOString().slice(0, 10)}`,
      );
    }

    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: params.companyId,
        createdBy: params.userId,
        entryDate: params.entryDate,
        sourceDocumentType: params.sourceDocumentType,
        sourceDocumentId: params.sourceDocumentId,
        memo: params.memo,
        status: "POSTED",
        postedAt: new Date(),
        postedBy: params.userId,
        periodId: period.id,
      },
    });
    const entryNumber = await this.docSeq.nextNumber(
      tx,
      params.companyId,
      DocumentType.JOURNAL_ENTRY,
      period.fiscalYear,
    );
    await tx.journalEntry.update({ where: { id: journalEntry.id }, data: { entryNumber } });

    await tx.journalEntryLine.createMany({
      data: lines.map((line, index) => ({
        journalEntryId: journalEntry.id,
        lineNumber: index + 1,
        accountId: line.accountId,
        description: line.description ?? null,
        debitAmount: line.debit,
        creditAmount: line.credit,
        currency: line.currency ?? "EUR",
        contactId: line.contactId ?? null,
      })),
    });

    return { id: journalEntry.id, entryNumber };
  }
}
