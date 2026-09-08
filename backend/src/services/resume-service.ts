import { Resume, ResumeEducation, ResumeExperience, ResumeProject } from "../models/resume.js";
import type { ResumeRepository } from "../repositories/base.js";

export class ResumeService {
  constructor(private repository: ResumeRepository) {}

  async createResume(userId: string, data: Record<string, unknown>): Promise<Resume> {
    const resume = new Resume({
      userId,
      title: (data.title as string) || "Untitled Resume",
      personalInfo: (data.personal_info as Record<string, unknown>) || {},
      skills: (data.skills as string) || "",
      template: (data.template as string) || "classic",
      sectionOrder: (data.section_order as string[]) || [
        "education",
        "skills",
        "experience",
        "projects",
      ],
      education: ((data.education as Record<string, unknown>[]) || []).map(
        (e) =>
          new ResumeEducation({
            college: (e.college as string) || "",
            degree: (e.degree as string) || "",
            cgpa: (e.cgpa as string) || "",
            startYear: (e.startYear as string) || (e.start_year as string) || "",
            endYear: (e.endYear as string) || (e.end_year as string) || "",
          }),
      ),
      experience: ((data.experience as Record<string, unknown>[]) || []).map(
        (e) =>
          new ResumeExperience({
            company: (e.company as string) || "",
            role: (e.role as string) || "",
            description: (e.description as string) || "",
          }),
      ),
      projects: ((data.projects as Record<string, unknown>[]) || []).map(
        (p) =>
          new ResumeProject({
            name: (p.name as string) || "",
            technologies: (p.technologies as string) || "",
            description: (p.description as string) || "",
          }),
      ),
    });
    return this.repository.create(resume);
  }

  async getResume(resumeId: string, userId: string): Promise<Resume | null> {
    return this.repository.get(resumeId, userId);
  }

  async listResumes(userId: string): Promise<{ id: string; title: string; updatedAt: string | null }[]> {
    return this.repository.listByUser(userId);
  }

  async updateResume(
    resumeId: string,
    userId: string,
    data: Record<string, unknown>,
  ): Promise<Resume | null> {
    const existing = await this.repository.get(resumeId, userId);
    if (!existing) return null;

    existing.title = (data.title as string) ?? existing.title;
    existing.personalInfo = (data.personal_info as Record<string, unknown>) ?? existing.personalInfo;
    existing.skills = (data.skills as string) ?? existing.skills;
    existing.template = (data.template as string) ?? existing.template;
    existing.sectionOrder = (data.section_order as string[]) ?? existing.sectionOrder;

    if ("education" in data) {
      existing.education = ((data.education as Record<string, unknown>[]) || []).map(
        (e, i) =>
          new ResumeEducation({
            id: (e.id as string) || undefined,
            resumeId,
            sortOrder: i,
            college: (e.college as string) || "",
            degree: (e.degree as string) || "",
            cgpa: (e.cgpa as string) || "",
            startYear: (e.startYear as string) || "",
            endYear: (e.endYear as string) || "",
          }),
      );
    }

    if ("experience" in data) {
      existing.experience = ((data.experience as Record<string, unknown>[]) || []).map(
        (e, i) =>
          new ResumeExperience({
            id: (e.id as string) || undefined,
            resumeId,
            sortOrder: i,
            company: (e.company as string) || "",
            role: (e.role as string) || "",
            description: (e.description as string) || "",
          }),
      );
    }

    if ("projects" in data) {
      existing.projects = ((data.projects as Record<string, unknown>[]) || []).map(
        (p, i) =>
          new ResumeProject({
            id: (p.id as string) || undefined,
            resumeId,
            sortOrder: i,
            name: (p.name as string) || "",
            technologies: (p.technologies as string) || "",
            description: (p.description as string) || "",
          }),
      );
    }

    return this.repository.update(existing);
  }

  async deleteResume(resumeId: string, userId: string): Promise<boolean> {
    return this.repository.delete(resumeId, userId);
  }

  reconstructResumeText(resume: Resume): string {
    return resume.toText();
  }
}
