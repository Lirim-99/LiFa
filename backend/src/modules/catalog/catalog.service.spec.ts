import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

type Row = {
  id: string;
  companyId: string;
  name: string;
  sku: string | null;
  description: string | null;
  type: string;
  isActive: boolean;
  incomeAccountId: string | null;
  expenseAccountId: string | null;
  defaultTaxRateId: string | null;
  createdAt: Date;
};

function makePrisma() {
  const rows: Row[] = [];
  const accounts: { id: string; companyId: string }[] = [];
  const taxRates: { id: string; companyId: string | null }[] = [];
  let n = 0;

  const matchWhere = (r: Row, where: Record<string, unknown> | undefined): boolean => {
    if (!where) return true;
    if (where.id !== undefined && r.id !== where.id) return false;
    if (where.companyId !== undefined && r.companyId !== where.companyId) return false;
    if (where.type !== undefined && r.type !== where.type) return false;
    if (where.isActive !== undefined && r.isActive !== where.isActive) return false;
    if (Array.isArray(where.OR)) {
      const ors = where.OR as { name?: { contains: string } }[];
      const term = (ors[0]?.name?.contains ?? "").toLowerCase();
      if (!r.name.toLowerCase().includes(term)) return false;
    }
    return true;
  };

  const prisma = {
    productService: {
      create: ({ data }: { data: Partial<Row> }) => {
        const row: Row = {
          id: `p-${++n}`,
          companyId: data.companyId ?? "",
          name: data.name ?? "",
          sku: data.sku ?? null,
          description: data.description ?? null,
          type: data.type ?? "PRODUCT",
          isActive: true,
          incomeAccountId: data.incomeAccountId ?? null,
          expenseAccountId: data.expenseAccountId ?? null,
          defaultTaxRateId: data.defaultTaxRateId ?? null,
          createdAt: new Date(2026, 0, n),
        };
        rows.push(row);
        return Promise.resolve(row);
      },
      findFirst: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(rows.find((r) => matchWhere(r, where)) ?? null),
      findMany: ({
        where,
        skip,
        take,
      }: {
        where: Record<string, unknown>;
        skip?: number;
        take?: number;
      }) => {
        const filtered = rows.filter((r) => matchWhere(r, where));
        return Promise.resolve(filtered.slice(skip ?? 0, (skip ?? 0) + (take ?? filtered.length)));
      },
      count: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(rows.filter((r) => matchWhere(r, where)).length),
      update: ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return Promise.resolve(row);
      },
    },
    account: {
      findFirst: ({ where }: { where: { id: string; companyId: string } }) =>
        Promise.resolve(
          accounts.find((a) => a.id === where.id && a.companyId === where.companyId) ?? null,
        ),
    },
    taxRate: {
      findFirst: ({ where }: { where: { id: string; OR: { companyId: string | null }[] } }) => {
        const allowed = where.OR.map((o) => o.companyId);
        return Promise.resolve(
          taxRates.find((t) => t.id === where.id && allowed.includes(t.companyId)) ?? null,
        );
      },
    },
  };

  return {
    prisma,
    rows,
    addAccount: (id: string, companyId: string) => accounts.push({ id, companyId }),
    addTaxRate: (id: string, companyId: string | null) => taxRates.push({ id, companyId }),
  };
}

function makeService() {
  const fake = makePrisma();
  return { service: new CatalogService(fake.prisma as never), ...fake };
}

describe("CatalogService", () => {
  const companyA = "co-a";
  const companyB = "co-b";
  const userId = "u-1";

  describe("create", () => {
    it("creates a product without optional references", async () => {
      const { service } = makeService();
      const p = await service.create(
        companyA,
        { name: "Widget", type: "PRODUCT" as never },
        userId,
      );
      expect(p.name).toBe("Widget");
      expect(p.companyId).toBe(companyA);
    });

    it("accepts a default_tax_rate_id from a system template (companyId = NULL)", async () => {
      const { service, addTaxRate } = makeService();
      addTaxRate("tr-std", null);
      const p = await service.create(
        companyA,
        { name: "Widget", type: "PRODUCT" as never, defaultTaxRateId: "tr-std" },
        userId,
      );
      expect(p.defaultTaxRateId).toBe("tr-std");
    });

    it("rejects an income_account_id from another company", async () => {
      const { service, addAccount } = makeService();
      addAccount("a-foreign", companyB);
      await expect(
        service.create(
          companyA,
          { name: "Widget", type: "PRODUCT" as never, incomeAccountId: "a-foreign" },
          userId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an unknown tax rate", async () => {
      const { service } = makeService();
      await expect(
        service.create(
          companyA,
          { name: "Widget", type: "PRODUCT" as never, defaultTaxRateId: "tr-ghost" },
          userId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("findById", () => {
    it("returns 404 for cross-company access", async () => {
      const { service } = makeService();
      const p = await service.create(companyA, { name: "X", type: "PRODUCT" as never }, userId);
      await expect(service.findById(companyB, p.id)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("excludes deactivated by default", async () => {
      const { service, rows } = makeService();
      await service.create(companyA, { name: "Active", type: "PRODUCT" as never }, userId);
      const inactive = await service.create(
        companyA,
        { name: "Inactive", type: "PRODUCT" as never },
        userId,
      );
      const row = rows.find((r) => r.id === inactive.id);
      if (row) row.isActive = false;
      const list = await service.findAll(companyA, {});
      expect(list.data).toHaveLength(1);
    });

    it("filters by type and isolates between companies", async () => {
      const { service } = makeService();
      await service.create(companyA, { name: "P1", type: "PRODUCT" as never }, userId);
      await service.create(companyA, { name: "S1", type: "SERVICE" as never }, userId);
      await service.create(companyB, { name: "P-other", type: "PRODUCT" as never }, userId);
      const products = await service.findAll(companyA, { type: "PRODUCT" as never });
      expect(products.data).toHaveLength(1);
      expect((products.data[0] as Row).name).toBe("P1");
    });
  });

  describe("update + deactivate", () => {
    it("updates fields", async () => {
      const { service } = makeService();
      const p = await service.create(companyA, { name: "Old", type: "PRODUCT" as never }, userId);
      const u = await service.update(companyA, p.id, { name: "New" });
      expect(u.name).toBe("New");
    });

    it("deactivates", async () => {
      const { service } = makeService();
      const p = await service.create(companyA, { name: "Bye", type: "PRODUCT" as never }, userId);
      const u = await service.deactivate(companyA, p.id);
      expect(u.isActive).toBe(false);
    });

    it("blocks cross-company updates", async () => {
      const { service } = makeService();
      const p = await service.create(companyA, { name: "X", type: "PRODUCT" as never }, userId);
      await expect(service.update(companyB, p.id, { name: "hijack" })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
