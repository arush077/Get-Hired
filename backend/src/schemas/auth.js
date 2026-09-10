import { z } from "zod";

// ── Auth ────────────────────────────────────────────────────────

export const RegisterRequestSchema = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
});

export const LoginRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
});

export const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserResponseSchema,
});
