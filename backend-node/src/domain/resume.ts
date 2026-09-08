import { randomUUID } from "node:crypto";

export class ResumeEducation {
  id: string;
  resumeId: string;
  sortOrder: number;
  college: string;
  degree: string;
  cgpa: string;
  startYear: string;
  endYear: string;

  constructor(opts?: {
    id?: string;
    resumeId?: string;
    sortOrder?: number;
    college?: string;
    degree?: string;
    cgpa?: string;
    startYear?: string;
    endYear?: string;
  }) {
    this.id = opts?.id ?? randomUUID();
    this.resumeId = opts?.resumeId ?? randomUUID();
    this.sortOrder = opts?.sortOrder ?? 0;
    this.college = opts?.college ?? "";
    this.degree = opts?.degree ?? "";
    this.cgpa = opts?.cgpa ?? "";
    this.startYear = opts?.startYear ?? "";
    this.endYear = opts?.endYear ?? "";
  }
}

export class ResumeExperience {
  id: string;
  resumeId: string;
  sortOrder: number;
  company: string;
  role: string;
  description: string;

  constructor(opts?: {
    id?: string;
    resumeId?: string;
    sortOrder?: number;
    company?: string;
    role?: string;
    description?: string;
  }) {
    this.id = opts?.id ?? randomUUID();
    this.resumeId = opts?.resumeId ?? randomUUID();
    this.sortOrder = opts?.sortOrder ?? 0;
    this.company = opts?.company ?? "";
    this.role = opts?.role ?? "";
    this.description = opts?.description ?? "";
  }
}

export class ResumeProject {
  id: string;
  resumeId: string;
  sortOrder: number;
  name: string;
  technologies: string;
  description: string;

  constructor(opts?: {
    id?: string;
    resumeId?: string;
    sortOrder?: number;
    name?: string;
    technologies?: string;
    description?: string;
  }) {
    this.id = opts?.id ?? randomUUID();
    this.resumeId = opts?.resumeId ?? randomUUID();
    this.sortOrder = opts?.sortOrder ?? 0;
    this.name = opts?.name ?? "";
    this.technologies = opts?.technologies ?? "";
    this.description = opts?.description ?? "";
  }
}

export class Resume {
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

  constructor(opts?: {
    id?: string;
    userId?: string;
    title?: string;
    personalInfo?: Record<string, unknown>;
    skills?: string;
    template?: string;
    sectionOrder?: string[];
    education?: ResumeEducation[];
    experience?: ResumeExperience[];
    projects?: ResumeProject[];
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    const now = new Date();
    this.id = opts?.id ?? randomUUID();
    this.userId = opts?.userId ?? randomUUID();
    this.title = opts?.title ?? "Untitled Resume";
    this.personalInfo = opts?.personalInfo ?? {
      fullName: "",
      email: "",
      phone: "",
      linkedin: "",
      github: "",
    };
    this.skills = opts?.skills ?? "";
    this.template = opts?.template ?? "classic";
    this.sectionOrder = opts?.sectionOrder ?? [
      "education",
      "skills",
      "experience",
      "projects",
    ];
    this.education = opts?.education ?? [];
    this.experience = opts?.experience ?? [];
    this.projects = opts?.projects ?? [];
    this.createdAt = opts?.createdAt ?? now;
    this.updatedAt = opts?.updatedAt ?? now;
  }

  toText(): string {
    const parts: string[] = [];
    const info = this.personalInfo;

    if (info.fullName) parts.push(`Name: ${info.fullName}`);
    if (info.email) parts.push(`Email: ${info.email}`);
    if (info.phone) parts.push(`Phone: ${info.phone}`);
    if (info.linkedin) parts.push(`LinkedIn: ${info.linkedin}`);
    if (info.github) parts.push(`GitHub: ${info.github}`);

    if (this.education.length > 0) {
      parts.push("\nEducation:");
      for (const edu of this.education) {
        let line = `- ${edu.degree}`;
        if (edu.college) line += ` at ${edu.college}`;
        if (edu.cgpa) line += `, CGPA: ${edu.cgpa}`;
        const years = [edu.startYear, edu.endYear].filter(Boolean).join(" - ");
        if (years) line += ` (${years})`;
        parts.push(line);
      }
    }

    if (this.experience.length > 0) {
      parts.push("\nExperience:");
      for (const exp of this.experience) {
        parts.push(
          `- ${exp.role}` + (exp.company ? ` at ${exp.company}` : ""),
        );
        if (exp.description) parts.push(`  ${exp.description}`);
      }
    }

    if (this.projects.length > 0) {
      parts.push("\nProjects:");
      for (const proj of this.projects) {
        let line = `- ${proj.name}`;
        if (proj.technologies) line += ` (${proj.technologies})`;
        parts.push(line);
        if (proj.description) parts.push(`  ${proj.description}`);
      }
    }

    if (this.skills) parts.push(`\nSkills: ${this.skills}`);

    return parts.join("\n");
  }
}
