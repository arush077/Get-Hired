import { z } from "zod";

// ── Enums ───────────────────────────────────────────────────────

const InterviewModeEnum = z.enum([
  "RESUME_DEEP_DIVE",
  "TECHNICAL",
  "HR_SCREENING",
  "MIXED",
]);

// ── Start Interview ─────────────────────────────────────────────

export const StartInterviewRequestSchema = z
  .object({
    candidate_name: z.string(),
    job_role: z.string(),
    resume_id: z.string().nullable().optional(),
    resume_text: z.string().nullable().optional(),
    jd_text: z.string(),
    total_questions: z.number().int().positive().default(10),
    interview_mode: InterviewModeEnum.default("MIXED"),
  })
  .refine(
    (data) => {
      const hasResumeId = !!data.resume_id;
      const hasResumeText = !!data.resume_text;
      return hasResumeId !== hasResumeText;
    },
    {
      message: "Either resume_id or resume_text is required, but not both",
    },
  );

export const StartInterviewResponseSchema = z.object({
  interview_id: z.string(),
  total_questions: z.number().int(),
  question: z.string(),
  question_index: z.number().int(),
  interview_mode: z.string(),
});

// ── Answer ──────────────────────────────────────────────────────

export const AnswerRequestSchema = z.object({
  transcript: z.string(),
});

// ── Analysis nested schemas ─────────────────────────────────────

export const QuestionFeedbackSchema = z.object({
  question_number: z.number().int(),
  score: z.number().int().min(0).max(100),
  what_went_well: z.string().default(""),
  what_was_missing: z.string().default(""),
  how_to_improve: z.string().default(""),
});

export const JdMatchSchema = z.object({
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
});

export const AnalysisResultSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  dimensions: z.record(z.string(), z.number().int()).default({}),
  strengths: z.array(z.string()).default([]),
  areas_to_improve: z.array(z.string()).default([]),
  recurring_patterns: z.array(z.string()).default([]),
  question_feedback: z.array(QuestionFeedbackSchema).default([]),
  recommendations: z.array(z.string()).default([]),
  jd_match: JdMatchSchema.nullable().default(null),
});

// ── Answer Response ─────────────────────────────────────────────

export const AnswerResponseSchema = z.object({
  interview_id: z.string(),
  question_index: z.number().int().nullable().default(null),
  answered_count: z.number().int(),
  status: z.string(),
  next_question: z.string().nullable().default(null),
  next_question_index: z.number().int().nullable().default(null),
  total_questions: z.number().int().nullable().default(null),
  is_clarification: z.boolean().default(false),
  next_action: z.string().nullable().default(null),
  analysis: AnalysisResultSchema.nullable().default(null),
});

// ── Interview Results ───────────────────────────────────────────

export const QuestionResultSchema = z.object({
  question_index: z.number().int(),
  question: z.string(),
  answer: z.string(),
  question_type: z.string().nullable().default(null),
  topic_label: z.string().nullable().default(null),
  topic_source: z.string().nullable().default(null),
  answer_status: z.string().nullable().default(null),
});

export const InterviewResultResponseSchema = z.object({
  interview_id: z.string(),
  status: z.string(),
  results: z.array(QuestionResultSchema),
  analysis: AnalysisResultSchema.nullable().default(null),
});
