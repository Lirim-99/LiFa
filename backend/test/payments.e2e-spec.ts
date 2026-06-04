import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  givenACompany,
  givenACustomer,
  givenAUser,
  givenAnIssuedInvoice,
} from "./setup/fixtures";
import { createTestApp } from "./setup/test-app";
import { disconnectTestPrisma, getTestPrisma, resetTestDb } from "./setup/test-db";

describe("Payments (e2e)", () => {
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

  async function seedInvoiceContext() {
    const user = await givenAUser(app);
    const company = await givenACompany(app, { ownerToken: user.accessToken });
    const customer = await givenACustomer(app, {
      token: user.accessToken,
      companyId: company.id,
    });
    const invoice = await givenAnIssuedInvoice(app, {
      token: user.accessToken,
      companyId: company.id,
      contactId: customer.id,
      quantity: 1,
      unitPrice: 100, // → $118 total with 18% VAT
    });
    return { user, company, customer, invoice };
  }

  describe("Create", () => {
    it("full allocation: invoice flips to PAID, balance hits zero, JE posted balanced", async () => {
      const { user, company, customer, invoice } = await seedInvoiceContext();
      const today = new Date().toISOString().slice(0, 10);

      const res = await request(app.getHttpServer())
        .post("/payments")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .send({
          contactId: customer.id,
          paymentMethod: "BANK_TRANSFER",
          paymentDate: today,
          totalAmount: Number(invoice.totalAmount),
          allocations: [{ invoiceId: invoice.id, allocatedAmount: Number(invoice.totalAmount) }],
        })
        .expect(201);
      expect(res.body.status).toBe("RECORDED");

      const prisma = getTestPrisma();
      const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(fresh.status).toBe("PAID");
      expect(Number(fresh.balanceDue)).toBeCloseTo(0, 2);
      expect(Number(fresh.paidAmount)).toBeCloseTo(Number(invoice.totalAmount), 2);

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: res.body.id },
        include: { allocations: true },
      });
      expect(payment.postedJournalEntryId).toBeTruthy();
      expect(payment.allocations).toHaveLength(1);

      const entry = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: payment.postedJournalEntryId! },
        include: { lines: true },
      });
      expect(entry.status).toBe("POSTED");
      const debits = entry.lines.reduce((a, l) => a + Number(l.debitAmount), 0);
      const credits = entry.lines.reduce((a, l) => a + Number(l.creditAmount), 0);
      expect(debits).toBeCloseTo(credits, 2);
      expect(debits).toBeCloseTo(Number(invoice.totalAmount), 2);
    });

    it("rejects under-allocation (400)", async () => {
      const { user, company, customer, invoice } = await seedInvoiceContext();
      await request(app.getHttpServer())
        .post("/payments")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .send({
          contactId: customer.id,
          paymentMethod: "CASH",
          paymentDate: new Date().toISOString().slice(0, 10),
          totalAmount: Number(invoice.totalAmount),
          allocations: [{ invoiceId: invoice.id, allocatedAmount: Number(invoice.totalAmount) - 1 }],
        })
        .expect(400);
    });

    it("rejects off-by-one-cent allocation (Decimal-strict)", async () => {
      const { user, company, customer, invoice } = await seedInvoiceContext();
      await request(app.getHttpServer())
        .post("/payments")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .send({
          contactId: customer.id,
          paymentMethod: "CASH",
          paymentDate: new Date().toISOString().slice(0, 10),
          totalAmount: Number(invoice.totalAmount),
          allocations: [
            {
              invoiceId: invoice.id,
              allocatedAmount: Number(invoice.totalAmount) - 0.01,
            },
          ],
        })
        .expect(400);
    });

    it("rejects allocation > balance_due", async () => {
      const { user, company, customer, invoice } = await seedInvoiceContext();
      await request(app.getHttpServer())
        .post("/payments")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .send({
          contactId: customer.id,
          paymentMethod: "CASH",
          paymentDate: new Date().toISOString().slice(0, 10),
          totalAmount: Number(invoice.totalAmount) + 100,
          allocations: [
            {
              invoiceId: invoice.id,
              allocatedAmount: Number(invoice.totalAmount) + 100,
            },
          ],
        })
        .expect(400);
    });

    it("rejects allocation to an invoice from a different contact", async () => {
      const { user, company, invoice } = await seedInvoiceContext();
      const otherCustomer = await givenACustomer(app, {
        token: user.accessToken,
        companyId: company.id,
        displayName: "Other Customer",
      });

      await request(app.getHttpServer())
        .post("/payments")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .send({
          contactId: otherCustomer.id,
          paymentMethod: "BANK_TRANSFER",
          paymentDate: new Date().toISOString().slice(0, 10),
          totalAmount: Number(invoice.totalAmount),
          allocations: [{ invoiceId: invoice.id, allocatedAmount: Number(invoice.totalAmount) }],
        })
        .expect(400);
    });
  });

  describe("Void", () => {
    it("restores invoice balance, soft-voids allocations, posts reversal JE", async () => {
      const { user, company, customer, invoice } = await seedInvoiceContext();
      const today = new Date().toISOString().slice(0, 10);

      const created = await request(app.getHttpServer())
        .post("/payments")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .send({
          contactId: customer.id,
          paymentMethod: "BANK_TRANSFER",
          paymentDate: today,
          totalAmount: Number(invoice.totalAmount),
          allocations: [{ invoiceId: invoice.id, allocatedAmount: Number(invoice.totalAmount) }],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/payments/${created.body.id}/void`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Company-Id", company.id)
        .expect(200);

      const prisma = getTestPrisma();
      // Invoice balance restored.
      const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(inv.status).toBe("ISSUED");
      expect(Number(inv.balanceDue)).toBeCloseTo(Number(invoice.totalAmount), 2);
      expect(Number(inv.paidAmount)).toBeCloseTo(0, 2);

      // Allocations soft-voided, not deleted.
      const allocations = await prisma.paymentAllocation.findMany({
        where: { paymentId: created.body.id },
      });
      expect(allocations).toHaveLength(1);
      expect(allocations[0].isVoided).toBe(true);
      expect(allocations[0].voidedAt).toBeTruthy();

      // Original entry still POSTED; reversal entry exists.
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: created.body.id },
      });
      expect(payment.status).toBe("VOID");
      const original = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: payment.postedJournalEntryId! },
      });
      expect(original.status).toBe("POSTED");
      expect(original.reversedByEntryId).toBe(payment.voidedJournalEntryId);
    });
  });
});
