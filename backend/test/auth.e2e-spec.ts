import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./setup/test-app";
import { disconnectTestPrisma, resetTestDb } from "./setup/test-db";

describe("Auth (e2e)", () => {
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

  const validBody = {
    firstName: "Lirim",
    lastName: "H",
    email: "lirim@example.com",
    password: "Sup3rSecret!",
  };

  describe("POST /auth/register", () => {
    it("creates a user and returns id + email", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/register")
        .send(validBody)
        .expect(201);
      expect(res.body.email).toBe(validBody.email);
      expect(typeof res.body.id).toBe("string");
    });

    it("rejects duplicate email with 409", async () => {
      await request(app.getHttpServer()).post("/auth/register").send(validBody).expect(201);
      await request(app.getHttpServer()).post("/auth/register").send(validBody).expect(409);
    });

    it("rejects weak password with 400", async () => {
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({ ...validBody, password: "short" })
        .expect(400);
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post("/auth/register").send(validBody).expect(201);
    });

    it("returns access + refresh tokens for valid credentials", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: validBody.email, password: validBody.password })
        .expect(200);
      expect(typeof res.body.accessToken).toBe("string");
      expect(typeof res.body.refreshToken).toBe("string");
      expect(res.body.expiresIn).toBeGreaterThan(0);
    });

    it("returns 401 for wrong password", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: validBody.email, password: "wrong" })
        .expect(401);
    });

    it("returns 401 for unknown email (no enumeration leak)", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "ghost@example.com", password: "whatever12" })
        .expect(401);
    });
  });

  describe("POST /auth/refresh", () => {
    it("trades a refresh token for a fresh access token", async () => {
      await request(app.getHttpServer()).post("/auth/register").send(validBody).expect(201);
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: validBody.email, password: validBody.password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: login.body.refreshToken })
        .expect(200);
      expect(typeof res.body.accessToken).toBe("string");
      expect(res.body.accessToken).not.toBe(login.body.accessToken);
    });

    it("rejects an access token used as refresh (type mismatch)", async () => {
      await request(app.getHttpServer()).post("/auth/register").send(validBody).expect(201);
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: validBody.email, password: validBody.password })
        .expect(200);

      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: login.body.accessToken })
        .expect(401);
    });
  });

  describe("Protected routes", () => {
    it("/users/me returns 401 without token, 200 with valid JWT", async () => {
      await request(app.getHttpServer()).get("/users/me").expect(401);

      await request(app.getHttpServer()).post("/auth/register").send(validBody).expect(201);
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: validBody.email, password: validBody.password })
        .expect(200);

      const me = await request(app.getHttpServer())
        .get("/users/me")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .expect(200);
      expect(me.body.email).toBe(validBody.email);
    });
  });
});
