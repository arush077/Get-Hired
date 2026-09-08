import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-secret";
  process.env.GROQ_API_KEY = "test-key";
});

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const { createApp } = await import("../src/app.js");
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "gethired" });
  });
});
