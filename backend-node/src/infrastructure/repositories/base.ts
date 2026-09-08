// ── Domain types ─────────────────────────────────────────────────

export enum InterviewMode {
  RESUME_DEEP_DIVE = "RESUME_DEEP_DIVE",
  TECHNICAL = "TECHNICAL",
  HR_SCREENING = "HR_SCREENING",
  MIXED = "MIXED",
}

export enum InterviewState {
  CREATED = "CREATED",
  IN_PROGRESS = "IN_PROGRESS",
  WAITING_FOR_ANSWER = "WAITING_FOR_ANSWER",
  EVALUATING = "EVALUATING",
  NEXT_QUESTION = "NEXT_QUESTION",
  COMPLETED = "COMPLETED",
}

export const INTERVIEW_STATE_TRANSITIONS: Record<InterviewState, InterviewState> = {
  [InterviewState.CREATED]: InterviewState.IN_PROGRESS,
  [InterviewState.IN_PROGRESS]: InterviewState.WAITING_FOR_ANSWER,
  [InterviewState.WAITING_FOR_ANSWER]: InterviewState.EVALUATING,
  [InterviewState.EVALUATING]: InterviewState.NEXT_QUESTION,
  [InterviewState.NEXT_QUESTION]: InterviewState.WAITING_FOR_ANSWER,
  [InterviewState.COMPLETED]: InterviewState.COMPLETED,
};

export function nextState(current: InterviewState): InterviewState {
  return INTERVIEW_STATE_TRANSITIONS[current] ?? InterviewState.COMPLETED;
}

export function canAcceptAnswer(state: InterviewState): boolean {
  return state === InterviewState.WAITING_FOR_ANSWER;
}

export enum QuestionType {
  HR = "HR",
  PRIMARY = "PRIMARY",
  FOLLOW_UP = "FOLLOW_UP",
}

export enum AnswerStatus {
  ANSWERED = "ANSWERED",
  PARTIAL_ANSWER = "PARTIAL_ANSWER",
  DOES_NOT_KNOW = "DOES_NOT_KNOW",
  NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION",
}

export enum TopicStatus {
  AVAILABLE = "AVAILABLE",
  ACTIVE = "ACTIVE",
  EXHAUSTED = "EXHAUSTED",
  SKIPPED = "SKIPPED",
}

export enum AnalysisStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

// ── Domain interfaces ───────────────────────────────────────────

export interface TopicEntry {
  id: string;
  label: string;
  source: string;
  primaryQuestion: string;
  priority: number;
  status: TopicStatus;
  questionsAsked: number;
  exhaustionReason: string | null;
}

export interface Question {
  id: string;
  text: string;
  questionType: QuestionType;
  order: number;
}

export interface Answer {
  questionId: string;
  transcript: string;
  answerStatus: AnswerStatus | null;
  timestamp: Date;
}

export interface Interview {
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
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeEducation {
  id: string;
  resumeId: string;
  sortOrder: number;
  college: string;
  degree: string;
  cgpa: string;
  startYear: string;
  endYear: string;
}

export interface ResumeExperience {
  id: string;
  resumeId: string;
  sortOrder: number;
  company: string;
  role: string;
  description: string;
}

export interface ResumeProject {
  id: string;
  resumeId: string;
  sortOrder: number;
  name: string;
  technologies: string;
  description: string;
}

export interface Resume {
  id: string;
  userId: string;
  title: string;
  personalInfo: Record<string, unknown>;
  skills: string;
  template: string;
  sectionOrder: string[];
  education: ResumeEducation[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Repository interfaces ───────────────────────────────────────

export interface InterviewRepository {
  save(interview: Interview): Promise<void>;
  get(interviewId: string): Promise<Interview | null>;
  listAll(): Promise<Interview[]>;
  delete(interviewId: string): Promise<boolean>;
}

export interface ResumeRepository {
  create(resume: Resume): Promise<Resume>;
  get(resumeId: string, userId: string): Promise<Resume | null>;
  listByUser(userId: string): Promise<{ id: string; title: string; updatedAt: string | null }[]>;
  update(resume: Resume): Promise<Resume | null>;
  delete(resumeId: string, userId: string): Promise<boolean>;
}

export interface UserRepository {
  create(user: User): Promise<User>;
  getByEmail(email: string): Promise<User | null>;
  getById(id: string): Promise<User | null>;
}
