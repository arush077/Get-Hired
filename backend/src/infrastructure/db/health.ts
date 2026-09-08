import { getPool } from "./pool.js";

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
