import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getPool } from "../infrastructure/db/pool.js";
import { withTransaction } from "../infrastructure/db/transaction.js";
import { getConfig } from "../config/env.js";

const JWT_ALGORITHM = "HS256";
const JWT_EXPIRES_IN = "7d";
const BCRYPT_ROUNDS = 10;

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export class AuthService {
  private secret: string;

  constructor() {
    this.secret = getConfig().JWT_SECRET;
  }

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedName = name.trim();
    // Truncate password to 72 bytes (bcrypt limit)
    const hashedPassword = await bcrypt.hash(password.slice(0, 72), BCRYPT_ROUNDS);

    const result = await withTransaction(async (client) => {
      // Check for existing user
      const existing = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [normalizedEmail],
      );
      if (existing.rows.length > 0) {
        throw new Error("Email already registered");
      }

      // Insert new user
      const insertResult = await client.query(
        `INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         RETURNING id, name, email`,
        [trimmedName, normalizedEmail, hashedPassword],
      );

      return insertResult.rows[0];
    });

    const token = this.signToken(result.id, result.email);
    return {
      token,
      user: {
        id: result.id,
        name: result.name,
        email: result.email,
      },
    };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();

    const pool = getPool();
    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [normalizedEmail],
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error("Invalid credentials");
    }

    const valid = await bcrypt.compare(password.slice(0, 72), user.password_hash);
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    const token = this.signToken(user.id, user.email);
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async getUser(userId: string): Promise<{ id: string; name: string; email: string } | null> {
    const pool = getPool();
    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [userId],
    );

    const user = result.rows[0];
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  verifyToken(token: string): AuthUser | null {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: [JWT_ALGORITHM],
      }) as { sub?: string; email?: string };

      if (!payload.sub) return null;

      return {
        id: payload.sub,
        email: payload.email ?? "",
      };
    } catch {
      return null;
    }
  }

  async ensureUserExists(userId: string, email?: string): Promise<void> {
    await withTransaction(async (client) => {
      const existing = await client.query(
        "SELECT id FROM users WHERE id = $1",
        [userId],
      );
      if (existing.rows.length > 0) return;

      await client.query(
        `INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, 'local-only', NOW(), NOW())`,
        [userId, "Local User", email ?? `${userId}@local.dev`],
      );
    });
  }

  private signToken(userId: string, email: string): string {
    return jwt.sign(
      { sub: userId, email },
      this.secret,
      { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRES_IN },
    );
  }
}
