import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withTransaction } from "../src/infrastructure/db/transaction.js";
import { getPool, closePool } from "../src/infrastructure/db/pool.js";

// These tests require a running PostgreSQL instance.
// Run with: DATABASE_URL=postgresql://... npm test

const hasDb = !!process.env.DATABASE_URL?.includes("localhost");

describe.skipIf(!hasDb)("withTransaction", () => {
  beforeAll(() => {
    process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/gethired";
    process.env.JWT_SECRET ??= "test";
    process.env.GROQ_API_KEY ??= "test";
  });

  afterAll(async () => {
    await closePool();
  });

  it("commits on success", async () => {
    const result = await withTransaction(async (client) => {
      const res = await client.query("SELECT 1 AS num");
      return res.rows[0].num;
    });
    expect(result).toBe(1);
  });

  it("rolls back on error", async () => {
    await expect(
      withTransaction(async (_client) => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("provides a working client", async () => {
    const result = await withTransaction(async (client) => {
      const res = await client.query("SELECT NOW() AS now");
      expect(res.rows[0].now).toBeInstanceOf(Date);
      return true;
    });
    expect(result).toBe(true);
  });
});
