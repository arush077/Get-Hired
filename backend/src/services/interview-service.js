import { Interview } from "../models/interview.js";
import { Question } from "../models/question.js";
import { QuestionType } from "../models/question-type.js";
import { Answer } from "../models/answer.js";
import { AnswerStatus } from "../models/answer-status.js";
import { InterviewState } from "../models/interview-state.js";
import { TopicStatus } from "../models/topic-status.js";
import { AnalysisStatus } from "../models/analysis-status.js";
import { QuestionPlanner, MAX_QUESTIONS_PER_TOPIC } from "./question-planner.js";
import { buildTopicPlan } from "./topic-planner.js";
import { InterviewStrategyFactory } from "./strategies/factory.js";
import { AnalysisService } from "./analysis-service.js";
import { getLogger } from "../logging/logger.js";
import { sendInterviewResultsEmail } from "./mail-service.js";
import { AuthService } from "./auth-service.js";

const MAX_ANALYSIS_RETRIES = 2;

export class InterviewService {
  constructor(repository, llm, planner) {
    this.repository = repository;
    this.llm = llm;
    this.planner = planner;
    this.analysisLocks = new Map();
  }

  async startInterview(params) {
    const {
      candidateName,
      jobRole,
      jdText,
      totalQuestions = 10,
      interviewMode = (await import("../models/interview-mode.js")).InterviewMode.MIXED,
      userId = null,
      resumeId = null,
      resumeText = null,
      getResumeText,
    } = params;

    let resolvedResumeId = null;
    let resolvedResumeText = resumeText;

    if (resumeId && getResumeText) {
      resolvedResumeId = resumeId;
      const text = await getResumeText(resumeId, userId || "");
      if (!text) throw new Error("Resume not found");
      resolvedResumeText = text;
    }

    if (!resolvedResumeText) {
      throw new Error("Resume text is required");
    }

    const interview = new Interview({
      userId,
      candidateName,
      jobRole,
      interviewMode,
      totalQuestions,
      resumeId: resolvedResumeId,
      resumeSnapshot: resolvedResumeText,
      jdSnapshot: jdText,
    });

    const strategy = InterviewStrategyFactory.get(interviewMode);

    const topicPlan = await buildTopicPlan({
      resumeText: resolvedResumeText,
      jdText,
      jobRole,
      llm: this.llm,
      totalQuestions,
      strategy,
    });

    interview.topicPlan = topicPlan;
    interview.currentTopicId = topicPlan.length > 0 ? topicPlan[0].id : null;

    this.planner.resetEmbeddings();

    const firstTopic = topicPlan.length > 0 ? topicPlan[0] : null;
    let questionText;
    let qType;

    if (firstTopic) {
      questionText = firstTopic.primaryQuestion;
      qType = QuestionType.PRIMARY;
    } else {
      questionText = await this.llm.generateHrQuestion(candidateName, jobRole, "introductory");
      qType = QuestionType.HR;
    }

    interview.questions.push(new Question({ text: questionText, questionType: qType, order: 0 }));

    interview.status = InterviewState.IN_PROGRESS;
    interview.status = InterviewState.WAITING_FOR_ANSWER;

    await this.repository.save(interview);
    return interview;
  }

  async getInterview(interviewId) {
    return this.repository.get(interviewId);
  }

  async submitAnswer(interview, transcript) {
    if (interview.status !== InterviewState.WAITING_FOR_ANSWER) {
      return null;
    }

    const answer = new Answer({ transcript });
    interview.submitAnswer(answer);

    const currentQ = interview.questions.length > 0 ? interview.questions[interview.questions.length - 1] : null;
    const currentTopic = this.getCurrentTopic(interview);

    const strategy = InterviewStrategyFactory.get(interview.interviewMode);

    const result = await this.llm.classifyAndDecide({
      resumeText: interview.resumeSnapshot,
      jdText: interview.jdSnapshot,
      jobRole: interview.jobRole,
      currentTopicLabel: currentTopic?.label || "",
      currentTopicSource: currentTopic?.source || "",
      currentQuestion: currentQ?.text || "",
      candidateAnswer: transcript,
      questionsOnTopic: currentTopic?.questionsAsked || 0,
      topicsRemaining: interview.topicPlan
        .filter((t) => t.status === TopicStatus.AVAILABLE)
        .map((t) => t.label),
      interviewHistory: this.buildPreviousQa(interview),
      previouslyAskedQuestions: interview.questions.map((q) => q.text),
      strategy,
    });

    const enforced = this.planner.applyHardRules({
      classification: result,
      topicPlan: interview.topicPlan,
      currentTopic,
      questionsAnswered: interview.answeredCount,
      totalQuestions: interview.totalQuestions,
    });

    answer.answerStatus = AnswerStatus[enforced.answerStatus] || null;

    getLogger().info(
      { status: enforced.answerStatus, action: enforced.nextAction, topic: currentTopic?.label },
      "[INTERVIEW] Answer classified",
    );

    if (enforced.nextAction === "CLARIFY") {
      interview.status = InterviewState.WAITING_FOR_ANSWER;
      await this.repository.save(interview);
      return {
        interview_id: interview.id,
        question_index: interview.currentQuestionIndex,
        answered_count: interview.answeredCount,
        status: interview.status,
        next_question: enforced.clarificationText || (currentQ?.text || ""),
        next_question_index: interview.currentQuestionIndex,
        total_questions: interview.totalQuestions,
        is_clarification: true,
        next_action: "CLARIFY",
        analysis: null,
      };
    }

    if (enforced.nextAction === "NEW_TOPIC" && currentTopic) {
      if (currentTopic.status !== TopicStatus.EXHAUSTED) {
        currentTopic.status = TopicStatus.EXHAUSTED;
        currentTopic.exhaustionReason =
          enforced.answerStatus === "DOES_NOT_KNOW" ? "DOES_NOT_KNOW" : "SUFFICIENTLY_EXPLORED";
      }
    }

    if (currentTopic) {
      currentTopic.questionsAsked += 1;
    }

    let isComplete = false;
    if (interview.answeredCount < interview.totalQuestions) {
      let questionText;
      let qType;

      if (enforced.nextAction === "NEW_TOPIC") {
        const nextTopic = this.planner.selectTopic(interview.topicPlan, enforced.nextTopicId);
        if (nextTopic) {
          interview.currentTopicId = nextTopic.id;
          questionText = nextTopic.primaryQuestion;
          qType = QuestionType.PRIMARY;
        } else {
          questionText = "Can you tell me more about your experience?";
          qType = QuestionType.PRIMARY;
        }
      } else if (enforced.question) {
        questionText = enforced.question;
        qType = QuestionType.FOLLOW_UP;
      } else {
        questionText = "Can you tell me more about your experience?";
        qType = QuestionType.PRIMARY;
      }

      const newIndex = interview.questions.length;
      interview.questions.push(new Question({ text: questionText, questionType: qType, order: newIndex }));
      interview.advance();
    } else {
      interview.status = InterviewState.COMPLETED;
      isComplete = true;
    }

    await this.repository.save(interview);

    if (interview.status === InterviewState.COMPLETED && interview.analysis === null) {
      this.runAnalysis(interview.id).catch((err) =>
        getLogger().error({ error: err.message }, "[INTERVIEW] Background analysis failed"),
      );
    }

    const q = interview.questions.length > 0 ? interview.questions[interview.questions.length - 1] : null;
    return {
      interview_id: interview.id,
      question_index: isComplete ? null : interview.currentQuestionIndex,
      answered_count: interview.answeredCount,
      status: interview.status,
      next_question: isComplete ? null : (q?.text || null),
      next_question_index: isComplete ? null : interview.currentQuestionIndex,
      total_questions: interview.totalQuestions,
      is_clarification: false,
      next_action: isComplete ? null : enforced.nextAction,
      analysis: interview.analysis,
    };
  }

  async getResults(interviewId) {
    const interview = await this.repository.get(interviewId);
    if (!interview) return null;

    if (interview.status === InterviewState.COMPLETED && interview.analysis === null) {
      getLogger().info(
        { interviewId, analysisStatus: interview.analysisStatus },
        "[INTERVIEW] Analysis missing, attempting generation",
      );

      if (interview.analysisStatus === AnalysisStatus.PROCESSING) {
        for (let i = 0; i < 90; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const refreshed = await this.repository.get(interviewId);
          if (refreshed && refreshed.analysis !== null) {
            return this.buildResultsResponse(refreshed);
          }
        }
        getLogger().warn({ interviewId }, "[INTERVIEW] Timed out waiting for background analysis");
      } else {
        const lockKey = interviewId;
        if (!this.analysisLocks.get(lockKey)) {
          this.analysisLocks.set(lockKey, true);
          try {
            const refreshed = await this.repository.get(interviewId);
            if (
              refreshed &&
              refreshed.analysis === null &&
              refreshed.status === InterviewState.COMPLETED &&
              refreshed.analysisStatus !== AnalysisStatus.PROCESSING
            ) {
              getLogger().info({ interviewId }, "[INTERVIEW] Starting on-demand analysis");
              await this.generateAnalysisSync(refreshed);
              getLogger().info(
                { interviewId, hasAnalysis: refreshed.analysis !== null },
                "[INTERVIEW] On-demand analysis finished",
              );
              return this.buildResultsResponse(refreshed);
            }
          } catch (err) {
            getLogger().error(
              { interviewId, error: err.message },
              "[INTERVIEW] On-demand analysis failed in getResults",
            );
          } finally {
            this.analysisLocks.delete(lockKey);
          }
        } else {
          getLogger().info({ interviewId }, "[INTERVIEW] Analysis lock held, returning without analysis");
        }
      }
    }

    return this.buildResultsResponse(interview);
  }

  buildResultsResponse(interview) {
    const topicMap = this.buildTopicMap(interview);

    const results = interview.questions.map((question, i) => {
      const answer = interview.answers[i];
      const [topicLabel, topicSource] = topicMap.get(i) || ["", ""];
      return {
        question_index: i,
        question: question.text,
        answer: answer?.transcript || "(no answer captured)",
        question_type: question.questionType,
        topic_label: topicLabel,
        topic_source: topicSource,
        answer_status: answer?.answerStatus || null,
      };
    });

    return {
      interview_id: interview.id,
      status: interview.status,
      results,
      analysis: interview.analysis,
    };
  }

  async generateAnalysisSync(interview) {
    try {
      interview.analysisStatus = AnalysisStatus.PROCESSING;
      await this.repository.save(interview);

      const analysisService = new AnalysisService(this.llm);
      getLogger().info(
        { interviewId: interview.id, questionCount: interview.questions.length },
        "[INTERVIEW] Starting on-demand analysis",
      );
      interview.analysis = await analysisService.analyze(interview);
      interview.analysisStatus = AnalysisStatus.COMPLETED;
      await this.repository.save(interview);
      this.sendResultsEmail(interview).catch(() => {});
    } catch (err) {
      getLogger().error({ error: err.message }, "[INTERVIEW] On-demand analysis failed");
      try {
        interview.analysisStatus = AnalysisStatus.FAILED;
        await this.repository.save(interview);
      } catch {
        // ignore save errors
      }
    }
  }

  async runAnalysis(interviewId) {
    for (let attempt = 0; attempt <= MAX_ANALYSIS_RETRIES; attempt++) {
      try {
        const interview = await this.repository.get(interviewId);
        if (!interview || interview.analysis !== null) return;

        interview.analysisStatus = AnalysisStatus.PROCESSING;
        await this.repository.save(interview);

        const analysisService = new AnalysisService(this.llm);
        interview.analysis = await analysisService.analyze(interview);
        interview.analysisStatus = AnalysisStatus.COMPLETED;
        await this.repository.save(interview);
        getLogger().info({ interviewId }, "[INTERVIEW] Background analysis completed");
        this.sendResultsEmail(interview).catch(() => {});
        return;
      } catch (err) {
        getLogger().warn(
          { attempt: attempt + 1, interviewId, error: err.message },
          "[INTERVIEW] Analysis attempt failed",
        );
        if (attempt < MAX_ANALYSIS_RETRIES) {
          await new Promise((r) => setTimeout(r, 2 ** (attempt + 1) * 1000));
        }
      }
    }

    try {
      const interview = await this.repository.get(interviewId);
      if (interview) {
        interview.analysisStatus = AnalysisStatus.FAILED;
        await this.repository.save(interview);
      }
    } catch {
      // ignore
    }
    getLogger().error({ interviewId }, "[INTERVIEW] Background analysis ultimately failed");
  }

  getCurrentTopic(interview) {
    if (!interview.currentTopicId) return null;
    return interview.topicPlan.find((t) => t.id === interview.currentTopicId) || null;
  }

  buildPreviousQa(interview) {
    const qa = [];
    for (let i = 0; i < interview.questions.length; i++) {
      const answer = interview.answers[i];
      if (answer) {
        qa.push({ question: interview.questions[i].text, answer: answer.transcript });
      }
    }
    return qa;
  }

  buildTopicMap(interview) {
    const topicMap = new Map();
    if (!interview.topicPlan.length) return topicMap;

    const sortedTopics = [...interview.topicPlan].sort((a, b) => a.priority - b.priority);
    let qIndex = 0;

    for (const topic of sortedTopics) {
      if (qIndex < interview.questions.length) {
        topicMap.set(qIndex, [topic.label, topic.source]);
        qIndex++;
        const followUps = Math.max(0, (topic.questionsAsked || 0) - 1);
        for (let j = 0; j < followUps; j++) {
          if (qIndex < interview.questions.length) {
            topicMap.set(qIndex, [topic.label, topic.source]);
            qIndex++;
          }
        }
      }
    }

    while (qIndex < interview.questions.length) {
      if (sortedTopics.length > 0) {
        const lastTopic = sortedTopics[sortedTopics.length - 1];
        topicMap.set(qIndex, [lastTopic.label, lastTopic.source]);
      }
      qIndex++;
    }

    return topicMap;
  }

  async sendResultsEmail(interview) {
    if (!interview.userId) return;
    try {
      const authService = new AuthService();
      const user = await authService.getUser(interview.userId);
      if (!user) return;
      await sendInterviewResultsEmail(user.email, user.name, {
        jobRole: interview.jobRole,
        analysis: interview.analysis,
      });
    } catch (err) {
      getLogger().warn({ error: err.message }, "[INTERVIEW] Failed to send results email");
    }
  }
}
