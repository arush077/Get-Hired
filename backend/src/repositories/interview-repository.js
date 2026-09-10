import { getPool } from "../infrastructure/db/pool.js";
import { withTransaction } from "../infrastructure/db/transaction.js";
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

function serializeTopicPlan(topics) {
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

function deserializeTopicPlan(raw) {
  if (!raw) return [];
  const arr = JSON.parse(raw);
  return arr.map(
    (t) =>
      new TopicEntry({
        id: t.id,
        label: t.label,
        source: t.source || "",
        primaryQuestion: t.primary_question || "",
        priority: t.priority || 5,
        status: TopicStatus[t.status || "AVAILABLE"],
        questionsAsked: t.questions_asked || 0,
        exhaustionReason: t.exhaustion_reason || null,
      }),
  );
}

export class PostgresInterviewRepository {
  async save(interview) {
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

        const qIds = interview.questions.map((q) => q.id);
        const existingQResult = await client.query(
          "SELECT id FROM questions WHERE interview_id = $1 AND id = ANY($2)",
          [interview.id, qIds],
        );
        const existingQIds = new Set(existingQResult.rows.map((r) => r.id));

        for (const q of interview.questions) {
          if (!existingQIds.has(q.id)) {
            await client.query(
              `INSERT INTO questions (id, interview_id, question_text, question_index, question_type, created_at)
               VALUES ($1, $2, $3, $4, $5, NOW())`,
              [q.id, interview.id, q.text, q.order, q.questionType],
            );
          }
        }

        const answerQIds = Object.entries(interview.answers)
          .filter(([idx]) => Number(idx) < interview.questions.length)
          .map(([idx]) => interview.questions[Number(idx)].id);
        const existingAResult = await client.query(
          "SELECT question_id FROM answers WHERE interview_id = $1 AND question_id = ANY($2)",
          [interview.id, answerQIds],
        );
        const existingAnswerQIds = new Set(existingAResult.rows.map((r) => r.question_id));

        for (const [idx, a] of Object.entries(interview.answers)) {
          const index = Number(idx);
          if (index < interview.questions.length) {
            const qId = interview.questions[index].id;
            if (existingAnswerQIds.has(qId)) {
              await client.query(
                "UPDATE answers SET transcript = $1, answer_status = $2 WHERE interview_id = $3 AND question_id = $4",
                [a.transcript, a.answerStatus || null, interview.id, qId],
              );
            } else {
              await client.query(
                `INSERT INTO answers (id, interview_id, question_id, transcript, answer_status, created_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
                [interview.id, qId, a.transcript, a.answerStatus || null],
              );
            }
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

  async get(interviewId) {
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
      (q) =>
        new Question({
          id: q.id,
          text: q.question_text,
          questionType: QuestionType[q.question_type || "PRIMARY"],
          order: q.question_index,
        }),
    );

    const qIdToIndex = new Map();
    for (const q of questions) {
      qIdToIndex.set(q.id, q.order);
    }

    const answers = {};
    for (const a of aResult.rows) {
      const idx = qIdToIndex.get(a.question_id);
      if (idx !== undefined) {
        answers[idx] = new Answer({
          questionId: a.question_id,
          transcript: a.transcript || "",
          answerStatus: a.answer_status
            ? AnswerStatus[a.answer_status]
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
      interviewMode: InterviewMode[row.interview_mode] || InterviewMode.MIXED,
      status: InterviewState[row.status],
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
        AnalysisStatus[row.analysis_status] || AnalysisStatus.PENDING,
      createdAt: row.created_at,
    });
  }

  async listAll() {
    const pool = getPool();
    const result = await pool.query("SELECT id FROM interviews");
    const interviews = [];
    for (const row of result.rows) {
      const interview = await this.get(row.id);
      if (interview) interviews.push(interview);
    }
    return interviews;
  }

  async delete(interviewId) {
    const pool = getPool();
    const result = await pool.query("DELETE FROM interviews WHERE id = $1", [interviewId]);
    return (result.rowCount ?? 0) > 0;
  }
}
