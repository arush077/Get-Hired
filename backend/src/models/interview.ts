import { randomUUID } from "node:crypto";
import { InterviewState, nextState, canAcceptAnswer } from "./interview-state.js";
import { InterviewMode } from "./interview-mode.js";
import { AnalysisStatus } from "./analysis-status.js";
import { Question } from "./question.js";
import { Answer } from "./answer.js";
import { TopicEntry } from "./topic.js";

export class Interview {
  id: string;
  userId: string | null;
  candidateName: string;
  jobRole: string;
  interviewMode: InterviewMode;
  status: InterviewState;
  resumeId: string | null;
  resumeSnapshot: string;
  jdSnapshot: string;
  questions: Question[];
  answers: Record<number, Answer>;
  currentQuestionIndex: number;
  totalQuestions: number;
  topicPlan: TopicEntry[];
  currentTopicId: string | null;
  analysis: Record<string, unknown> | null;
  analysisStatus: AnalysisStatus;
  createdAt: Date;

  constructor(opts?: {
    id?: string;
    userId?: string | null;
    candidateName?: string;
    jobRole?: string;
    interviewMode?: InterviewMode;
    status?: InterviewState;
    resumeId?: string | null;
    resumeSnapshot?: string;
    jdSnapshot?: string;
    questions?: Question[];
    answers?: Record<number, Answer>;
    currentQuestionIndex?: number;
    totalQuestions?: number;
    topicPlan?: TopicEntry[];
    currentTopicId?: string | null;
    analysis?: Record<string, unknown> | null;
    analysisStatus?: AnalysisStatus;
    createdAt?: Date;
  }) {
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

  get answeredCount(): number {
    return Object.keys(this.answers).length;
  }

  get isComplete(): boolean {
    return this.status === InterviewState.COMPLETED;
  }

  currentQuestion(): Question | null {
    if (this.currentQuestionIndex < this.questions.length) {
      return this.questions[this.currentQuestionIndex];
    }
    return null;
  }

  /**
   * Record the candidate's answer for the current question and transition
   * from WAITING_FOR_ANSWER → EVALUATING.
   *
   * Python equivalent:
   *   def submit_answer(self, answer: Answer) -> None:
   *       self.answers[self.current_question_index] = answer
   *       self.status = self.status.next()
   */
  submitAnswer(answer: Answer): void {
    this.answers[this.currentQuestionIndex] = answer;
    this.status = nextState(this.status);
  }

  /**
   * Move to the next question. If there are more questions, increments the
   * index and performs the double state transition:
   *   EVALUATING → NEXT_QUESTION → WAITING_FOR_ANSWER
   *
   * If at the last question, transitions to COMPLETED.
   *
   * Python equivalent:
   *   def advance(self) -> None:
   *       if self.current_question_index < len(self.questions) - 1:
   *           self.current_question_index += 1
   *           self.status = self.status.next()  # EVALUATING -> NEXT_QUESTION
   *           self.status = self.status.next()  # NEXT_QUESTION -> WAITING_FOR_ANSWER
   *       else:
   *           self.status = InterviewState.COMPLETED
   */
  advance(): void {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex += 1;
      this.status = nextState(this.status); // EVALUATING -> NEXT_QUESTION
      this.status = nextState(this.status); // NEXT_QUESTION -> WAITING_FOR_ANSWER
    } else {
      this.status = InterviewState.COMPLETED;
    }
  }
}
