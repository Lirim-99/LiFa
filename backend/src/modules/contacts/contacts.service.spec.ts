import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ContactsService } from "./contacts.service";

type Row = {
  id: string;
  companyId: string;
  displayName: string;
  legalName: string | null;
  email: string | null;
  isCustomer: boolean;
  isVendor: boolean;
  isActive: boolean;
  createdAt: Date;
};

function makePrisma() {
  const rows: Row[] = [];
  let n = 0;

  const matchWhere = (r: Row, where: Record<string, unknown> | undefined): boolean => {
    if (!where) return true;
    if (where.id !== undefined && r.id !== where.id) return false;
    if (where.companyId !== undefined && r.companyId !== where.companyId) return false;
    if (where.isCustomer !== undefined && r.isCustomer !== where.isCustomer) return false;
    if (where.isVendor !== undefined && r.isVendor !== where.isVendor) return false;
    if (where.isActive !== undefined && r.isActive !== where.isActive) return false;
    if (Array.isArray(where.OR)) {
      const ors = where.OR as { displayName?: { contains: string; mode: string } }[];
      const term = ors[0]?.displayName?.contains?.toLowerCase() ?? "";
      const hit =
        r.displayName.toLowerCase().includes(term) ||
        (r.legalName?.toLowerCase().includes(term) ?? false) ||
        (r.email?.toLowerCase().includes(term) ?? false);
      if (!hit) return false;
    }
    return true;
  };

  const prisma = {
    contact: {
      create: ({ data }: { data: Partial<Row> }) => {
        const row: Row = {
          id: `c-${++n}`,
          companyId: data.companyId ?? "",
          displayName: data.displayName ?? "",
          legalName: data.legalName ?? null,
          email: data.email ?? null,
          isCustomer: data.isCustomer ?? false,
          isVendor: data.isVendor ?? false,
          isActive: data.isActive ?? true,
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
        const sliced = filtered.slice(skip ?? 0, (skip ?? 0) + (take ?? filtered.length));
        return Promise.resolve(sliced);
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
  };

  return { prisma, rows };
}

function makeService() {
  const fake = makePrisma();
  return { service: new ContactsService(fake.prisma as never), ...fake };
}

describe("ContactsService", () => {
  const companyA = "co-a";
  const companyB = "co-b";
  const userId = "user-1";

  describe("create", () => {
    it("creates a customer", async () => {
      const { service, rows } = makeService();
      const row = await service.create(
        companyA,
        { displayName: "Alpha", isCustomer: true },
        userId,
      );
      expect(row.isCustomer).toBe(true);
      expect(row.isVendor).toBe(false);
      expect(rows[0].companyId).toBe(companyA);
    });

    it("creates a contact with both flags", async () => {
      const { service } = makeService();
      const row = await service.create(
        companyA,
        { displayName: "Beta", isCustomer: true, isVendor: true },
        userId,
      );
      expect(row.isCustomer && row.isVendor).toBe(true);
    });

    // Note: rejection of "neither flag true" is enforced at DTO validation
    // (class-validator @AtLeastOneTrue), not the service. The DB CHECK is the
    // backstop. Both layers are exercised in the e2e tests.
  });

  describe("findById", () => {
    it("returns the contact for its company", async () => {
      const { service } = makeService();
      const created = await service.create(
        companyA,
        { displayName: "Alpha", isCustomer: true },
        userId,
      );
      const found = await service.findById(companyA, created.id);
      expect(found.id).toBe(created.id);
    });

    it("returns 404 across companies (no leak)", async () => {
      const { service } = makeService();
      const created = await service.create(
        companyA,
        { displayName: "Alpha", isCustomer: true },
        userId,
      );
      await expect(service.findById(companyB, created.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("findAll", () => {
    it("excludes deactivated contacts by default", async () => {
      const { service, rows } = makeService();
      await service.create(companyA, { displayName: "Active", isCustomer: true }, userId);
      const inactive = await service.create(
        companyA,
        { displayName: "Inactive", isCustomer: true },
        userId,
      );
      const inactiveRow = rows.find((r) => r.id === inactive.id);
      if (inactiveRow) inactiveRow.isActive = false;

      const list = await service.findAll(companyA, {});
      expect(list.data).toHaveLength(1);
      expect((list.data[0] as Row).displayName).toBe("Active");
    });

    it("filters by customer/vendor flag", async () => {
      const { service } = makeService();
      await service.create(companyA, { displayName: "Cust", isCustomer: true }, userId);
      await service.create(companyA, { displayName: "Vend", isVendor: true }, userId);
      const customers = await service.findAll(companyA, { isCustomer: true });
      expect(customers.data).toHaveLength(1);
      expect((customers.data[0] as Row).displayName).toBe("Cust");
    });

    it("paginates correctly", async () => {
      const { service } = makeService();
      for (let i = 0; i < 30; i++) {
        await service.create(companyA, { displayName: `c${i}`, isCustomer: true }, userId);
      }
      const p1 = await service.findAll(companyA, { page: 1, limit: 10 });
      const p3 = await service.findAll(companyA, { page: 3, limit: 10 });
      expect(p1.data).toHaveLength(10);
      expect(p3.data).toHaveLength(10);
      expect(p1.total).toBe(30);
      expect(p1.totalPages).toBe(3);
    });

    it("isolates between companies", async () => {
      const { service } = makeService();
      await service.create(companyA, { displayName: "A1", isCustomer: true }, userId);
      await service.create(companyB, { displayName: "B1", isCustomer: true }, userId);
      const listA = await service.findAll(companyA, {});
      expect(listA.total).toBe(1);
      expect((listA.data[0] as Row).displayName).toBe("A1");
    });
  });

  describe("update", () => {
    it("updates fields", async () => {
      const { service } = makeService();
      const c = await service.create(companyA, { displayName: "Old", isCustomer: true }, userId);
      const updated = await service.update(companyA, c.id, { displayName: "New" });
      expect(updated.displayName).toBe("New");
    });

    it("rejects flipping the last role flag to false", async () => {
      const { service } = makeService();
      const c = await service.create(
        companyA,
        { displayName: "Only customer", isCustomer: true, isVendor: false },
        userId,
      );
      await expect(service.update(companyA, c.id, { isCustomer: false })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("allows flipping one flag when the other remains true", async () => {
      const { service } = makeService();
      const c = await service.create(
        companyA,
        { displayName: "Both", isCustomer: true, isVendor: true },
        userId,
      );
      const updated = await service.update(companyA, c.id, { isCustomer: false });
      expect(updated.isCustomer).toBe(false);
      expect(updated.isVendor).toBe(true);
    });

    it("supports soft-deactivation via isActive=false", async () => {
      const { service } = makeService();
      const c = await service.create(companyA, { displayName: "Bye", isCustomer: true }, userId);
      const updated = await service.update(companyA, c.id, { isActive: false });
      expect(updated.isActive).toBe(false);
    });

    it("blocks cross-company updates", async () => {
      const { service } = makeService();
      const c = await service.create(companyA, { displayName: "A1", isCustomer: true }, userId);
      await expect(
        service.update(companyB, c.id, { displayName: "hijack" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
