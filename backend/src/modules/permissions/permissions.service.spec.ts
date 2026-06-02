import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import { roleHasPermission } from "./permissions.matrix";

// --------------------------------------------------------------------------
// Matrix tests — pure function, no Prisma needed.
// --------------------------------------------------------------------------
describe("permissions matrix", () => {
  it("owner has every permission, including permissions.manage", () => {
    expect(roleHasPermission("owner", "company.update")).toBe(true);
    expect(roleHasPermission("owner", "invoices.issue")).toBe(true);
    expect(roleHasPermission("owner", "permissions.manage")).toBe(true);
    expect(roleHasPermission("owner", "audit.read")).toBe(true);
  });

  it("admin has the same permissions as owner (for MVP)", () => {
    expect(roleHasPermission("admin", "company.update")).toBe(true);
    expect(roleHasPermission("admin", "permissions.manage")).toBe(true);
  });

  it("accountant can do operational work but cannot update company or manage permissions", () => {
    expect(roleHasPermission("accountant", "invoices.issue")).toBe(true);
    expect(roleHasPermission("accountant", "invoices.create")).toBe(true);
    expect(roleHasPermission("accountant", "contacts.create")).toBe(true);
    expect(roleHasPermission("accountant", "audit.read")).toBe(true);
    expect(roleHasPermission("accountant", "company.update")).toBe(false);
    expect(roleHasPermission("accountant", "permissions.manage")).toBe(false);
  });

  it("viewer can only read reports", () => {
    expect(roleHasPermission("viewer", "reports.read")).toBe(true);
    expect(roleHasPermission("viewer", "invoices.create")).toBe(false);
    expect(roleHasPermission("viewer", "contacts.create")).toBe(false);
    expect(roleHasPermission("viewer", "audit.read")).toBe(false);
  });

  it("wildcards in the matrix resolve sub-permissions correctly", () => {
    // accountant has "invoices.*" — should cover every concrete invoice permission
    expect(roleHasPermission("accountant", "invoices.create")).toBe(true);
    expect(roleHasPermission("accountant", "invoices.update")).toBe(true);
    expect(roleHasPermission("accountant", "invoices.void")).toBe(true);
  });

  it("unknown roles never have any permission", () => {
    expect(roleHasPermission("ghost", "reports.read")).toBe(false);
    expect(roleHasPermission("", "reports.read")).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Service tests — in-memory Prisma fake.
// --------------------------------------------------------------------------
type AccessRow = {
  userId: string;
  companyId: string;
  roleId: string;
  isDefault: boolean;
  role: { code: string };
};
type UserRow = { id: string; email: string; firstName: string; lastName: string };
type RoleRow = { id: string; code: string };

function makePrisma() {
  const users: UserRow[] = [];
  const roles: RoleRow[] = [
    { id: "r-owner", code: "owner" },
    { id: "r-admin", code: "admin" },
    { id: "r-accountant", code: "accountant" },
    { id: "r-viewer", code: "viewer" },
  ];
  const access: AccessRow[] = [];

  const prisma = {
    user: {
      findUnique: ({ where }: { where: { email?: string; id?: string } }) =>
        Promise.resolve(
          users.find(
            (u) => (where.email && u.email === where.email) || (where.id && u.id === where.id),
          ) ?? null,
        ),
    },
    role: {
      findUnique: ({ where }: { where: { code: string } }) =>
        Promise.resolve(roles.find((r) => r.code === where.code) ?? null),
    },
    userCompanyAccess: {
      findUnique: ({
        where,
      }: {
        where: { userId_companyId: { userId: string; companyId: string } };
      }) => {
        const row = access.find(
          (a) =>
            a.userId === where.userId_companyId.userId &&
            a.companyId === where.userId_companyId.companyId,
        );
        return Promise.resolve(row ?? null);
      },
      findMany: ({ where }: { where: { companyId: string } }) => {
        const rows = access
          .filter((a) => a.companyId === where.companyId)
          .map((a) => ({
            ...a,
            createdAt: new Date(),
            user: users.find((u) => u.id === a.userId) ?? {
              id: a.userId,
              email: "?",
              firstName: "?",
              lastName: "?",
            },
          }));
        return Promise.resolve(rows);
      },
      create: ({ data }: { data: Omit<AccessRow, "role"> }) => {
        const role = roles.find((r) => r.id === data.roleId);
        const row: AccessRow = { ...data, role: { code: role?.code ?? "?" } };
        access.push(row);
        return Promise.resolve(row);
      },
      update: ({
        where,
        data,
      }: {
        where: { userId_companyId: { userId: string; companyId: string } };
        data: { roleId: string };
      }) => {
        const row = access.find(
          (a) =>
            a.userId === where.userId_companyId.userId &&
            a.companyId === where.userId_companyId.companyId,
        );
        if (!row) throw new Error("not found");
        row.roleId = data.roleId;
        const role = roles.find((r) => r.id === data.roleId);
        row.role = { code: role?.code ?? "?" };
        return Promise.resolve(row);
      },
      delete: ({
        where,
      }: {
        where: { userId_companyId: { userId: string; companyId: string } };
      }) => {
        const idx = access.findIndex(
          (a) =>
            a.userId === where.userId_companyId.userId &&
            a.companyId === where.userId_companyId.companyId,
        );
        if (idx < 0) throw new Error("not found");
        const [removed] = access.splice(idx, 1);
        return Promise.resolve(removed);
      },
      count: ({ where }: { where: { companyId: string; role?: { code: string } } }) => {
        const filtered = access.filter(
          (a) =>
            a.companyId === where.companyId &&
            (where.role?.code ? a.role.code === where.role.code : true),
        );
        return Promise.resolve(filtered.length);
      },
    },
  };

  const addUser = (u: UserRow) => users.push(u);
  const addAccess = (a: Omit<AccessRow, "role">) => {
    const role = roles.find((r) => r.id === a.roleId);
    access.push({ ...a, role: { code: role?.code ?? "?" } });
  };
  return { prisma, users, roles, access, addUser, addAccess };
}

function makeService() {
  const fake = makePrisma();
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new PermissionsService(fake.prisma as never, audit as never);
  return { service, ...fake };
}

describe("PermissionsService", () => {
  const companyId = "c-1";
  const owner = "u-owner";
  const second = "u-second";

  describe("addUser", () => {
    it("adds an existing user with a valid role", async () => {
      const { service, addUser, access } = makeService();
      addUser({ id: second, email: "second@example.com", firstName: "S", lastName: "X" });

      await service.addUser(companyId, { email: "second@example.com", roleCode: "accountant" });
      expect(access).toHaveLength(1);
      expect(access[0]).toMatchObject({ userId: second, companyId, isDefault: false });
    });

    it("rejects when the email is not registered", async () => {
      const { service } = makeService();
      await expect(
        service.addUser(companyId, { email: "ghost@example.com", roleCode: "accountant" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects when the user already has access", async () => {
      const { service, addUser, addAccess } = makeService();
      addUser({ id: second, email: "second@example.com", firstName: "S", lastName: "X" });
      addAccess({ userId: second, companyId, roleId: "r-accountant", isDefault: false });

      await expect(
        service.addUser(companyId, { email: "second@example.com", roleCode: "admin" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("updateUserRole", () => {
    it("changes the role of an existing access", async () => {
      const { service, addAccess, access } = makeService();
      addAccess({ userId: second, companyId, roleId: "r-viewer", isDefault: false });
      await service.updateUserRole(companyId, second, { roleCode: "accountant" });
      expect(access[0].roleId).toBe("r-accountant");
    });

    it("rejects when the user has no access", async () => {
      const { service } = makeService();
      await expect(
        service.updateUserRole(companyId, second, { roleCode: "accountant" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("removeUser", () => {
    it("removes a user's access", async () => {
      const { service, addAccess, access } = makeService();
      addAccess({ userId: owner, companyId, roleId: "r-owner", isDefault: true });
      addAccess({ userId: second, companyId, roleId: "r-accountant", isDefault: false });
      await service.removeUser(companyId, second, owner);
      expect(access.find((a) => a.userId === second)).toBeUndefined();
    });

    it("refuses to remove your own access", async () => {
      const { service, addAccess } = makeService();
      addAccess({ userId: owner, companyId, roleId: "r-owner", isDefault: true });
      await expect(service.removeUser(companyId, owner, owner)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("refuses to remove the last owner", async () => {
      const { service, addAccess } = makeService();
      addAccess({ userId: owner, companyId, roleId: "r-owner", isDefault: true });
      addAccess({ userId: second, companyId, roleId: "r-admin", isDefault: false });
      // second tries to remove the only owner
      await expect(service.removeUser(companyId, owner, second)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("allows removing an owner when another owner exists", async () => {
      const { service, addAccess, access } = makeService();
      addAccess({ userId: owner, companyId, roleId: "r-owner", isDefault: true });
      addAccess({ userId: second, companyId, roleId: "r-owner", isDefault: false });
      await service.removeUser(companyId, owner, second);
      expect(access).toHaveLength(1);
      expect(access[0].userId).toBe(second);
    });
  });

  describe("getUserRole / hasPermission", () => {
    it("getUserRole returns the role code", async () => {
      const { service, addAccess } = makeService();
      addAccess({ userId: owner, companyId, roleId: "r-owner", isDefault: true });
      expect(await service.getUserRole(owner, companyId)).toBe("owner");
    });

    it("getUserRole returns null when there's no access", async () => {
      const { service } = makeService();
      expect(await service.getUserRole(owner, companyId)).toBeNull();
    });

    it("hasPermission delegates to the matrix", () => {
      const { service } = makeService();
      expect(service.hasPermission("accountant", "invoices.create")).toBe(true);
      expect(service.hasPermission("viewer", "invoices.create")).toBe(false);
    });
  });
});
