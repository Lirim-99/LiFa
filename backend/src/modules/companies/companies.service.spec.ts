/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// ^ The Prisma fake's $transaction has a self-referential `typeof prisma`
//   which TypeScript widens to `any`. Acceptable for a test fixture.
import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { CompaniesService } from "./companies.service";

/**
 * Unit tests with an in-memory Prisma fake. Concurrency, real upsert
 * behaviour, and DB-level constraints are covered by e2e tests against a
 * test database (added in a later step).
 */
type AccessRow = { userId: string; companyId: string; roleId: string; isDefault: boolean };
type CompanyRow = { id: string; legalName: string; createdBy: string } & Record<string, unknown>;
type SeqRow = { companyId: string; documentType: string; fiscalYear: number; prefix: string };

function makeFakePrisma(opts: { ownerRoleExists?: boolean } = {}) {
  const ownerRoleExists = opts.ownerRoleExists !== false;
  const companies: CompanyRow[] = [];
  const access: AccessRow[] = [];
  const sequences: SeqRow[] = [];
  let companyCounter = 0;

  const prisma = {
    role: {
      findUnique: ({ where }: { where: { code: string } }) =>
        Promise.resolve(
          ownerRoleExists && where.code === "owner"
            ? { id: "role-owner", code: "owner", name: "Owner" }
            : null,
        ),
    },
    userCompanyAccess: {
      count: ({ where }: { where: { userId: string } }) =>
        Promise.resolve(access.filter((a) => a.userId === where.userId).length),
      create: ({ data }: { data: AccessRow }) => {
        access.push(data);
        return Promise.resolve(data);
      },
      findUnique: ({
        where,
        include,
      }: {
        where: { userId_companyId: { userId: string; companyId: string } };
        include?: { role: boolean };
      }) => {
        const row = access.find(
          (a) =>
            a.userId === where.userId_companyId.userId &&
            a.companyId === where.userId_companyId.companyId,
        );
        if (!row) return Promise.resolve(null);
        return Promise.resolve(include?.role ? { ...row, role: { code: "owner" } } : row);
      },
      findMany: ({ where }: { where: { userId: string } }) => {
        const rows = access
          .filter((a) => a.userId === where.userId)
          .map((a) => {
            const company = companies.find((c) => c.id === a.companyId);
            return {
              ...a,
              createdAt: new Date(),
              company: company
                ? { id: company.id, legalName: company.legalName, tradeName: null }
                : { id: a.companyId, legalName: "?", tradeName: null },
              role: { code: "owner" },
            };
          });
        return Promise.resolve(rows);
      },
    },
    company: {
      create: ({ data }: { data: Omit<CompanyRow, "id"> }) => {
        const row: CompanyRow = { id: `c-${++companyCounter}`, ...data };
        companies.push(row);
        return Promise.resolve(row);
      },
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(companies.find((c) => c.id === where.id) ?? null),
      update: ({ where, data }: { where: { id: string }; data: Partial<CompanyRow> }) => {
        const row = companies.find((c) => c.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return Promise.resolve(row);
      },
    },
    documentSequence: {
      createMany: ({ data }: { data: SeqRow[] }) => {
        sequences.push(...data);
        return Promise.resolve({ count: data.length });
      },
    },
    $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> => fn(prisma),
  };

  return { prisma, companies, access, sequences };
}

function makeService(opts: Parameters<typeof makeFakePrisma>[0] = {}) {
  const fake = makeFakePrisma(opts);
  // CompanySetupService stubbed — verified in company-setup.service.spec.ts.
  // AuditService stubbed — verified in audit.service.spec.ts.
  const setup = { seedDefaults: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new CompaniesService(fake.prisma as never, setup as never, audit as never);
  return { service, setup, audit, ...fake };
}

describe("CompaniesService", () => {
  const userA = "user-a";
  const userB = "user-b";

  describe("create", () => {
    it("creates company + owner access + document sequences in one transaction", async () => {
      const { service, companies, access, sequences } = makeService();
      const company = await service.create(
        { legalName: "Acme SHPK", legalForm: "SHPK" as never },
        userA,
      );

      expect(companies).toHaveLength(1);
      expect(company.legalName).toBe("Acme SHPK");

      expect(access).toHaveLength(1);
      expect(access[0]).toMatchObject({ userId: userA, companyId: company.id, isDefault: true });

      expect(sequences).toHaveLength(2);
      expect(sequences.map((s) => s.documentType).sort()).toEqual(["INVOICE", "JOURNAL_ENTRY"]);
      expect(sequences.every((s) => s.companyId === company.id)).toBe(true);
    });

    it("marks the first company as default, subsequent as non-default", async () => {
      const { service, access } = makeService();
      const first = await service.create({ legalName: "First", legalForm: "SHPK" as never }, userA);
      const second = await service.create({ legalName: "Second", legalForm: "BI" as never }, userA);

      const firstAccess = access.find((a) => a.companyId === first.id);
      const secondAccess = access.find((a) => a.companyId === second.id);
      expect(firstAccess?.isDefault).toBe(true);
      expect(secondAccess?.isDefault).toBe(false);
    });

    it("throws if the owner role hasn't been seeded", async () => {
      const { service } = makeService({ ownerRoleExists: false });
      await expect(
        service.create({ legalName: "X", legalForm: "SHPK" as never }, userA),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe("findById", () => {
    it("returns the company when the user has access", async () => {
      const { service } = makeService();
      const created = await service.create(
        { legalName: "Acme", legalForm: "SHPK" as never },
        userA,
      );
      const fetched = await service.findById(created.id, userA);
      expect(fetched.id).toBe(created.id);
    });

    it("returns 404 (not 403) when the user lacks access — no existence leak", async () => {
      const { service } = makeService();
      const created = await service.create(
        { legalName: "Acme", legalForm: "SHPK" as never },
        userA,
      );
      await expect(service.findById(created.id, userB)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("findByUser", () => {
    it("returns only the user's companies", async () => {
      const { service } = makeService();
      await service.create({ legalName: "Acme", legalForm: "SHPK" as never }, userA);
      await service.create({ legalName: "Beta", legalForm: "BI" as never }, userB);
      const list = await service.findByUser(userA);
      expect(list).toHaveLength(1);
      expect(list[0].legalName).toBe("Acme");
    });
  });

  describe("update", () => {
    it("updates fields the user has access to", async () => {
      const { service, companies } = makeService();
      const created = await service.create({ legalName: "Old", legalForm: "SHPK" as never }, userA);
      await service.update(created.id, { legalName: "New" }, userA);
      const reloaded = companies.find((c) => c.id === created.id);
      expect(reloaded?.legalName).toBe("New");
    });

    it("rejects updates from users without access", async () => {
      const { service } = makeService();
      const created = await service.create(
        { legalName: "Acme", legalForm: "SHPK" as never },
        userA,
      );
      await expect(
        service.update(created.id, { legalName: "Hijack" }, userB),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("assertRole", () => {
    it("allows when role is in the allow-list", async () => {
      const { service } = makeService();
      const created = await service.create({ legalName: "X", legalForm: "SHPK" as never }, userA);
      await expect(service.assertRole(created.id, userA, ["owner"])).resolves.toBeUndefined();
    });

    it("forbids when role is not in the allow-list", async () => {
      const { service } = makeService();
      const created = await service.create({ legalName: "X", legalForm: "SHPK" as never }, userA);
      await expect(service.assertRole(created.id, userA, ["admin"])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
