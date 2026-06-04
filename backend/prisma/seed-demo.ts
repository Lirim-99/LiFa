/**
 * Demo seed — populates one fully-furnished company so you can poke at the UI
 * without any data-entry. Run with:
 *
 *   pnpm db:seed:demo            (from repo root)
 *   pnpm --filter backend db:seed:demo
 *
 * It is **idempotent**: re-running wipes the demo company (CASCADES every
 * child row) and the demo users, then re-creates them. Your own data is
 * never touched — the script keys off the demo email domain (`@lifa.demo`)
 * and the demo company's legal name.
 *
 * What it creates:
 *   - 3 users: owner / accountant / viewer  (password: Sup3rSecret!)
 *   - 1 SHPK company with full default setup (CoA, periods, tax rates,
 *     account defaults — handled by CompaniesService.create)
 *   - 6 contacts (3 customers, 2 vendors, 1 both)
 *   - 4 catalog items (2 products, 2 services)
 *   - 6 invoices spanning every status: DRAFT, ISSUED, ISSUED-overdue,
 *     PARTIALLY_PAID, PAID, VOID
 *   - 2 payments (one partial, one full)
 *   - 3 journal entries (2 posted, 1 draft)
 */

import "reflect-metadata";
import * as bcrypt from "bcrypt";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { CompaniesService } from "../src/modules/companies/companies.service";
import { ContactsService } from "../src/modules/contacts/contacts.service";
import { CatalogService } from "../src/modules/catalog/catalog.service";
import { InvoicesService } from "../src/modules/sales/invoices.service";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { JournalEntriesService } from "../src/modules/accounting/journal-entries.service";

const PASSWORD = "Sup3rSecret!";
const COMPANY_NAME = "Acme Trading SHPK";

const DEMO_USERS = {
  owner: { email: "owner@lifa.demo", firstName: "Lirim", lastName: "Hoxha" },
  accountant: { email: "accountant@lifa.demo", firstName: "Arta", lastName: "Krasniqi" },
  viewer: { email: "viewer@lifa.demo", firstName: "Vali", lastName: "Berisha" },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY_MS);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const prisma = app.get(PrismaService);

  log("Cleaning previous demo data…");
  await cleanup(prisma);

  log("Creating demo users…");
  const users = await createUsers(prisma);

  log(`Creating company "${COMPANY_NAME}" (full setup: CoA, periods, taxes, defaults)…`);
  const companies = app.get(CompaniesService);
  const company = await companies.create(
    {
      legalName: COMPANY_NAME,
      legalForm: "SHPK" as never,
      tradeName: "Acme Trading",
      uinNui: "812345678",
      fiscalNumber: "601234567",
      vatNumber: "330001234",
      email: "hello@acme.test",
      phone: "+383 38 555 0100",
      defaultCurrency: "EUR",
      fiscalYearStartMonth: 1,
    },
    users.owner.id,
  );

  log("Granting accountant + viewer access to the company…");
  await grantAccess(prisma, company.id, users);

  log("Creating contacts (3 customers, 2 vendors, 1 both)…");
  const contacts = await createContacts(app.get(ContactsService), company.id, users.owner.id);

  log("Creating catalog items (2 products, 2 services)…");
  await createCatalog(app.get(CatalogService), company.id, users.owner.id, prisma);

  log("Creating invoices across every status (DRAFT → VOID)…");
  const invoiceList = await createInvoices(
    app.get(InvoicesService),
    company.id,
    users.owner.id,
    contacts,
    prisma,
  );

  log("Recording payments (one partial, one full)…");
  await recordPayments(app.get(PaymentsService), company.id, users.owner.id, invoiceList);

  log("Creating manual journal entries (initial capital, petty cash, one draft)…");
  await createJournalEntries(
    app.get(JournalEntriesService),
    company.id,
    users.owner.id,
    prisma,
  );

  log("Adding a few addresses + activity codes for the company…");
  await createLegalProfile(prisma, company.id);

  console.log("");
  console.log("Demo data is ready. Sign in at http://localhost:3000/login:");
  console.log("");
  for (const [role, info] of Object.entries(DEMO_USERS)) {
    console.log(`  ${role.padEnd(10)} → ${info.email}  /  ${PASSWORD}`);
  }
  console.log("");

  await app.close();
}

// --------------------------------------------------------------------------
// Cleanup
// --------------------------------------------------------------------------

async function cleanup(prisma: PrismaService) {
  // Demo company deletes its dependent rows via the CASCADE FKs in the schema.
  // After that, no User FK still points at the demo users → safe to delete them.
  await prisma.company.deleteMany({ where: { legalName: COMPANY_NAME } });

  const demoEmails = Object.values(DEMO_USERS).map((u) => u.email);
  // If a demo user is still referenced (e.g. they created a non-demo company),
  // delete fails — surface a clearer error in that case.
  try {
    await prisma.user.deleteMany({ where: { email: { in: demoEmails } } });
  } catch (err) {
    console.error(
      "⚠️  Demo user cleanup failed. They probably created non-demo data. Delete that first.",
    );
    throw err;
  }
}

// --------------------------------------------------------------------------
// Users + access
// --------------------------------------------------------------------------

async function createUsers(prisma: PrismaService) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const owner = await prisma.user.create({
    data: { ...DEMO_USERS.owner, passwordHash },
  });
  const accountant = await prisma.user.create({
    data: { ...DEMO_USERS.accountant, passwordHash },
  });
  const viewer = await prisma.user.create({
    data: { ...DEMO_USERS.viewer, passwordHash },
  });
  return { owner, accountant, viewer };
}

async function grantAccess(
  prisma: PrismaService,
  companyId: string,
  users: { accountant: { id: string }; viewer: { id: string } },
) {
  const [accountantRole, viewerRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { code: "accountant" } }),
    prisma.role.findUniqueOrThrow({ where: { code: "viewer" } }),
  ]);
  await prisma.userCompanyAccess.create({
    data: {
      userId: users.accountant.id,
      companyId,
      roleId: accountantRole.id,
      isDefault: true,
    },
  });
  await prisma.userCompanyAccess.create({
    data: { userId: users.viewer.id, companyId, roleId: viewerRole.id, isDefault: true },
  });
}

// --------------------------------------------------------------------------
// Contacts
// --------------------------------------------------------------------------

async function createContacts(
  contacts: ContactsService,
  companyId: string,
  userId: string,
) {
  const stationery = await contacts.create(
    companyId,
    {
      displayName: "Pristina Office Supplies",
      legalName: "Pristina Office Supplies LLC",
      isCustomer: true,
      email: "orders@pristinaoffice.test",
      phone: "+383 38 555 0101",
      city: "Pristina",
      country: "Kosovo",
      paymentTermsDays: 30,
    } as never,
    userId,
  );
  const agency = await contacts.create(
    companyId,
    {
      displayName: "Marketing Lab",
      legalName: "Marketing Lab SHPK",
      isCustomer: true,
      email: "billing@mklab.test",
      phone: "+383 49 555 0202",
      city: "Prizren",
      country: "Kosovo",
      paymentTermsDays: 14,
    } as never,
    userId,
  );
  const bakery = await contacts.create(
    companyId,
    {
      displayName: "Highland Bakery",
      legalName: "Highland Bakery BI",
      isCustomer: true,
      email: "info@highlandbakery.test",
      phone: "+383 44 555 0303",
      city: "Peja",
      country: "Kosovo",
      paymentTermsDays: 7,
    } as never,
    userId,
  );
  await contacts.create(
    companyId,
    {
      displayName: "Balkan Hosting",
      legalName: "Balkan Hosting d.o.o",
      isVendor: true,
      email: "billing@balkanhosting.test",
      phone: "+387 33 555 0404",
      city: "Sarajevo",
      country: "Bosnia and Herzegovina",
    } as never,
    userId,
  );
  await contacts.create(
    companyId,
    {
      displayName: "Office Rentals Inc.",
      isVendor: true,
      email: "leases@officerentals.test",
      city: "Pristina",
      country: "Kosovo",
    } as never,
    userId,
  );
  const techpartner = await contacts.create(
    companyId,
    {
      displayName: "TechPartner Group",
      legalName: "TechPartner Group SHA",
      isCustomer: true,
      isVendor: true,
      email: "finance@techpartner.test",
      city: "Tirana",
      country: "Albania",
      paymentTermsDays: 30,
    } as never,
    userId,
  );
  return { stationery, agency, bakery, techpartner };
}

// --------------------------------------------------------------------------
// Catalog
// --------------------------------------------------------------------------

async function createCatalog(
  catalog: CatalogService,
  companyId: string,
  userId: string,
  prisma: PrismaService,
) {
  const salesRevenue = await prisma.account.findFirstOrThrow({
    where: { companyId, code: "4100" },
  });
  const cogs = await prisma.account.findFirstOrThrow({
    where: { companyId, code: "5100" },
  });
  const taxStandard = await prisma.taxRate.findFirstOrThrow({
    where: { companyId, code: "VAT_STANDARD" },
  });

  await catalog.create(
    companyId,
    {
      name: "Office Notebook (A5)",
      type: "PRODUCT" as never,
      sku: "NB-A5",
      unit: "piece",
      salePrice: 4.5,
      purchasePrice: 1.8,
      incomeAccountId: salesRevenue.id,
      expenseAccountId: cogs.id,
      defaultTaxRateId: taxStandard.id,
    } as never,
    userId,
  );
  await catalog.create(
    companyId,
    {
      name: "Premium Pen Set",
      type: "PRODUCT" as never,
      sku: "PEN-PREM",
      unit: "pack",
      salePrice: 15,
      purchasePrice: 6,
      incomeAccountId: salesRevenue.id,
      defaultTaxRateId: taxStandard.id,
    } as never,
    userId,
  );
  await catalog.create(
    companyId,
    {
      name: "Bookkeeping consulting",
      type: "SERVICE" as never,
      unit: "hour",
      salePrice: 60,
      incomeAccountId: salesRevenue.id,
      defaultTaxRateId: taxStandard.id,
    } as never,
    userId,
  );
  await catalog.create(
    companyId,
    {
      name: "Quarterly VAT filing",
      type: "SERVICE" as never,
      unit: "filing",
      salePrice: 250,
      incomeAccountId: salesRevenue.id,
      defaultTaxRateId: taxStandard.id,
    } as never,
    userId,
  );
}

// --------------------------------------------------------------------------
// Invoices
// --------------------------------------------------------------------------

type Customers = Awaited<ReturnType<typeof createContacts>>;

async function createInvoices(
  invoices: InvoicesService,
  companyId: string,
  userId: string,
  customers: Customers,
  prisma: PrismaService,
) {
  const taxStandard = await prisma.taxRate.findFirstOrThrow({
    where: { companyId, code: "VAT_STANDARD" },
  });

  // 1. DRAFT — never issued.
  await invoices.create(
    companyId,
    {
      contactId: customers.stationery.id,
      issueDate: new Date(),
      dueDate: daysFromNow(30),
      notes: "Pending review by sales lead.",
      lines: [
        {
          description: "Bulk notebook order",
          quantity: 50,
          unitPrice: 4.5,
          taxRateId: taxStandard.id,
        },
        {
          description: "Premium pen sets",
          quantity: 10,
          unitPrice: 15,
          taxRateId: taxStandard.id,
        },
      ],
    } as never,
    userId,
  );

  // 2. ISSUED, unpaid.
  const issuedDraft = await invoices.create(
    companyId,
    {
      contactId: customers.agency.id,
      issueDate: daysAgo(10),
      dueDate: daysFromNow(4),
      lines: [
        {
          description: "20 hours of bookkeeping",
          quantity: 20,
          unitPrice: 60,
          taxRateId: taxStandard.id,
        },
      ],
    } as never,
    userId,
  );
  await invoices.issue(companyId, issuedDraft.id, userId);

  // 3. ISSUED, overdue.
  const overdueDraft = await invoices.create(
    companyId,
    {
      contactId: customers.bakery.id,
      issueDate: daysAgo(45),
      dueDate: daysAgo(15),
      lines: [
        {
          description: "Q1 VAT filing",
          quantity: 1,
          unitPrice: 250,
          taxRateId: taxStandard.id,
        },
      ],
    } as never,
    userId,
  );
  await invoices.issue(companyId, overdueDraft.id, userId);

  // 4. PARTIALLY_PAID — will receive a partial payment below.
  const partialDraft = await invoices.create(
    companyId,
    {
      contactId: customers.techpartner.id,
      issueDate: daysAgo(20),
      dueDate: daysFromNow(10),
      lines: [
        {
          description: "Consulting retainer (30h)",
          quantity: 30,
          unitPrice: 60,
          taxRateId: taxStandard.id,
        },
      ],
    } as never,
    userId,
  );
  const toPartial = await invoices.issue(companyId, partialDraft.id, userId);

  // 5. PAID — will receive a full payment below.
  const paidDraft = await invoices.create(
    companyId,
    {
      contactId: customers.stationery.id,
      issueDate: daysAgo(30),
      dueDate: daysAgo(5),
      lines: [
        {
          description: "Notebook resupply",
          quantity: 100,
          unitPrice: 4.5,
          taxRateId: taxStandard.id,
        },
      ],
    } as never,
    userId,
  );
  const toPaid = await invoices.issue(companyId, paidDraft.id, userId);

  // 6. VOID — issued, then voided.
  const voidDraft = await invoices.create(
    companyId,
    {
      contactId: customers.agency.id,
      issueDate: daysAgo(25),
      dueDate: daysFromNow(5),
      notes: "Created in error.",
      lines: [
        {
          description: "Incorrect line — see void note",
          quantity: 1,
          unitPrice: 1000,
          taxRateId: taxStandard.id,
        },
      ],
    } as never,
    userId,
  );
  const issuedThenVoided = await invoices.issue(companyId, voidDraft.id, userId);
  await invoices.void(companyId, issuedThenVoided.id, userId);

  return { toPartial, toPaid };
}

// --------------------------------------------------------------------------
// Payments
// --------------------------------------------------------------------------

async function recordPayments(
  payments: PaymentsService,
  companyId: string,
  userId: string,
  invoices: { toPartial: { id: string; contactId: string; totalAmount: unknown }; toPaid: { id: string; contactId: string; totalAmount: unknown } },
) {
  // Partial: pay €1,000 on the consulting retainer (total ≈ €2,124).
  await payments.create(
    companyId,
    {
      contactId: invoices.toPartial.contactId,
      paymentMethod: "BANK_TRANSFER" as never,
      paymentDate: daysAgo(5),
      totalAmount: 1000,
      referenceNumber: "WIRE-2026-001",
      notes: "Partial payment — balance billed next month.",
      allocations: [{ invoiceId: invoices.toPartial.id, allocatedAmount: 1000 }],
    } as never,
    userId,
  );

  // Full: notebook resupply (total = 100 × 4.5 + 18% VAT = 531).
  const fullAmount = Number(invoices.toPaid.totalAmount as { toString(): string });
  await payments.create(
    companyId,
    {
      contactId: invoices.toPaid.contactId,
      paymentMethod: "CASH" as never,
      paymentDate: daysAgo(3),
      totalAmount: fullAmount,
      referenceNumber: "CASH-2026-001",
      allocations: [{ invoiceId: invoices.toPaid.id, allocatedAmount: fullAmount }],
    } as never,
    userId,
  );
}

// --------------------------------------------------------------------------
// Manual journal entries
// --------------------------------------------------------------------------

async function createJournalEntries(
  journalEntries: JournalEntriesService,
  companyId: string,
  userId: string,
  prisma: PrismaService,
) {
  const cash = await prisma.account.findFirstOrThrow({
    where: { companyId, code: "1100" },
  });
  const bank = await prisma.account.findFirstOrThrow({
    where: { companyId, code: "1200" },
  });
  const shareCapital = await prisma.account.findFirstOrThrow({
    where: { companyId, code: "3100" },
  });

  // Posted: initial share capital deposit.
  const initialCapital = await journalEntries.create(
    companyId,
    {
      entryDate: daysAgo(90),
      memo: "Initial share capital contribution",
      lines: [
        {
          accountId: bank.id,
          description: "Founder bank deposit",
          debitAmount: 25000,
          creditAmount: 0,
        },
        {
          accountId: shareCapital.id,
          description: "Share capital paid in",
          debitAmount: 0,
          creditAmount: 25000,
        },
      ],
    } as never,
    userId,
  );
  await journalEntries.post(companyId, initialCapital.id, userId);

  // Posted: petty-cash withdrawal.
  const pettyCash = await journalEntries.create(
    companyId,
    {
      entryDate: daysAgo(60),
      memo: "Withdrew petty cash from bank",
      lines: [
        {
          accountId: cash.id,
          description: "Cash on hand",
          debitAmount: 500,
          creditAmount: 0,
        },
        {
          accountId: bank.id,
          description: "Bank withdrawal",
          debitAmount: 0,
          creditAmount: 500,
        },
      ],
    } as never,
    userId,
  );
  await journalEntries.post(companyId, pettyCash.id, userId);

  // Draft (left un-posted): waiting on accountant review.
  await journalEntries.create(
    companyId,
    {
      entryDate: new Date(),
      memo: "Q2 depreciation accrual — pending accountant review",
      lines: [
        {
          accountId: cash.id,
          description: "Placeholder",
          debitAmount: 250,
          creditAmount: 0,
        },
        {
          accountId: bank.id,
          description: "Placeholder",
          debitAmount: 0,
          creditAmount: 250,
        },
      ],
    } as never,
    userId,
  );
}

// --------------------------------------------------------------------------
// Legal profile (addresses + activity codes)
// --------------------------------------------------------------------------

async function createLegalProfile(prisma: PrismaService, companyId: string) {
  await prisma.companyAddress.createMany({
    data: [
      {
        companyId,
        addressType: "REGISTERED",
        country: "Kosovo",
        municipality: "Pristina",
        city: "Pristina",
        street: "Rr. Nëna Terezë 12",
        postalCode: "10000",
        isPrimary: true,
      },
      {
        companyId,
        addressType: "BUSINESS",
        country: "Kosovo",
        municipality: "Pristina",
        city: "Pristina",
        street: "Rr. UÇK 5, Kati 3",
        postalCode: "10000",
        isPrimary: false,
      },
    ],
  });
  await prisma.companyActivityCode.createMany({
    data: [
      {
        companyId,
        activityType: "PRIMARY",
        code: "47.19",
        description: "Other retail sale in non-specialised stores",
        sortOrder: 0,
      },
      {
        companyId,
        activityType: "SECONDARY",
        code: "69.20",
        description: "Accounting, bookkeeping and auditing activities",
        sortOrder: 1,
      },
    ],
  });
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function log(msg: string) {
  console.log(`  → ${msg}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
