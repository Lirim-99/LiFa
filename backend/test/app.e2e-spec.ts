import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./setup/test-app";
import { disconnectTestPrisma, resetTestDb } from "./setup/test-db";

describe("App smoke (e2e)", () => {
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

  it("GET /health returns ok", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("protected routes 401 without a JWT", async () => {
    await request(app.getHttpServer()).get("/users/me").expect(401);
  });
});
