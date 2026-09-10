import { randomUUID } from "node:crypto";
import { InterviewState, nextState, canAcceptAnswer } from "./interview-state.js";
import { InterviewMode } from "./interview-mode.js";
import { AnalysisStatus } from "./analysis-status.js";
import { Question } from "./question.js";
import { Answer } from "./answer.js";
import { TopicEntry } from "./topic.js";

export class Interview {
  constructor(opts) {
    this.id = opts?.id ?? randomUUID();
    this.userId = opts?.userId ?? null;
    this.candidateName = opts?.candidateName ?? "";
    this.jobRole = opts?.jobRole ?? "";
    this.interviewMode = opts?.interviewMode ?? InterviewMode.MIXED;
    this.status = opts?.status ?? InterviewState.CREATED;
    this.resumeId = opts?.resumeId ?? null;
    this.resumeSnapshot = opts?.resumeSnapshot ?? "";
    this.jdSnapshot = opts?.jdSnapshot ?? "";
    this.questions = opts?.questions ?? [];
    this.answers = opts?.answers ?? {};
    this.currentQuestionIndex = opts?.currentQuestionIndex ?? 0;
    this.totalQuestions = opts?.totalQuestions ?? 10;
    this.topicPlan = opts?.topicPlan ?? [];
    this.currentTopicId = opts?.currentTopicId ?? null;
    this.analysis = opts?.analysis ?? null;
    this.analysisStatus = opts?.analysisStatus ?? AnalysisStatus.PENDING;
    this.createdAt = opts?.createdAt ?? new Date();
  }

  get answeredCount() {
    return Object.keys(this.answers).length;
  }

  get isComplete() {
    return this.status === InterviewState.COMPLETED;
  }

  currentQuestion() {
    if (this.currentQuestionIndex < this.questions.length) {
      return this.questions[this.currentQuestionIndex];
    }
    return null;
  }

  submitAnswer(answer) {
    this.answers[this.currentQuestionIndex] = answer;
    this.status = nextState(this.status);
  }

  advance() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex += 1;
      this.status = nextState(this.status); // EVALUATING -> NEXT_QUESTION
      this.status = nextState(this.status); // NEXT_QUESTION -> WAITING_FOR_ANSWER
    } else {
      this.status = InterviewState.COMPLETED;
    }
  }
}
