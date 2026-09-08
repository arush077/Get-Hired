import { Router } from "express";
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

router.get("/", listResumes);
router.post("/", createResume);
router.post("/import", importResume);
router.get("/:resume_id", getResume);
router.put("/:resume_id", updateResume);
router.delete("/:resume_id", deleteResume);
router.post("/ai/generate", generateDescription);
router.post("/ai/analyze", analyzeResume);

export default router;
