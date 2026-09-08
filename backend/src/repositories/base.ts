import type { Interview } from "../models/interview.js";
import type { Resume } from "../models/resume.js";
import type { User } from "../models/user.js";

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
