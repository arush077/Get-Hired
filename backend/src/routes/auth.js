import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, getMe } from "../controllers/auth-controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

function authKeyGenerator(req) {
  return (req.body?.email || "no-email").toLowerCase();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: authKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many login attempts. Please try again later." },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: authKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many registration attempts. Please try again later." },
});

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.get("/me", authMiddleware, getMe);

export default router;
