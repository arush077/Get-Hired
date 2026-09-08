import { describe, it, expect } from "vitest";
import {
  StartInterviewRequestSchema,
  StartInterviewResponseSchema,
  AnswerRequestSchema,
  AnswerResponseSchema,
  AnalysisResultSchema,
  QuestionFeedbackSchema,
  QuestionResultSchema,
  InterviewResultResponseSchema,
} from "../../src/schemas/interview.js";

describe("Interview schemas", () => {
  describe("StartInterviewRequestSchema", () => {
    const validBase = {
      candidate_name: "John Doe",
      job_role: "SDE-1",
      jd_text: "Looking for a software engineer...",
    };

    it("accepts resume_id only", () => {
      const result = StartInterviewRequestSchema.safeParse({
        ...validBase,
        resume_id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("accepts resume_text only", () => {
      const result = StartInterviewRequestSchema.safeParse({
        ...validBase,
        resume_text: "John Doe\nSoftware Engineer\n...",
      });
      expect(result.success).toBe(true);
    });

    it("rejects both resume_id and resume_text", () => {
      const result = StartInterviewRequestSchema.safeParse({
        ...validBase,
        resume_id: "550e8400-e29b-41d4-a716-446655440000",
        resume_text: "John Doe\n...",
      });
      expect(result.success).toBe(false);
    });

    it("rejects neither resume_id nor resume_text", () => {
      const result = StartInterviewRequestSchema.safeParse(validBase);
      expect(result.success).toBe(false);
    });

    it("applies defaults for total_questions and interview_mode", () => {
      const result = StartInterviewRequestSchema.safeParse({
        ...validBase,
        resume_text: "Resume content",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_questions).toBe(10);
        expect(result.data.interview_mode).toBe("MIXED");
      }
    });

    it("accepts custom total_questions and interview_mode", () => {
      const result = StartInterviewRequestSchema.safeParse({
        ...validBase,
        resume_text: "Resume content",
        total_questions: 5,
        interview_mode: "TECHNICAL",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_questions).toBe(5);
        expect(result.data.interview_mode).toBe("TECHNICAL");
      }
    });

    it("rejects invalid interview_mode", () => {
      const result = StartInterviewRequestSchema.safeParse({
        ...validBase,
        resume_text: "Resume",
        interview_mode: "INVALID",
      });
      expect(result.success).toBe(false);
    });

    it("accepts resume_id with null resume_text", () => {
      const result = StartInterviewRequestSchema.safeParse({
        ...validBase,
        resume_id: "550e8400-e29b-41d4-a716-446655440000",
        resume_text: null,
      });
      expect(result.success).toBe(true);
    });

    it("accepts resume_text with null resume_id", () => {
      const result = StartInterviewRequestSchema.safeParse({
        ...validBase,
        resume_id: null,
        resume_text: "Resume content",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("StartInterviewResponseSchema", () => {
    it("accepts valid payload", () => {
      const result = StartInterviewResponseSchema.safeParse({
        interview_id: "550e8400-e29b-41d4-a716-446655440000",
        total_questions: 10,
        question: "Tell me about yourself",
        question_index: 0,
        interview_mode: "MIXED",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("AnswerRequestSchema", () => {
    it("accepts valid payload", () => {
      const result = AnswerRequestSchema.safeParse({
        transcript: "I have 3 years of experience...",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing transcript", () => {
      const result = AnswerRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("QuestionFeedbackSchema", () => {
    it("accepts valid payload", () => {
      const result = QuestionFeedbackSchema.safeParse({
        question_number: 1,
        score: 80,
        what_went_well: "Clear answer",
        what_was_missing: "Trade-offs",
        how_to_improve: "Discuss alternatives",
      });
      expect(result.success).toBe(true);
    });

    it("applies defaults for optional fields", () => {
      const result = QuestionFeedbackSchema.safeParse({
        question_number: 1,
        score: 80,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.what_went_well).toBe("");
        expect(result.data.what_was_missing).toBe("");
        expect(result.data.how_to_improve).toBe("");
      }
    });

    it("rejects score > 100", () => {
      const result = QuestionFeedbackSchema.safeParse({
        question_number: 1,
        score: 150,
      });
      expect(result.success).toBe(false);
    });

    it("rejects score < 0", () => {
      const result = QuestionFeedbackSchema.safeParse({
        question_number: 1,
        score: -10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("AnalysisResultSchema", () => {
    it("accepts full payload", () => {
      const result = AnalysisResultSchema.safeParse({
        overall_score: 75,
        dimensions: { technical_depth: 80, clarity: 70 },
        strengths: ["Good examples"],
        areas_to_improve: ["More depth"],
        recurring_patterns: ["Pattern 1"],
        question_feedback: [
          {
            question_number: 1,
            score: 80,
            what_went_well: "Good",
            what_was_missing: "Missing",
            how_to_improve: "Improve",
          },
        ],
        recommendations: ["Practice X"],
        jd_match: { strengths: ["API"], gaps: ["DB"] },
      });
      expect(result.success).toBe(true);
    });

    it("applies defaults for missing optional fields", () => {
      const result = AnalysisResultSchema.safeParse({
        overall_score: 72,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dimensions).toEqual({});
        expect(result.data.strengths).toEqual([]);
        expect(result.data.areas_to_improve).toEqual([]);
        expect(result.data.recurring_patterns).toEqual([]);
        expect(result.data.question_feedback).toEqual([]);
        expect(result.data.recommendations).toEqual([]);
        expect(result.data.jd_match).toBeNull();
      }
    });

    it("clamps overall_score to 0-100", () => {
      expect(
        AnalysisResultSchema.safeParse({ overall_score: 150 }).success,
      ).toBe(false);
      expect(
        AnalysisResultSchema.safeParse({ overall_score: -5 }).success,
      ).toBe(false);
    });
  });

  describe("QuestionResultSchema", () => {
    it("accepts full payload", () => {
      const result = QuestionResultSchema.safeParse({
        question_index: 0,
        question: "Tell me about yourself",
        answer: "I am a software engineer...",
        question_type: "HR",
        topic_label: "Background",
        topic_source: "Candidate",
        answer_status: "ANSWERED",
      });
      expect(result.success).toBe(true);
    });

    it("applies defaults for optional fields", () => {
      const result = QuestionResultSchema.safeParse({
        question_index: 0,
        question: "Q1?",
        answer: "A1",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.question_type).toBeNull();
        expect(result.data.topic_label).toBeNull();
        expect(result.data.topic_source).toBeNull();
        expect(result.data.answer_status).toBeNull();
      }
    });
  });

  describe("AnswerResponseSchema", () => {
    it("accepts full payload", () => {
      const result = AnswerResponseSchema.safeParse({
        interview_id: "abc",
        question_index: 2,
        answered_count: 3,
        status: "WAITING_FOR_ANSWER",
        next_question: "Q3?",
        next_question_index: 2,
        total_questions: 10,
        is_clarification: false,
        next_action: "FOLLOW_UP",
        analysis: null,
      });
      expect(result.success).toBe(true);
    });

    it("applies defaults", () => {
      const result = AnswerResponseSchema.safeParse({
        interview_id: "abc",
        answered_count: 1,
        status: "COMPLETED",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.question_index).toBeNull();
        expect(result.data.next_question).toBeNull();
        expect(result.data.is_clarification).toBe(false);
        expect(result.data.analysis).toBeNull();
      }
    });
  });

  describe("InterviewResultResponseSchema", () => {
    it("accepts valid payload", () => {
      const result = InterviewResultResponseSchema.safeParse({
        interview_id: "abc",
        status: "COMPLETED",
        results: [
          {
            question_index: 0,
            question: "Q1?",
            answer: "A1",
            question_type: "HR",
            topic_label: "Background",
            topic_source: "Candidate",
            answer_status: "ANSWERED",
          },
        ],
        analysis: {
          overall_score: 75,
          dimensions: {},
          strengths: [],
          areas_to_improve: [],
          recurring_patterns: [],
          question_feedback: [],
          recommendations: [],
          jd_match: null,
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts null analysis", () => {
      const result = InterviewResultResponseSchema.safeParse({
        interview_id: "abc",
        status: "IN_PROGRESS",
        results: [],
        analysis: null,
      });
      expect(result.success).toBe(true);
    });
  });
});
