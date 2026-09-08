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

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
