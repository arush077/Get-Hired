import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth-service.js";
import type { AuthUser } from "../services/auth-service.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const authService = new AuthService();

const PUBLIC_PATHS = new Set([
  "/",
  "/health",
  "/api/auth/login",
  "/api/auth/register",
]);

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (PUBLIC_PATHS.has(req.path)) {
    return next();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Not authenticated" });
    return;
  }

  const token = header.slice(7);
  const user = authService.verifyToken(token);
  if (!user) {
    res.status(401).json({ detail: "Invalid or expired token" });
    return;
  }

  req.user = user;
  next();
}
