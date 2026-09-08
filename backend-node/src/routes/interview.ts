import { Router } from "express";
import { startInterview, submitAnswer, getResults } from "../controllers/interview-controller.js";

const router = Router();

router.post("/", startInterview);
router.post("/:interview_id/answers", submitAnswer);
router.get("/:interview_id/results", getResults);

export default router;
