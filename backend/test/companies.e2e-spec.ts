import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { givenAUser } from "./setup/fixtures";
import { createTestApp } from "./setup/test-app";
import { disconnectTestPrisma, getTestPrisma, resetTestDb } from "./setup/test-db";

describe("Companies (e2e)", () => {
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

  it("creates a company atomically with all seeded reference data", async () => {
    const user = await givenAUser(app);

    const res = await request(app.getHttpServer())
      .post("/companies")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ legalName: "Acme SHPK", legalForm: "SHPK" })
      .expect(201);

    const companyId = res.body.id as string;
    expect(res.body.legalName).toBe("Acme SHPK");
    expect(res.body.legalForm).toBe("SHPK");

    const prisma = getTestPrisma();

    // UserCompanyAccess: caller becomes owner + default.
    const access = await prisma.userCompanyAccess.findFirst({
      where: { companyId },
      include: { role: true },
    });
    expect(access?.role.code).toBe("owner");
    expect(access?.isDefault).toBe(true);

    // Document sequences: invoice + journal entry for current fiscal year.
    const sequences = await prisma.documentSequence.findMany({ where: { companyId } });
    const types = sequences.map((s) => s.documentType).sort();
    expect(types).toEqual(["INVOICE", "JOURNAL_ENTRY"]);

    // Chart of accounts seeded.
    const accounts = await prisma.account.findMany({ where: { companyId } });
    expect(accounts.length).toBeGreaterThanOrEqual(15);
    expect(accounts.find((a) => a.code === "1300" && a.isSystem)).toBeDefined();

    // Accounting periods generated.
    const periods = await prisma.accountingPeriod.findMany({ where: { companyId } });
    expect(periods).toHaveLength(12);

    // Company tax rates copied from system templates.
    const companyTaxRates = await prisma.taxRate.findMany({ where: { companyId } });
    expect(companyTaxRates.length).toBeGreaterThanOrEqual(3);

    // Account defaults populated (5 roles).
    const defaults = await prisma.companyAccountDefaults.findMany({ where: { companyId } });
    expect(defaults).toHaveLength(5);
    expect(defaults.map((d) => d.accountRole).sort()).toEqual(
      ["ACCOUNTS_RECEIVABLE", "BANK", "CASH", "SALES_REVENUE", "VAT_PAYABLE"].sort(),
    );

    // Audit log: COMPANY/CREATED.
    const audit = await prisma.auditLog.findFirst({
      where: { companyId, entityType: "COMPANY", action: "CREATED" },
    });
    expect(audit).toBeTruthy();
  });

  it("rolls back the whole creation if the owner role isn't seeded", async () => {
    const user = await givenAUser(app);
    const prisma = getTestPrisma();
    await prisma.role.deleteMany({ where: { code: "owner" } });

    const res = await request(app.getHttpServer())
      .post("/companies")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ legalName: "Should Fail", legalForm: "SHPK" });

    expect(res.status).toBeGreaterThanOrEqual(500);
    const companies = await prisma.company.findMany({ where: { legalName: "Should Fail" } });
    expect(companies).toHaveLength(0);
    const sequences = await prisma.documentSequence.findMany({});
    expect(sequences).toHaveLength(0);
  });

  it("GET /companies returns only the requester's companies", async () => {
    const alice = await givenAUser(app, { email: "alice@example.com" });
    const bob = await givenAUser(app, { email: "bob@example.com" });

    await request(app.getHttpServer())
      .post("/companies")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .send({ legalName: "Alice Co", legalForm: "SHPK" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/companies")
      .set("Authorization", `Bearer ${bob.accessToken}`)
      .send({ legalName: "Bob Co", legalForm: "BI" })
      .expect(201);

    const aliceList = await request(app.getHttpServer())
      .get("/companies")
      .set("Authorization", `Bearer ${alice.accessToken}`)
      .expect(200);
    expect(aliceList.body).toHaveLength(1);
    expect(aliceList.body[0].legalName).toBe("Alice Co");
  });

  it("PATCH /companies/:id updates fields and writes audit log", async () => {
    const user = await givenAUser(app);
    const create = await request(app.getHttpServer())
      .post("/companies")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ legalName: "Original", legalForm: "SHPK" })
      .expect(201);
    const companyId = create.body.id as string;

    await request(app.getHttpServer())
      .patch(`/companies/${companyId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ legalName: "Renamed" })
      .expect(200);

    const prisma = getTestPrisma();
    const fresh = await prisma.company.findUnique({ where: { id: companyId } });
    expect(fresh?.legalName).toBe("Renamed");

    const audit = await prisma.auditLog.findFirst({
      where: { companyId, entityType: "COMPANY", action: "UPDATED" },
    });
    expect(audit).toBeTruthy();
  });
});
