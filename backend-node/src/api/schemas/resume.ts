import { z } from "zod";

// ── Nested input schemas ────────────────────────────────────────

export const EducationInputSchema = z.object({
  id: z.string().nullable().optional(),
  college: z.string().default(""),
  degree: z.string().default(""),
  cgpa: z.string().default(""),
  startYear: z.string().default(""),
  endYear: z.string().default(""),
});

export const ExperienceInputSchema = z.object({
  id: z.string().nullable().optional(),
  company: z.string().default(""),
  role: z.string().default(""),
  description: z.string().default(""),
});

export const ProjectInputSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().default(""),
  technologies: z.string().default(""),
  description: z.string().default(""),
});

// ── Create Resume ───────────────────────────────────────────────

export const CreateResumeRequestSchema = z.object({
  title: z.string().default("Untitled Resume"),
  personal_info: z.record(z.string(), z.unknown()).default({}),
  skills: z.string().default(""),
  template: z.string().default("classic"),
  section_order: z
    .array(z.string())
    .default(["education", "skills", "experience", "projects"]),
  education: z.array(EducationInputSchema).default([]),
  experience: z.array(ExperienceInputSchema).default([]),
  projects: z.array(ProjectInputSchema).default([]),
});

// ── Update Resume ───────────────────────────────────────────────

export const UpdateResumeRequestSchema = z.object({
  title: z.string().nullable().optional(),
  personal_info: z.record(z.string(), z.unknown()).nullable().optional(),
  skills: z.string().nullable().optional(),
  template: z.string().nullable().optional(),
  section_order: z.array(z.string()).nullable().optional(),
  education: z.array(EducationInputSchema).nullable().optional(),
  experience: z.array(ExperienceInputSchema).nullable().optional(),
  projects: z.array(ProjectInputSchema).nullable().optional(),
});

// ── Resume Response ─────────────────────────────────────────────

export const EducationResponseSchema = z.object({
  id: z.string(),
  college: z.string(),
  degree: z.string(),
  cgpa: z.string(),
  startYear: z.string(),
  endYear: z.string(),
});

export const ExperienceResponseSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  description: z.string(),
});

export const ProjectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  technologies: z.string(),
  description: z.string(),
});

export const ResumeResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  personal_info: z.record(z.string(), z.unknown()),
  skills: z.string(),
  template: z.string(),
  section_order: z.array(z.string()),
  education: z.array(EducationResponseSchema),
  experience: z.array(ExperienceResponseSchema),
  projects: z.array(ProjectResponseSchema),
});

export const ResumeListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  updated_at: z.string().nullable(),
});

export const ResumeListResponseSchema = z.object({
  resumes: z.array(ResumeListItemSchema),
});

export const DeleteResponseSchema = z.object({
  message: z.string(),
});

// ── AI endpoints ────────────────────────────────────────────────

export const GenerateDescriptionRequestSchema = z.object({
  type: z.string(),
  company: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  technologies: z.string().nullable().optional(),
});

export const GenerateDescriptionResponseSchema = z.object({
  description: z.string(),
});

export const AnalyzeResumeRequestSchema = z.object({
  personal_info: z.record(z.string(), z.unknown()).default({}),
  education: z.array(z.record(z.string(), z.unknown())).default([]),
  experience: z.array(z.record(z.string(), z.unknown())).default([]),
  projects: z.array(z.record(z.string(), z.unknown())).default([]),
  skills: z.string().default(""),
});

// ── Inferred types ──────────────────────────────────────────────

export type EducationInput = z.infer<typeof EducationInputSchema>;
export type ExperienceInput = z.infer<typeof ExperienceInputSchema>;
export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export type CreateResumeRequest = z.infer<typeof CreateResumeRequestSchema>;
export type UpdateResumeRequest = z.infer<typeof UpdateResumeRequestSchema>;
export type ResumeResponse = z.infer<typeof ResumeResponseSchema>;
export type ResumeListItem = z.infer<typeof ResumeListItemSchema>;
export type ResumeListResponse = z.infer<typeof ResumeListResponseSchema>;
export type DeleteResponse = z.infer<typeof DeleteResponseSchema>;
export type GenerateDescriptionRequest = z.infer<typeof GenerateDescriptionRequestSchema>;
export type GenerateDescriptionResponse = z.infer<typeof GenerateDescriptionResponseSchema>;
export type AnalyzeResumeRequest = z.infer<typeof AnalyzeResumeRequestSchema>;
