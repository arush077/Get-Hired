import pg from "pg";
import { getConfig } from "../../config/env.js";

const { Pool } = pg;

let _pool = null;

export function getPool() {
  if (!_pool) {
    const config = getConfig();
    const url = new URL(config.DATABASE_URL);

    const isLocal =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";

    _pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ...(isLocal
        ? {}
        : {
            ssl: {
              rejectUnauthorized: false,
            },
          }),
    });

    _pool.on("error", (err) => {
      console.error("[db] unexpected pool error:", err.message);
    });
  }

  return _pool;
}

export async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
