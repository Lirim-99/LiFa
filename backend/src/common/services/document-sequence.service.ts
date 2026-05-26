import { Injectable } from "@nestjs/common";
import { DocumentType, Prisma } from "@prisma/client";

/**
 * Gap-free, per-company, per-fiscal-year document numbering.
 *
 * Concurrency model: PostgreSQL's UPDATE statement takes a row-level lock for
 * the duration of the enclosing transaction. Two concurrent `nextNumber` calls
 * on the same `(companyId, documentType, fiscalYear)` row serialize — the
 * second blocks until the first commits or rolls back, so increments are
 * never lost and numbers stay sequential.
 *
 * If the calling transaction rolls back AFTER calling `nextNumber`, the
 * increment rolls back with it — preserving gap-free numbering for committed
 * documents. This is why the call MUST be made inside the same transaction
 * that creates the document (invoice issue, journal post, etc.).
 *
 *   await this.prisma.$transaction(async (tx) => {
 *     const invoiceNumber = await this.docSeq.nextNumber(tx, companyId, 'INVOICE', 2026);
 *     // ...create invoice, journal entry, etc.
 *   });
 */
@Injectable()
export class DocumentSequenceService {
  /**
   * Reserve the next number for `(companyId, documentType, fiscalYear)`.
   * Must be called inside a Prisma `$transaction`.
   */
  async nextNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    documentType: DocumentType,
    fiscalYear: number,
  ): Promise<string> {
    // 1. Ensure a row exists (idempotent). The unique constraint on
    //    (companyId, documentType, fiscalYear) makes this safe under
    //    concurrent inserts — only one will win, the rest see the row.
    const defaultPrefix = this.defaultPrefix(documentType, fiscalYear);
    await tx.documentSequence.upsert({
      where: {
        companyId_documentType_fiscalYear: { companyId, documentType, fiscalYear },
      },
      create: { companyId, documentType, fiscalYear, prefix: defaultPrefix, lastNumber: 0 },
      update: {},
    });

    // 2. Atomic increment. The UPDATE takes a row-level lock that serializes
    //    concurrent callers, so consecutive numbers never collide.
    const row = await tx.documentSequence.update({
      where: {
        companyId_documentType_fiscalYear: { companyId, documentType, fiscalYear },
      },
      data: { lastNumber: { increment: 1 } },
    });

    return this.format(row.prefix, row.lastNumber);
  }

  /** Default prefix used when a sequence row is auto-created. Editable per company later. */
  private defaultPrefix(documentType: DocumentType, fiscalYear: number): string {
    switch (documentType) {
      case "INVOICE":
        return `INV-${fiscalYear}-`;
      case "JOURNAL_ENTRY":
        return `JE-${fiscalYear}-`;
    }
  }

  /** Zero-pads the counter to 5 digits, e.g. INV-2026-00001. */
  private format(prefix: string, n: number): string {
    return `${prefix}${String(n).padStart(5, "0")}`;
  }
}
