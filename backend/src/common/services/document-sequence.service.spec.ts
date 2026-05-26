import { DocumentType, Prisma } from "@prisma/client";
import { DocumentSequenceService } from "./document-sequence.service";

/**
 * Unit tests use a hand-rolled in-memory transaction client. Integration
 * concurrency behaviour is exercised against a real Postgres in the e2e suite
 * (added in a later step alongside the sales module).
 */
type SeqRow = {
  id: string;
  companyId: string;
  documentType: DocumentType;
  fiscalYear: number;
  prefix: string;
  lastNumber: number;
};

function makeFakeTx(): {
  tx: Prisma.TransactionClient;
  rows: SeqRow[];
} {
  const rows: SeqRow[] = [];

  const find = (companyId: string, documentType: DocumentType, fiscalYear: number) =>
    rows.find(
      (r) =>
        r.companyId === companyId && r.documentType === documentType && r.fiscalYear === fiscalYear,
    );

  const documentSequence = {
    upsert: ({
      where,
      create,
    }: {
      where: {
        companyId_documentType_fiscalYear: {
          companyId: string;
          documentType: DocumentType;
          fiscalYear: number;
        };
      };
      create: {
        companyId: string;
        documentType: DocumentType;
        fiscalYear: number;
        prefix: string;
        lastNumber: number;
      };
    }): Promise<SeqRow> => {
      const key = where.companyId_documentType_fiscalYear;
      const existing = find(key.companyId, key.documentType, key.fiscalYear);
      if (existing) return Promise.resolve(existing);
      const row: SeqRow = { id: `seq-${rows.length + 1}`, ...create };
      rows.push(row);
      return Promise.resolve(row);
    },
    update: ({
      where,
      data,
    }: {
      where: {
        companyId_documentType_fiscalYear: {
          companyId: string;
          documentType: DocumentType;
          fiscalYear: number;
        };
      };
      data: { lastNumber: { increment: number } };
    }): Promise<SeqRow> => {
      const key = where.companyId_documentType_fiscalYear;
      const row = find(key.companyId, key.documentType, key.fiscalYear);
      if (!row) return Promise.reject(new Error("not found"));
      row.lastNumber += data.lastNumber.increment;
      return Promise.resolve(row);
    },
  };

  const tx = { documentSequence } as unknown as Prisma.TransactionClient;
  return { tx, rows };
}

describe("DocumentSequenceService", () => {
  const service = new DocumentSequenceService();
  const companyId = "00000000-0000-0000-0000-000000000001";

  it("first call in a new fiscal year creates the sequence and returns 00001", async () => {
    const { tx } = makeFakeTx();
    const n = await service.nextNumber(tx, companyId, "INVOICE", 2026);
    expect(n).toBe("INV-2026-00001");
  });

  it("subsequent calls produce strictly sequential numbers", async () => {
    const { tx } = makeFakeTx();
    const first = await service.nextNumber(tx, companyId, "INVOICE", 2026);
    const second = await service.nextNumber(tx, companyId, "INVOICE", 2026);
    const third = await service.nextNumber(tx, companyId, "INVOICE", 2026);
    expect(first).toBe("INV-2026-00001");
    expect(second).toBe("INV-2026-00002");
    expect(third).toBe("INV-2026-00003");
  });

  it("INVOICE and JOURNAL_ENTRY counters are independent", async () => {
    const { tx } = makeFakeTx();
    const i1 = await service.nextNumber(tx, companyId, "INVOICE", 2026);
    const j1 = await service.nextNumber(tx, companyId, "JOURNAL_ENTRY", 2026);
    const i2 = await service.nextNumber(tx, companyId, "INVOICE", 2026);
    expect(i1).toBe("INV-2026-00001");
    expect(j1).toBe("JE-2026-00001");
    expect(i2).toBe("INV-2026-00002");
  });

  it("different companies have independent counters", async () => {
    const { tx } = makeFakeTx();
    const other = "00000000-0000-0000-0000-000000000002";
    const a1 = await service.nextNumber(tx, companyId, "INVOICE", 2026);
    const b1 = await service.nextNumber(tx, other, "INVOICE", 2026);
    expect(a1).toBe("INV-2026-00001");
    expect(b1).toBe("INV-2026-00001");
  });

  it("different fiscal years reset the counter", async () => {
    const { tx } = makeFakeTx();
    const a = await service.nextNumber(tx, companyId, "INVOICE", 2026);
    const b = await service.nextNumber(tx, companyId, "INVOICE", 2027);
    expect(a).toBe("INV-2026-00001");
    expect(b).toBe("INV-2027-00001");
  });
});
