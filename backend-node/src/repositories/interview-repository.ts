import { getPool } from "../infrastructure/db/pool.js";
import { withTransaction } from "../infrastructure/db/transaction.js";
import type { InterviewRepository } from "./base.js";
import { Interview } from "../models/interview.js";
import { Question } from "../models/question.js";
import { Answer } from "../models/answer.js";
import { AnswerStatus } from "../models/answer-status.js";
import { InterviewState } from "../models/interview-state.js";
import { InterviewMode } from "../models/interview-mode.js";
import { QuestionType } from "../models/question-type.js";
import { AnalysisStatus } from "../models/analysis-status.js";
import { TopicEntry } from "../models/topic.js";
import { TopicStatus } from "../models/topic-status.js";

function serializeTopicPlan(topics: TopicEntry[]): string {
  return JSON.stringify(
    topics.map((t) => ({
      id: t.id,
      label: t.label,
      source: t.source,
      primary_question: t.primaryQuestion,
      priority: t.priority,
      status: t.status,
      questions_asked: t.questionsAsked,
      exhaustion_reason: t.exhaustionReason,
    })),
  );
}

function deserializeTopicPlan(raw: string): TopicEntry[] {
  if (!raw) return [];
  const arr = JSON.parse(raw);
  return arr.map(
    (t: Record<string, unknown>) =>
      new TopicEntry({
        id: t.id as string,
        label: t.label as string,
        source: (t.source as string) || "",
        primaryQuestion: (t.primary_question as string) || "",
        priority: (t.priority as number) || 5,
        status: TopicStatus[(t.status as keyof typeof TopicStatus) || "AVAILABLE"],
        questionsAsked: (t.questions_asked as number) || 0,
        exhaustionReason: (t.exhaustion_reason as string) || null,
      }),
  );
}

export class PostgresInterviewRepository implements InterviewRepository {
  async save(interview: Interview): Promise<void> {
    await withTransaction(async (client) => {
      const existing = await client.query("SELECT id FROM interviews WHERE id = $1", [interview.id]);

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE interviews SET
            user_id = $1, candidate_name = $2, job_role = $3, interview_mode = $4,
            status = $5, resume_id = $6, resume_snapshot = $7, jd_snapshot = $8,
            current_question_index = $9, total_questions = $10, topic_plan = $11,
            current_topic_id = $12, analysis = $13, analysis_status = $14
           WHERE id = $15`,
          [
            interview.userId,
            interview.candidateName,
            interview.jobRole,
            interview.interviewMode,
            interview.status,
            interview.resumeId,
            interview.resumeSnapshot,
            interview.jdSnapshot,
            interview.currentQuestionIndex,
            interview.totalQuestions,
            serializeTopicPlan(interview.topicPlan),
            interview.currentTopicId,
            interview.analysis ? JSON.stringify(interview.analysis) : null,
            interview.analysisStatus,
            interview.id,
          ],
        );

        // Insert new questions
        for (const q of interview.questions) {
          await client.query(
            `INSERT INTO questions (id, interview_id, question_text, question_index, question_type, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [q.id, interview.id, q.text, q.order, q.questionType],
          );
        }

        // Insert/update answers
        for (const [idx, a] of Object.entries(interview.answers)) {
          const index = Number(idx);
          if (index < interview.questions.length) {
            const qId = interview.questions[index].id;
            await client.query(
              `INSERT INTO answers (id, interview_id, question_id, transcript, answer_status, created_at)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
               ON CONFLICT (interview_id, question_id) DO UPDATE
               SET transcript = $3, answer_status = $4`,
              [interview.id, qId, a.transcript, a.answerStatus || null],
            );
          }
        }
      } else {
        await client.query(
          `INSERT INTO interviews (id, user_id, candidate_name, job_role, interview_mode, status,
            resume_id, resume_snapshot, jd_snapshot, current_question_index, total_questions,
            topic_plan, current_topic_id, analysis, analysis_status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
          [
            interview.id,
            interview.userId,
            interview.candidateName,
            interview.jobRole,
            interview.interviewMode,
            interview.status,
            interview.resumeId,
            interview.resumeSnapshot,
            interview.jdSnapshot,
            interview.currentQuestionIndex,
            interview.totalQuestions,
            serializeTopicPlan(interview.topicPlan),
            interview.currentTopicId,
            interview.analysis ? JSON.stringify(interview.analysis) : null,
            interview.analysisStatus,
          ],
        );

        for (const q of interview.questions) {
          await client.query(
            `INSERT INTO questions (id, interview_id, question_text, question_index, question_type, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [q.id, interview.id, q.text, q.order, q.questionType],
          );
        }

        for (const [idx, a] of Object.entries(interview.answers)) {
          const index = Number(idx);
          if (index < interview.questions.length) {
            await client.query(
              `INSERT INTO answers (id, interview_id, question_id, transcript, answer_status, created_at)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
              [interview.id, interview.questions[index].id, a.transcript, a.answerStatus || null],
            );
          }
        }
      }
    });
  }

  async get(interviewId: string): Promise<Interview | null> {
    const pool = getPool();
    const result = await pool.query("SELECT * FROM interviews WHERE id = $1", [interviewId]);
    const row = result.rows[0];
    if (!row) return null;

    const [qResult, aResult] = await Promise.all([
      pool.query(
        "SELECT id, question_text, question_index, question_type FROM questions WHERE interview_id = $1 ORDER BY question_index",
        [interviewId],
      ),
      pool.query(
        "SELECT id, question_id, transcript, answer_status FROM answers WHERE interview_id = $1",
        [interviewId],
      ),
    ]);

    const questions = qResult.rows.map(
      (q: Record<string, unknown>) =>
        new Question({
          id: q.id as string,
          text: q.question_text as string,
          questionType: QuestionType[(q.question_type as keyof typeof QuestionType) || "PRIMARY"],
          order: q.question_index as number,
        }),
    );

    const qIdToIndex = new Map<string, number>();
    for (const q of questions) {
      qIdToIndex.set(q.id, q.order);
    }

    const answers: Record<number, Answer> = {};
    for (const a of aResult.rows) {
      const idx = qIdToIndex.get(a.question_id);
      if (idx !== undefined) {
        answers[idx] = new Answer({
          questionId: a.question_id,
          transcript: a.transcript || "",
          answerStatus: a.answer_status
            ? AnswerStatus[a.answer_status as keyof typeof AnswerStatus]
            : null,
        });
      }
    }

    const topicPlan = deserializeTopicPlan(row.topic_plan || "[]");

    return new Interview({
      id: row.id,
      userId: row.user_id,
      candidateName: row.candidate_name,
      jobRole: row.job_role,
      interviewMode: InterviewMode[row.interview_mode as keyof typeof InterviewMode] || InterviewMode.MIXED,
      status: InterviewState[row.status as keyof typeof InterviewState],
      resumeId: row.resume_id,
      resumeSnapshot: row.resume_snapshot || "",
      jdSnapshot: row.jd_snapshot || "",
      questions,
      answers,
      currentQuestionIndex: row.current_question_index,
      totalQuestions: row.total_questions,
      topicPlan,
      currentTopicId: row.current_topic_id,
      analysis: row.analysis ? JSON.parse(row.analysis) : null,
      analysisStatus:
        AnalysisStatus[row.analysis_status as keyof typeof AnalysisStatus] || AnalysisStatus.PENDING,
      createdAt: row.created_at,
    });
  }

  async listAll(): Promise<Interview[]> {
    const pool = getPool();
    const result = await pool.query("SELECT id FROM interviews");
    const interviews: Interview[] = [];
    for (const row of result.rows) {
      const interview = await this.get(row.id);
      if (interview) interviews.push(interview);
    }
    return interviews;
  }

  async delete(interviewId: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query("DELETE FROM interviews WHERE id = $1", [interviewId]);
    return (result.rowCount ?? 0) > 0;
  }
}
