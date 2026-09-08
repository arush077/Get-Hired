import { describe, it, expect } from "vitest";
import {
  CreateResumeRequestSchema,
  UpdateResumeRequestSchema,
  ResumeResponseSchema,
  ResumeListResponseSchema,
  DeleteResponseSchema,
  GenerateDescriptionRequestSchema,
  GenerateDescriptionResponseSchema,
  AnalyzeResumeRequestSchema,
  EducationInputSchema,
  ExperienceInputSchema,
  ProjectInputSchema,
} from "../../src/schemas/resume.js";

describe("Resume schemas", () => {
  describe("EducationInputSchema", () => {
    it("accepts valid payload with camelCase fields", () => {
      const result = EducationInputSchema.safeParse({
        college: "MIT",
        degree: "B.S. CS",
        cgpa: "3.8",
        startYear: "2018",
        endYear: "2022",
      });
      expect(result.success).toBe(true);
    });

    it("applies defaults for empty payload", () => {
      const result = EducationInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.college).toBe("");
        expect(result.data.degree).toBe("");
        expect(result.data.startYear).toBe("");
        expect(result.data.endYear).toBe("");
      }
    });

    it("accepts optional id", () => {
      const result = EducationInputSchema.safeParse({
        id: "abc-123",
        college: "MIT",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ExperienceInputSchema", () => {
    it("accepts valid payload", () => {
      const result = ExperienceInputSchema.safeParse({
        company: "Google",
        role: "SWE",
        description: "Built search features.",
      });
      expect(result.success).toBe(true);
    });

    it("applies defaults", () => {
      const result = ExperienceInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.company).toBe("");
        expect(result.data.role).toBe("");
        expect(result.data.description).toBe("");
      }
    });
  });

  describe("ProjectInputSchema", () => {
    it("accepts valid payload", () => {
      const result = ProjectInputSchema.safeParse({
        name: "GetHired",
        technologies: "React, Node.js",
        description: "Interview platform.",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("CreateResumeRequestSchema", () => {
    it("accepts full payload", () => {
      const result = CreateResumeRequestSchema.safeParse({
        title: "My Resume",
        personal_info: { fullName: "John", email: "john@example.com" },
        skills: "TypeScript, Python",
        template: "modern",
        section_order: ["skills", "experience"],
        education: [{ college: "MIT", degree: "B.S." }],
        experience: [{ company: "Google", role: "SWE" }],
        projects: [{ name: "GetHired" }],
      });
      expect(result.success).toBe(true);
    });

    it("applies all defaults for empty payload", () => {
      const result = CreateResumeRequestSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Untitled Resume");
        expect(result.data.personal_info).toEqual({});
        expect(result.data.skills).toBe("");
        expect(result.data.template).toBe("classic");
        expect(result.data.section_order).toEqual([
          "education",
          "skills",
          "experience",
          "projects",
        ]);
        expect(result.data.education).toEqual([]);
        expect(result.data.experience).toEqual([]);
        expect(result.data.projects).toEqual([]);
      }
    });
  });

  describe("UpdateResumeRequestSchema", () => {
    it("accepts partial payload", () => {
      const result = UpdateResumeRequestSchema.safeParse({
        title: "Updated Title",
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty payload (no changes)", () => {
      const result = UpdateResumeRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts all fields optional", () => {
      const result = UpdateResumeRequestSchema.safeParse({
        title: null,
        personal_info: null,
        skills: null,
        template: null,
        section_order: null,
        education: null,
        experience: null,
        projects: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ResumeResponseSchema", () => {
    it("accepts full payload", () => {
      const result = ResumeResponseSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "My Resume",
        personal_info: { fullName: "John" },
        skills: "TypeScript",
        template: "classic",
        section_order: ["education"],
        education: [
          {
            id: "edu-1",
            college: "MIT",
            degree: "B.S.",
            cgpa: "3.8",
            startYear: "2018",
            endYear: "2022",
          },
        ],
        experience: [
          {
            id: "exp-1",
            company: "Google",
            role: "SWE",
            description: "Built stuff.",
          },
        ],
        projects: [
          {
            id: "proj-1",
            name: "GetHired",
            technologies: "React",
            description: "Platform.",
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ResumeListResponseSchema", () => {
    it("accepts valid payload", () => {
      const result = ResumeListResponseSchema.safeParse({
        resumes: [
          { id: "abc", title: "Resume 1", updated_at: "2024-01-01T00:00:00Z" },
          { id: "def", title: "Resume 2", updated_at: null },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty list", () => {
      const result = ResumeListResponseSchema.safeParse({ resumes: [] });
      expect(result.success).toBe(true);
    });
  });

  describe("DeleteResponseSchema", () => {
    it("accepts valid payload", () => {
      const result = DeleteResponseSchema.safeParse({
        message: "Resume deleted",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("GenerateDescriptionRequestSchema", () => {
    it("accepts experience type", () => {
      const result = GenerateDescriptionRequestSchema.safeParse({
        type: "experience",
        company: "Google",
        role: "SWE",
      });
      expect(result.success).toBe(true);
    });

    it("accepts projects type", () => {
      const result = GenerateDescriptionRequestSchema.safeParse({
        type: "projects",
        name: "GetHired",
        technologies: "React, Node.js",
      });
      expect(result.success).toBe(true);
    });

    it("accepts minimal payload", () => {
      const result = GenerateDescriptionRequestSchema.safeParse({
        type: "experience",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("GenerateDescriptionResponseSchema", () => {
    it("accepts valid payload", () => {
      const result = GenerateDescriptionResponseSchema.safeParse({
        description: "- Built search features\n- Improved latency",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("AnalyzeResumeRequestSchema", () => {
    it("accepts full payload", () => {
      const result = AnalyzeResumeRequestSchema.safeParse({
        personal_info: { fullName: "John" },
        education: [{ college: "MIT" }],
        experience: [{ company: "Google" }],
        projects: [{ name: "GetHired" }],
        skills: "TypeScript",
      });
      expect(result.success).toBe(true);
    });

    it("applies defaults for empty payload", () => {
      const result = AnalyzeResumeRequestSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.personal_info).toEqual({});
        expect(result.data.education).toEqual([]);
        expect(result.data.experience).toEqual([]);
        expect(result.data.projects).toEqual([]);
        expect(result.data.skills).toBe("");
      }
    });
  });
});
