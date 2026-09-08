import { describe, it, expect } from "vitest";
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  UserResponseSchema,
  AuthResponseSchema,
} from "../../src/api/schemas/auth.js";

describe("Auth schemas", () => {
  describe("RegisterRequestSchema", () => {
    it("accepts valid payload", () => {
      const result = RegisterRequestSchema.safeParse({
        name: "John",
        email: "john@example.com",
        password: "secret123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing name", () => {
      const result = RegisterRequestSchema.safeParse({
        email: "john@example.com",
        password: "secret123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing email", () => {
      const result = RegisterRequestSchema.safeParse({
        name: "John",
        password: "secret123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing password", () => {
      const result = RegisterRequestSchema.safeParse({
        name: "John",
        email: "john@example.com",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("LoginRequestSchema", () => {
    it("accepts valid payload", () => {
      const result = LoginRequestSchema.safeParse({
        email: "john@example.com",
        password: "secret123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing fields", () => {
      expect(LoginRequestSchema.safeParse({}).success).toBe(false);
      expect(LoginRequestSchema.safeParse({ email: "x" }).success).toBe(false);
      expect(LoginRequestSchema.safeParse({ password: "x" }).success).toBe(false);
    });
  });

  describe("UserResponseSchema", () => {
    it("accepts valid payload", () => {
      const result = UserResponseSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "John",
        email: "john@example.com",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("AuthResponseSchema", () => {
    it("accepts valid payload with nested user", () => {
      const result = AuthResponseSchema.safeParse({
        token: "eyJhbGciOiJIUzI1NiJ9...",
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "John",
          email: "john@example.com",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing user", () => {
      const result = AuthResponseSchema.safeParse({
        token: "abc",
      });
      expect(result.success).toBe(false);
    });
  });
});
