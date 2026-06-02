import { Logger } from "@nestjs/common";
import { AuditService } from "./audit.service";

type Row = {
  companyId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson: unknown;
  afterJson: unknown;
  occurredAt: Date;
};

function makePrisma() {
  const rows: Row[] = [];
  const prisma = {
    auditLog: {
      create: ({ data }: { data: Omit<Row, "occurredAt"> }) => {
        const row: Row = { ...data, occurredAt: new Date() };
        rows.push(row);
        return Promise.resolve(row);
      },
      findMany: ({ where, skip, take }: { where: Partial<Row>; skip?: number; take?: number }) => {
        const filtered = rows.filter((r) =>
          Object.entries(where).every(
            ([k, v]) => v === undefined || (r as Record<string, unknown>)[k] === v,
          ),
        );
        return Promise.resolve(filtered.slice(skip ?? 0, (skip ?? 0) + (take ?? filtered.length)));
      },
      count: ({ where }: { where: Partial<Row> }) =>
        Promise.resolve(
          rows.filter((r) =>
            Object.entries(where).every(
              ([k, v]) => v === undefined || (r as Record<string, unknown>)[k] === v,
            ),
          ).length,
        ),
    },
  };
  return { prisma, rows };
}

describe("AuditService", () => {
  const baseLog = {
    companyId: "co-1",
    userId: "u-1",
    entityType: "COMPANY",
    entityId: "co-1",
    action: "CREATED",
  };

  it("writes a row", async () => {
    const { prisma, rows } = makePrisma();
    const service = new AuditService(prisma as never);
    await service.log({ ...baseLog, after: { legalName: "Acme" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entityType: "COMPANY", action: "CREATED" });
  });

  it("swallows DB errors — audit failure must NOT break the calling flow", async () => {
    const prisma = {
      auditLog: { create: jest.fn().mockRejectedValue(new Error("db down")) },
    };
    const service = new AuditService(prisma as never);
    // Silence the expected error log during the test.
    const spy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    await expect(service.log(baseLog)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("uses the provided transaction client when one is passed", async () => {
    const txCreate = jest.fn().mockResolvedValue({});
    const tx = { auditLog: { create: txCreate } } as never;
    const { prisma, rows } = makePrisma();
    const service = new AuditService(prisma as never);
    await service.log(baseLog, tx);
    expect(txCreate).toHaveBeenCalled();
    expect(rows).toHaveLength(0); // not written to the default prisma client
  });

  it("findAll filters by entityType + action", async () => {
    const { prisma, rows } = makePrisma();
    const service = new AuditService(prisma as never);
    rows.push(
      { ...baseLog, beforeJson: null, afterJson: null, occurredAt: new Date() },
      {
        ...baseLog,
        entityType: "ACCOUNT",
        action: "UPDATED",
        beforeJson: null,
        afterJson: null,
        occurredAt: new Date(),
      },
    );
    const result = await service.findAll("co-1", { entityType: "ACCOUNT" });
    expect(result.total).toBe(1);
  });
});
