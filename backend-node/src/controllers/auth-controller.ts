import type { Request, Response } from "express";
import { AuthService } from "../services/auth-service.js";
import {
  RegisterRequestSchema,
  LoginRequestSchema,
} from "../schemas/auth.js";

const authService = new AuthService();

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = RegisterRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ detail: parsed.error.issues });
    return;
  }

  try {
    const result = await authService.register(
      parsed.data.name,
      parsed.data.email,
      parsed.data.password,
    );
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Email already registered") {
      res.status(409).json({ detail: message });
      return;
    }
    res.status(500).json({ detail: message });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = LoginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ detail: parsed.error.issues });
    return;
  }

  try {
    const result = await authService.login(
      parsed.data.email,
      parsed.data.password,
    );
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Invalid credentials") {
      res.status(401).json({ detail: message });
      return;
    }
    res.status(500).json({ detail: message });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ detail: "Not authenticated" });
    return;
  }

  const user = await authService.getUser(req.user.id);
  if (!user) {
    res.status(404).json({ detail: "User not found" });
    return;
  }

  res.status(200).json(user);
}
