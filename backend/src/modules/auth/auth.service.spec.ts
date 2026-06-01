import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";

type PrismaUserRow = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
};

function makeAuthService(rows: PrismaUserRow[]) {
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { email?: string; id?: string } }) =>
        Promise.resolve(
          rows.find(
            (r) => (where.email && r.email === where.email) || (where.id && r.id === where.id),
          ) ?? null,
        ),
      ),
      create: jest.fn(
        ({
          data,
          select,
        }: {
          data: PrismaUserRow & { firstName: string; lastName: string };
          select?: object;
        }) => {
          const row = { id: `u-${rows.length + 1}`, isActive: true, ...data };
          rows.push(row);
          return Promise.resolve(select ? { id: row.id, email: row.email } : row);
        },
      ),
    },
  };

  const jwt = {
    signAsync: jest.fn((payload: object) => Promise.resolve(`signed:${JSON.stringify(payload)}`)),
    verifyAsync: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === "JWT_ACCESS_EXPIRES_IN") return "1h";
      if (key === "JWT_REFRESH_EXPIRES_IN") return "7d";
      return undefined;
    }),
  };

  return {
    service: new AuthService(
      prisma as unknown as ConstructorParameters<typeof AuthService>[0],
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    ),
    prisma,
    jwt,
  };
}

describe("AuthService", () => {
  describe("register", () => {
    it("creates a user and hashes the password", async () => {
      const rows: PrismaUserRow[] = [];
      const { service, prisma } = makeAuthService(rows);
      const result = await service.register({
        firstName: "Lirim",
        lastName: "H",
        email: "lirim@example.com",
        password: "supersecret",
      });
      expect(result.email).toBe("lirim@example.com");
      expect(prisma.user.create).toHaveBeenCalled();
      const arg = prisma.user.create.mock.calls[0][0] as { data: { passwordHash: string } };
      expect(arg.data.passwordHash).not.toBe("supersecret");
      expect(await bcrypt.compare("supersecret", arg.data.passwordHash)).toBe(true);
    });

    it("rejects duplicate emails", async () => {
      const rows: PrismaUserRow[] = [
        { id: "u-1", email: "dup@example.com", passwordHash: "x", isActive: true },
      ];
      const { service } = makeAuthService(rows);
      await expect(
        service.register({
          firstName: "X",
          lastName: "Y",
          email: "dup@example.com",
          password: "anything123",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("issues access + refresh tokens on valid credentials", async () => {
      const passwordHash = await bcrypt.hash("correct-horse", 10);
      const rows: PrismaUserRow[] = [
        { id: "u-1", email: "u@example.com", passwordHash, isActive: true },
      ];
      const { service } = makeAuthService(rows);
      const tokens = await service.login({ email: "u@example.com", password: "correct-horse" });
      expect(tokens.accessToken).toContain("access");
      expect(tokens.refreshToken).toContain("refresh");
      expect(tokens.expiresIn).toBe(3600);
    });

    it("rejects wrong password with 401", async () => {
      const passwordHash = await bcrypt.hash("correct-horse", 10);
      const rows: PrismaUserRow[] = [
        { id: "u-1", email: "u@example.com", passwordHash, isActive: true },
      ];
      const { service } = makeAuthService(rows);
      await expect(
        service.login({ email: "u@example.com", password: "wrong" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects unknown email with 401 (no email enumeration leak)", async () => {
      const { service } = makeAuthService([]);
      await expect(
        service.login({ email: "nobody@example.com", password: "anything" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects inactive users", async () => {
      const passwordHash = await bcrypt.hash("correct-horse", 10);
      const rows: PrismaUserRow[] = [
        { id: "u-1", email: "u@example.com", passwordHash, isActive: false },
      ];
      const { service } = makeAuthService(rows);
      await expect(
        service.login({ email: "u@example.com", password: "correct-horse" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
