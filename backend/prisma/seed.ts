/**
 * Prisma seed — populates system reference data that is NOT company-scoped.
 *
 * Idempotent: re-running `prisma db seed` will not duplicate rows.
 *
 *   - Roles (owner, admin, accountant, viewer): codes are unique, used by upsert.
 *   - System tax-rate templates (companyId = null): identified by (companyId IS NULL, code).
 *
 * NOTE: Kosovo VAT rates (18% standard, 8% reduced, 0% zero/exempt) are
 * placeholders. **Needs accountant validation** — see PRODUCT_BRIEF.md §2.6.
 */
import { PrismaClient, TaxCalculationType, TaxScope } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES = [
  { code: "owner", name: "Owner", description: "Full access. Manages company, users, roles." },
  { code: "admin", name: "Admin", description: "Full access except transferring ownership." },
  {
    code: "accountant",
    name: "Accountant",
    description: "Manages contacts, catalog, tax, invoices, payments, journal entries.",
  },
  { code: "viewer", name: "Viewer", description: "Read-only access to reports." },
];

const SYSTEM_TAX_RATES = [
  {
    code: "VAT_STANDARD",
    name: "Standard 18%",
    rate: "18.0000",
    calculationType: TaxCalculationType.EXCLUSIVE,
    scope: TaxScope.BOTH,
    isDefault: true,
  },
  {
    code: "VAT_REDUCED",
    name: "Reduced 8%",
    rate: "8.0000",
    calculationType: TaxCalculationType.EXCLUSIVE,
    scope: TaxScope.BOTH,
    isDefault: false,
  },
  {
    code: "VAT_ZERO",
    name: "Zero / Exempt 0%",
    rate: "0.0000",
    calculationType: TaxCalculationType.EXCLUSIVE,
    scope: TaxScope.BOTH,
    isDefault: false,
  },
];

async function seedRoles() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }
  console.log(`Seeded ${ROLES.length} roles.`);
}

async function seedSystemTaxRates() {
  // No unique constraint on (companyId, code) where companyId IS NULL, so we
  // do a manual find-then-create. companyId = null marks the system template.
  for (const rate of SYSTEM_TAX_RATES) {
    const existing = await prisma.taxRate.findFirst({
      where: { companyId: null, code: rate.code },
    });
    if (existing) {
      await prisma.taxRate.update({
        where: { id: existing.id },
        data: {
          name: rate.name,
          rate: rate.rate,
          calculationType: rate.calculationType,
          scope: rate.scope,
          isDefault: rate.isDefault,
        },
      });
    } else {
      await prisma.taxRate.create({
        data: { ...rate, companyId: null },
      });
    }
  }
  console.log(`Seeded ${SYSTEM_TAX_RATES.length} system tax-rate templates.`);
}

async function main() {
  await seedRoles();
  await seedSystemTaxRates();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
