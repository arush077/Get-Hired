import type { Request, Response } from "express";
import { InterviewService } from "../services/interview-service.js";
import { PostgresInterviewRepository } from "../repositories/interview-repository.js";
import { QuestionPlanner } from "../services/question-planner.js";
import { LLMService } from "../services/llm-service.js";
import { ResumeService } from "../services/resume-service.js";
import { PostgresResumeRepository } from "../repositories/resume-repository.js";
import { StartInterviewRequestSchema, AnswerRequestSchema } from "../schemas/interview.js";
import { InterviewMode } from "../models/interview-mode.js";

function paramStr(val: unknown): string {
  return Array.isArray(val) ? val[0] : String(val);
}

const interviewService = new InterviewService(
  new PostgresInterviewRepository(),
  new LLMService(),
  new QuestionPlanner(),
);
const resumeService = new ResumeService(new PostgresResumeRepository());

export async function startInterview(req: Request, res: Response): Promise<void> {
  try {
    const parsed = StartInterviewRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ detail: parsed.error.issues });
      return;
    }

    const data = parsed.data;
    const userId = req.user?.id || null;

    const interview = await interviewService.startInterview({
      candidateName: data.candidate_name,
      jobRole: data.job_role,
      jdText: data.jd_text,
      totalQuestions: data.total_questions,
      interviewMode: InterviewMode[data.interview_mode as keyof typeof InterviewMode] || InterviewMode.MIXED,
      userId,
      resumeId: data.resume_id,
      resumeText: data.resume_text,
      getResumeText: async (resumeId, uid) => {
        const resume = await resumeService.getResume(resumeId, uid);
        return resume?.toText() || null;
      },
    });

    const question = interview.currentQuestion();
    res.json({
      interview_id: interview.id,
      total_questions: interview.totalQuestions,
      question: question?.text || "",
      question_index: 0,
      interview_mode: interview.interviewMode,
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message === "Resume not found" || message === "Resume text is required") {
      res.status(400).json({ detail: message });
      return;
    }
    if (message.includes("rate limited") || message.includes("429")) {
      res.status(429).json({ detail: "AI service rate limited. Please try again in a few minutes." });
      return;
    }
    res.status(500).json({ detail: message });
  }
}

export async function submitAnswer(req: Request, res: Response): Promise<void> {
  try {
    const interview_id = paramStr(req.params.interview_id);
    const parsed = AnswerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ detail: parsed.error.issues });
      return;
    }

    const interview = await interviewService.getInterview(interview_id);
    if (!interview) {
      res.status(404).json({ detail: "Interview not found" });
      return;
    }

    // Ownership check
    if (interview.userId && (!req.user || req.user.id !== interview.userId)) {
      res.status(403).json({ detail: "Not authorized to submit answers for this interview" });
      return;
    }

    const result = await interviewService.submitAnswer(interview, parsed.data.transcript);
    if (!result) {
      res.status(400).json({ detail: "Interview not found or invalid state" });
      return;
    }

    res.json(result);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("rate limited") || message.includes("429")) {
      res.status(429).json({ detail: "AI service rate limited. Please try again in a few minutes." });
      return;
    }
    res.status(500).json({ detail: message });
  }
}

export async function getResults(req: Request, res: Response): Promise<void> {
  try {
    const interview_id = paramStr(req.params.interview_id);

    const interview = await interviewService.getInterview(interview_id);
    if (!interview) {
      res.status(404).json({ detail: "Interview not found" });
      return;
    }

    // Ownership check
    if (interview.userId && (!req.user || req.user.id !== interview.userId)) {
      res.status(403).json({ detail: "Not authorized to view this interview" });
      return;
    }

    const results = await interviewService.getResults(interview_id);
    if (!results) {
      res.status(404).json({ detail: "Interview results not available" });
      return;
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ detail: (err as Error).message });
  }
}
