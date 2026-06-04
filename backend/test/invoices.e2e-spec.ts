import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  getDefaultTaxRate,
  givenACompany,
  givenACustomer,
  givenAUser,
  givenAnIssuedInvoice,
} from "./setup/fixtures";
import { createTestApp } from "./setup/test-app";
import { disconnectTestPrisma, getTestPrisma, resetTestDb } from "./setup/test-db";

describe("Invoices (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await disconnectTestPrisma();
  });
  beforeEach(async () => {
    await resetTestDb();
  });

  /** Sets up one user with one company and one customer. */
  async function seedCompanyAndCustomer() {
    const user = await givenAUser(app);
    const company = await givenACompany(app, { ownerToken: user.accessToken });
    const customer = await givenACustomer(app, {
      token: user.accessToken,
      companyId: company.id,
    });
    return { user, company, customer };
  }

  describe("Issue", () => {
    it("posts a balanced journal entry and assigns numbers", async () => {
      const { user, company, customer } = await seedCompanyAndCustomer();
      const issued = await givenAnIssuedInvoice(app, {
        token: user.accessToken,
        companyId: company.id,
        contactId: customer.id,
        quantity: 1,
        unitPrice: 100,
      });

      expect(issued.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
      expect(Number(issued.totalAmount)).toBeCloseTo(118, 2);

      const prisma = getTestPrisma();
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: issued.id },
        include: { lines: true },
      });
      expect(invoice.status).toBe("ISSUED");
      expect(invoice.postedJournalEntryId).toBeTruthy();

      const entry = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: invoice.postedJournalEntryId! },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });
      expect(entry.status).toBe("POSTED");
      expect(entry.entryNumber).toMatch(/^JE-\d{4}-\d{5}$/);
      expect(entry.periodId).toBeTruthy();

      const debits = entry.lines.reduce((acc, l) => acc + Number(l.debitAmount), 0);
      const credits = entry.lines.reduce((acc, l) => acc + Number(l.creditAmount), 0);
      expect(debits).toBeCloseTo(118, 2);
      expect(credits).toBeCloseTo(118, 2);
      expect(debits).toBeCloseTo(credits, 2);

      // Exactly one debit and two credits (revenue + VAT).
      const debitLines = entry.lines.filter((l) => Number(l.debitAmount) > 0);
      const creditLines = entry.lines.filter((l) => Number(l.creditAmount) > 0);
      expect(debitLines).toHaveLength(1);
      expect(creditLines).toHaveLength(2);
    });

    it("rejects issuing a draft with no lines (400, status stays DRAFT)", async () => {
      const { user, company, customer } = await seedCompanyAndCustomer();
      const today = new Date().toISOString().slice(0, 10);
      const taxRate = await getDefaultTaxRate(app, {
        token: user.accessToken,
        companyId: company.id,
      });

      const draft = await request(app.getHttpServer())
        .post("/invoices")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .send({
          contactId: customer.id,
          issueDate: today,
          dueDate: today,
          lines: [{ description: "x", quantity: 1, unitPrice: 50, taxRateId: taxRate.id }],
        })
        .expect(201);

      // Replace lines with an empty array (via update — but DTO has min 1 so update would also reject)
      // instead, delete all lines directly to simulate a malformed state and try to issue.
      const prisma = getTestPrisma();
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: draft.body.id } });

      await request(app.getHttpServer())
        .post(`/invoices/${draft.body.id}/issue`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .expect(400);

      const stillDraft = await prisma.invoice.findUnique({ where: { id: draft.body.id } });
      expect(stillDraft?.status).toBe("DRAFT");
      expect(stillDraft?.invoiceNumber).toBeNull();
    });

    it("rejects issuing into a closed period and consumes no sequence number", async () => {
      const { user, company, customer } = await seedCompanyAndCustomer();
      const taxRate = await getDefaultTaxRate(app, {
        token: user.accessToken,
        companyId: company.id,
      });
      const today = new Date().toISOString().slice(0, 10);

      // Close the period containing today.
      const prisma = getTestPrisma();
      const period = await prisma.accountingPeriod.findFirstOrThrow({
        where: { companyId: company.id, startDate: { lte: new Date(today) } },
        orderBy: { startDate: "desc" },
      });
      await prisma.accountingPeriod.update({
        where: { id: period.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });

      const draft = await request(app.getHttpServer())
        .post("/invoices")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .send({
          contactId: customer.id,
          issueDate: today,
          dueDate: today,
          lines: [{ description: "x", quantity: 1, unitPrice: 50, taxRateId: taxRate.id }],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/invoices/${draft.body.id}/issue`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .expect(400);

      const stillDraft = await prisma.invoice.findUnique({ where: { id: draft.body.id } });
      expect(stillDraft?.status).toBe("DRAFT");
      expect(stillDraft?.invoiceNumber).toBeNull();

      const sequence = await prisma.documentSequence.findFirst({
        where: { companyId: company.id, documentType: "INVOICE" },
      });
      expect(sequence?.lastNumber).toBe(0);
    });

    it("issues two invoices serially with sequential numbers (no gaps)", async () => {
      const { user, company, customer } = await seedCompanyAndCustomer();
      const a = await givenAnIssuedInvoice(app, {
        token: user.accessToken,
        companyId: company.id,
        contactId: customer.id,
      });
      const b = await givenAnIssuedInvoice(app, {
        token: user.accessToken,
        companyId: company.id,
        contactId: customer.id,
      });
      const yearA = a.invoiceNumber.slice(4, 8);
      const yearB = b.invoiceNumber.slice(4, 8);
      expect(yearA).toBe(yearB);
      const numA = Number(a.invoiceNumber.slice(-5));
      const numB = Number(b.invoiceNumber.slice(-5));
      expect(numB).toBe(numA + 1);
    });
  });

  describe("Void", () => {
    it("creates a reversal entry, leaves the original POSTED, sets bidirectional link", async () => {
      const { user, company, customer } = await seedCompanyAndCustomer();
      const issued = await givenAnIssuedInvoice(app, {
        token: user.accessToken,
        companyId: company.id,
        contactId: customer.id,
      });

      await request(app.getHttpServer())
        .post(`/invoices/${issued.id}/void`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .expect(200);

      const prisma = getTestPrisma();
      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: issued.id } });
      expect(invoice.status).toBe("VOID");
      expect(invoice.voidedJournalEntryId).toBeTruthy();

      const original = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: invoice.postedJournalEntryId! },
        include: { lines: true },
      });
      const reversal = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: invoice.voidedJournalEntryId! },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });

      expect(original.status).toBe("POSTED");
      expect(original.reversedByEntryId).toBe(reversal.id);
      expect(reversal.status).toBe("POSTED");
      expect(reversal.reversalOfEntryId).toBe(original.id);

      // Lines should mirror (debit ↔ credit swapped).
      const sumDebits = reversal.lines.reduce((acc, l) => acc + Number(l.debitAmount), 0);
      const sumCredits = reversal.lines.reduce((acc, l) => acc + Number(l.creditAmount), 0);
      expect(sumDebits).toBeCloseTo(sumCredits, 2);

      // Net of original + reversal across both is zero.
      const allLines = [...original.lines, ...reversal.lines];
      const netByAccount = new Map<string, number>();
      for (const l of allLines) {
        const sign = Number(l.debitAmount) - Number(l.creditAmount);
        netByAccount.set(l.accountId, (netByAccount.get(l.accountId) ?? 0) + sign);
      }
      for (const net of netByAccount.values()) {
        expect(net).toBeCloseTo(0, 2);
      }
    });

    it("refuses to void twice", async () => {
      const { user, company, customer } = await seedCompanyAndCustomer();
      const issued = await givenAnIssuedInvoice(app, {
        token: user.accessToken,
        companyId: company.id,
        contactId: customer.id,
      });
      await request(app.getHttpServer())
        .post(`/invoices/${issued.id}/void`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .expect(200);
      // Second void on the same (now-VOID) invoice — service should reject.
      await request(app.getHttpServer())
        .post(`/invoices/${issued.id}/void`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .expect((r) => {
          if (r.status === 200) throw new Error("expected void to be refused, got 200");
        });
    });
  });

  describe("Drafts", () => {
    it("DELETE draft → 204; DELETE issued → 400", async () => {
      const { user, company, customer } = await seedCompanyAndCustomer();
      const taxRate = await getDefaultTaxRate(app, {
        token: user.accessToken,
        companyId: company.id,
      });
      const today = new Date().toISOString().slice(0, 10);

      const draft = await request(app.getHttpServer())
        .post("/invoices")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .send({
          contactId: customer.id,
          issueDate: today,
          dueDate: today,
          lines: [{ description: "x", quantity: 1, unitPrice: 50, taxRateId: taxRate.id }],
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/invoices/${draft.body.id}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .expect(204);

      const issued = await givenAnIssuedInvoice(app, {
        token: user.accessToken,
        companyId: company.id,
        contactId: customer.id,
      });
      await request(app.getHttpServer())
        .delete(`/invoices/${issued.id}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .expect(400);
    });
  });

  describe("Cross-company isolation", () => {
    it("user A cannot read user B's invoice", async () => {
      const alice = await givenAUser(app, { email: "alice@example.com" });
      const bob = await givenAUser(app, { email: "bob@example.com" });
      const companyA = await givenACompany(app, { ownerToken: alice.accessToken });
      const companyB = await givenACompany(app, { ownerToken: bob.accessToken });
      const customerB = await givenACustomer(app, {
        token: bob.accessToken,
        companyId: companyB.id,
      });
      const bobInvoice = await givenAnIssuedInvoice(app, {
        token: bob.accessToken,
        companyId: companyB.id,
        contactId: customerB.id,
      });

      await request(app.getHttpServer())
        .get(`/invoices/${bobInvoice.id}`)
        .set("Authorization", `Bearer ${alice.accessToken}`)
        .set("X-Company-Id", companyA.id)
        .expect(404);

      // And with the WRONG X-Company-Id (bob's company) → 403 from CompanyGuard.
      await request(app.getHttpServer())
        .get(`/invoices/${bobInvoice.id}`)
        .set("Authorization", `Bearer ${alice.accessToken}`)
        .set("X-Company-Id", companyB.id)
        .expect(403);
    });
  });
});
