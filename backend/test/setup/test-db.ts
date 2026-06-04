import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client for e2e tests. Points at `lifa_test`.
 * `globalSetup` has already migrated + seeded by the time this is imported.
 */
let _prisma: PrismaClient | undefined;
export function getTestPrisma(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = undefined;
  }
}

/**
 * Wipes every business table in the test DB and re-seeds reference data
 * (roles + system tax templates). Cheap (<10ms) — run in `beforeEach`.
 *
 * We can't TRUNCATE the entire database because it would also wipe the
 * `_prisma_migrations` table. Instead we TRUNCATE every table whose name
 * comes back from `information_schema.tables` EXCEPT migrations + tables
 * we want to keep seeded.
 */
export async function resetTestDb(): Promise<void> {
  const prisma = getTestPrisma();

  // Discover every public table once per call — cheap enough at this scale.
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')
  `;

  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);

  // Re-seed the rows that every test assumes exist.
  await seedReferenceData(prisma);
}

/**
 * Inserts the rows that `prisma db seed` would: 4 roles + 3 system tax-rate
 * templates (companyId = null). Idempotent.
 */
export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  const roles = [
    { code: "owner", name: "Owner", description: "Full access. Manages company, users, roles." },
    { code: "admin", name: "Admin", description: "Full access except transferring ownership." },
    {
      code: "accountant",
      name: "Accountant",
      description: "Manages contacts, catalog, tax, invoices, payments, journal entries.",
    },
    { code: "viewer", name: "Viewer", description: "Read-only access to reports." },
  ];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: r,
    });
  }

  const templates = [
    {
      code: "VAT_STANDARD",
      name: "Standard 18%",
      rate: "18.0000",
      calculationType: "EXCLUSIVE" as const,
      scope: "BOTH" as const,
      isDefault: true,
    },
    {
      code: "VAT_REDUCED",
      name: "Reduced 8%",
      rate: "8.0000",
      calculationType: "EXCLUSIVE" as const,
      scope: "BOTH" as const,
      isDefault: false,
    },
    {
      code: "VAT_ZERO",
      name: "Zero / Exempt 0%",
      rate: "0.0000",
      calculationType: "EXCLUSIVE" as const,
      scope: "BOTH" as const,
      isDefault: false,
    },
  ];
  for (const t of templates) {
    const existing = await prisma.taxRate.findFirst({
      where: { companyId: null, code: t.code },
    });
    if (existing) {
      await prisma.taxRate.update({ where: { id: existing.id }, data: t });
    } else {
      await prisma.taxRate.create({ data: { ...t, companyId: null } });
    }
  }
}
