import type { INestApplication } from "@nestjs/common";
import request from "supertest";

let counter = 0;
const uniqueEmail = () => `e2e-${Date.now()}-${++counter}@example.com`;

export interface SeededUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export async function givenAUser(
  app: INestApplication,
  overrides: Partial<{ email: string; password: string; firstName: string; lastName: string }> = {},
): Promise<SeededUser> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? "Sup3rSecret!";
  await request(app.getHttpServer())
    .post("/auth/register")
    .send({
      firstName: overrides.firstName ?? "Test",
      lastName: overrides.lastName ?? "User",
      email,
      password,
    })
    .expect(201);
  const login = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email, password })
    .expect(200);
  return {
    id: login.body.userId ?? "", // login response doesn't include id; fetch /users/me below if needed
    email,
    password,
    accessToken: login.body.accessToken as string,
    refreshToken: login.body.refreshToken as string,
  };
}

export interface SeededCompany {
  id: string;
  legalName: string;
  ownerToken: string;
}

export async function givenACompany(
  app: INestApplication,
  opts: { ownerToken: string; legalName?: string; legalForm?: string },
): Promise<SeededCompany> {
  const legalName = opts.legalName ?? `Acme SHPK ${++counter}`;
  const res = await request(app.getHttpServer())
    .post("/companies")
    .set("Authorization", `Bearer ${opts.ownerToken}`)
    .send({ legalName, legalForm: opts.legalForm ?? "SHPK" })
    .expect(201);
  return { id: res.body.id, legalName, ownerToken: opts.ownerToken };
}

export interface SeededContact {
  id: string;
}

export async function givenACustomer(
  app: INestApplication,
  opts: { token: string; companyId: string; displayName?: string },
): Promise<SeededContact> {
  const res = await request(app.getHttpServer())
    .post("/contacts")
    .set("Authorization", `Bearer ${opts.token}`)
    .set("X-Company-Id", opts.companyId)
    .send({ displayName: opts.displayName ?? `Customer ${++counter}`, isCustomer: true })
    .expect(201);
  return { id: res.body.id };
}

export async function getDefaultTaxRate(
  app: INestApplication,
  opts: { token: string; companyId: string },
): Promise<{ id: string; rate: string }> {
  const res = await request(app.getHttpServer())
    .get("/tax-rates")
    .set("Authorization", `Bearer ${opts.token}`)
    .set("X-Company-Id", opts.companyId)
    .expect(200);
  const standard = res.body.find((t: { code: string }) => t.code === "VAT_STANDARD");
  if (!standard) throw new Error("Standard VAT rate not seeded into company");
  return standard;
}

export async function givenAnIssuedInvoice(
  app: INestApplication,
  opts: {
    token: string;
    companyId: string;
    contactId: string;
    /** Lines defaulted to a single $100 net line with 18% VAT. */
    quantity?: number;
    unitPrice?: number;
    issueDate?: string;
    taxRateId?: string;
  },
): Promise<{ id: string; invoiceNumber: string; totalAmount: string }> {
  const taxRateId = opts.taxRateId ?? (await getDefaultTaxRate(app, opts)).id;
  const today = new Date().toISOString().slice(0, 10);
  const draft = await request(app.getHttpServer())
    .post("/invoices")
    .set("Authorization", `Bearer ${opts.token}`)
    .set("X-Company-Id", opts.companyId)
    .send({
      contactId: opts.contactId,
      issueDate: opts.issueDate ?? today,
      dueDate: opts.issueDate ?? today,
      lines: [
        {
          description: "Consulting hours",
          quantity: opts.quantity ?? 1,
          unitPrice: opts.unitPrice ?? 100,
          taxRateId,
        },
      ],
    })
    .expect(201);

  const issued = await request(app.getHttpServer())
    .post(`/invoices/${draft.body.id}/issue`)
    .set("Authorization", `Bearer ${opts.token}`)
    .set("X-Company-Id", opts.companyId)
    .expect(200);
  return {
    id: issued.body.id,
    invoiceNumber: issued.body.invoiceNumber,
    totalAmount: issued.body.totalAmount,
  };
}
