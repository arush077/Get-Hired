import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-secret-for-auth";
  process.env.GROQ_API_KEY = "test-key";
});

const hasDb = !!process.env.DATABASE_URL?.includes("localhost");

describe.skipIf(!hasDb)("Auth routes", () => {
  describe("POST /api/auth/register", () => {
    it("returns 422 for missing fields", async () => {
      const { createApp } = await import("../../src/app.js");
      const app = createApp();
      const res = await request(app)
        .post("/api/auth/register")
        .send({});
      expect(res.status).toBe(422);
    });

    it("returns 201 for valid registration", async () => {
      const { createApp } = await import("../../src/app.js");
      const app = createApp();
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: `test-${Date.now()}@example.com`,
          password: "password123",
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user.name).toBe("Test User");
    });

    it("returns 409 for duplicate email", async () => {
      const { createApp } = await import("../../src/app.js");
      const app = createApp();
      const email = `dup-${Date.now()}@example.com`;
      await request(app)
        .post("/api/auth/register")
        .send({ name: "First", email, password: "pass123" });
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Second", email, password: "pass456" });
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns 422 for missing fields", async () => {
      const { createApp } = await import("../../src/app.js");
      const app = createApp();
      const res = await request(app)
        .post("/api/auth/login")
        .send({});
      expect(res.status).toBe(422);
    });

    it("returns 401 for invalid credentials", async () => {
      const { createApp } = await import("../../src/app.js");
      const app = createApp();
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "wrongpassword",
        });
      expect(res.status).toBe(401);
      expect(res.body.detail).toBe("Invalid credentials");
    });

    it("returns 200 for valid login", async () => {
      const { createApp } = await import("../../src/app.js");
      const app = createApp();
      const email = `login-${Date.now()}@example.com`;
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Login User", email, password: "mypassword" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "mypassword" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.email).toBe(email);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns 401 without token", async () => {
      const { createApp } = await import("../../src/app.js");
      const app = createApp();
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      const { createApp } = await import("../../src/app.js");
      const app = createApp();
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");
      expect(res.status).toBe(401);
    });

    it("returns 200 with valid token", async () => {
      const { createApp } = await import("../../src/app.js");
      const app = createApp();
      const email = `me-${Date.now()}@example.com`;
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({ name: "Me User", email, password: "pass123" });
      const token = registerRes.body.token;
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(email);
      expect(res.body.name).toBe("Me User");
    });
  });

  describe("GET /health (unaffected by auth)", () => {
    it("returns 200 without auth", async () => {
      const { createApp } = await import("../../src/app.js");
      const app = createApp();
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });
});
