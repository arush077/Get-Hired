import { Resume, ResumeEducation, ResumeExperience, ResumeProject } from "../models/resume.js";

export class ResumeService {
  constructor(repository) {
    this.repository = repository;
  }

  async createResume(userId, data) {
    const resume = new Resume({
      userId,
      title: data.title || "Untitled Resume",
      personalInfo: data.personal_info || {},
      skills: data.skills || "",
      template: data.template || "classic",
      sectionOrder: data.section_order || [
        "education",
        "skills",
        "experience",
        "projects",
      ],
      education: (data.education || []).map(
        (e) =>
          new ResumeEducation({
            college: e.college || "",
            degree: e.degree || "",
            cgpa: e.cgpa || "",
            startYear: e.startYear || e.start_year || "",
            endYear: e.endYear || e.end_year || "",
          }),
      ),
      experience: (data.experience || []).map(
        (e) =>
          new ResumeExperience({
            company: e.company || "",
            role: e.role || "",
            description: e.description || "",
          }),
      ),
      projects: (data.projects || []).map(
        (p) =>
          new ResumeProject({
            name: p.name || "",
            technologies: p.technologies || "",
            description: p.description || "",
          }),
      ),
    });
    return this.repository.create(resume);
  }

  async getResume(resumeId, userId) {
    return this.repository.get(resumeId, userId);
  }

  async listResumes(userId) {
    return this.repository.listByUser(userId);
  }

  async updateResume(resumeId, userId, data) {
    const existing = await this.repository.get(resumeId, userId);
    if (!existing) return null;

    existing.title = data.title ?? existing.title;
    existing.personalInfo = data.personal_info ?? existing.personalInfo;
    existing.skills = data.skills ?? existing.skills;
    existing.template = data.template ?? existing.template;
    existing.sectionOrder = data.section_order ?? existing.sectionOrder;

    if ("education" in data) {
      existing.education = (data.education || []).map(
        (e, i) =>
          new ResumeEducation({
            id: e.id || undefined,
            resumeId,
            sortOrder: i,
            college: e.college || "",
            degree: e.degree || "",
            cgpa: e.cgpa || "",
            startYear: e.startYear || "",
            endYear: e.endYear || "",
          }),
      );
    }

    if ("experience" in data) {
      existing.experience = (data.experience || []).map(
        (e, i) =>
          new ResumeExperience({
            id: e.id || undefined,
            resumeId,
            sortOrder: i,
            company: e.company || "",
            role: e.role || "",
            description: e.description || "",
          }),
      );
    }

    if ("projects" in data) {
      existing.projects = (data.projects || []).map(
        (p, i) =>
          new ResumeProject({
            id: p.id || undefined,
            resumeId,
            sortOrder: i,
            name: p.name || "",
            technologies: p.technologies || "",
            description: p.description || "",
          }),
      );
    }

    return this.repository.update(existing);
  }

  async deleteResume(resumeId, userId) {
    return this.repository.delete(resumeId, userId);
  }

  reconstructResumeText(resume) {
    return resume.toText();
  }
}
