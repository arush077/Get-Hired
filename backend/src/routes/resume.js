import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { SlidingWindowStore } from "../middleware/sliding-window-store.js";
import {
  listResumes,
  createResume,
  importResume,
  getResume,
  updateResume,
  deleteResume,
  generateDescription,
  analyzeResume,
} from "../controllers/resume-controller.js";

const router = Router();

function userKey(req) {
  return req.user?.id || ipKeyGenerator(req) || "unknown";
}

const analyzeLimiter = rateLimit({
  windowMs: 60_000,
  max: 1,
  store: new SlidingWindowStore(60_000),
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Rate limit exceeded. Please try again later." },
});

const generateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  store: new SlidingWindowStore(60_000),
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Rate limit exceeded. Please try again later." },
});

router.get("/", listResumes);
router.post("/", createResume);
router.post("/import", importResume);
router.get("/:resume_id", getResume);
router.put("/:resume_id", updateResume);
router.delete("/:resume_id", deleteResume);
router.post("/ai/generate", generateLimiter, generateDescription);
router.post("/ai/analyze", analyzeLimiter, analyzeResume);

export default router;
