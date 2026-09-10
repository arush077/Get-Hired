import { ResumeService } from "../services/resume-service.js";
import { LLMService } from "../services/llm-service.js";
import { PostgresResumeRepository } from "../repositories/resume-repository.js";
import {
  CreateResumeRequestSchema,
  UpdateResumeRequestSchema,
} from "../schemas/resume.js";
import { extractText } from "../services/document-parser.js";
import { getLogger } from "../logging/logger.js";

function paramStr(val) {
  return Array.isArray(val) ? val[0] : String(val);
}

const resumeService = new ResumeService(new PostgresResumeRepository());
const llmService = new LLMService();

function getUserId(req) {
  if (!req.user) throw new Error("Not authenticated");
  return req.user.id;
}

export async function listResumes(req, res) {
  try {
    const userId = getUserId(req);
    const resumes = await resumeService.listResumes(userId);
    res.json({ resumes });
  } catch (err) {
    if (err.message === "Not authenticated") {
      res.status(401).json({ detail: "Not authenticated" });
      return;
    }
    res.status(500).json({ detail: err.message });
  }
}

export async function createResume(req, res) {
  try {
    const userId = getUserId(req);
    const parsed = CreateResumeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ detail: parsed.error.issues });
      return;
    }
    const resume = await resumeService.createResume(userId, parsed.data);
    res.status(201).json(resumeToResponse(resume));
  } catch (err) {
    if (err.message === "Not authenticated") {
      res.status(401).json({ detail: "Not authenticated" });
      return;
    }
    res.status(500).json({ detail: err.message });
  }
}

export async function importResume(req, res) {
  try {
    const userId = getUserId(req);

    const files = req.files;
    if (!files || !files.file || !files.file[0]) {
      res.status(400).json({ detail: "No file provided" });
      return;
    }

    const file = files.file[0];
    const lower = file.originalname.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      res.status(400).json({ detail: "Only PDF and DOCX files are supported" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      res.status(400).json({ detail: "File too large (max 10MB)" });
      return;
    }

    let rawText;
    try {
      rawText = await extractText(file.originalname, file.buffer);
    } catch (e) {
      res.status(400).json({ detail: e.message });
      return;
    }

    const prompt = `Extract structured resume data from the text below. Return ONLY valid JSON matching this exact structure:

{
  "title": "Resume title (use the candidate name or 'Imported Resume')",
  "personal_info": {
    "fullName": "Full name",
    "email": "Email",
    "phone": "Phone number",
    "linkedin": "LinkedIn URL or empty string",
    "github": "GitHub URL or empty string"
  },
  "education": [
    {
      "college": "Institution name",
      "degree": "Degree and field of study",
      "cgpa": "GPA/CGPA or empty string",
      "startYear": "Start year",
      "endYear": "End year or 'Present'"
    }
  ],
  "experience": [
    {
      "company": "Company name",
      "role": "Job title",
      "description": "Job description with responsibilities and achievements."
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "technologies": "Technologies used",
      "description": "Project description."
    }
  ],
  "skills": "Comma-separated list of skills"
}

Rules:
- If a section has no data, use an empty array [] or empty string ""
- Preserve the original content as closely as possible
- Do not fabricate information
- Return ONLY the JSON object, no markdown or code blocks

Resume text:
${rawText}`;

    let data;
    try {
      const raw = await llmService.generateContent(prompt, 4096);
      data = llmService.parseJson(raw);
    } catch (e) {
      getLogger().error({ error: e.message }, "[IMPORT] LLM parsing failed");
      res.status(500).json({ detail: "Failed to parse resume content" });
      return;
    }

    const resumeData = {
      title: data.title || file.originalname.split(".")[0],
      personal_info: data.personal_info || {},
      education: data.education || [],
      experience: data.experience || [],
      projects: data.projects || [],
      skills: data.skills || "",
      template: "classic",
      section_order: ["education", "skills", "experience", "projects"],
    };

    const resume = await resumeService.createResume(userId, resumeData);
    res.status(201).json(resumeToResponse(resume));
  } catch (err) {
    if (err.message === "Not authenticated") {
      res.status(401).json({ detail: "Not authenticated" });
      return;
    }
    res.status(500).json({ detail: err.message });
  }
}

export async function getResume(req, res) {
  try {
    const userId = getUserId(req);
    const resume_id = paramStr(req.params.resume_id);
    const resume = await resumeService.getResume(resume_id, userId);
    if (!resume) {
      res.status(404).json({ detail: "Resume not found" });
      return;
    }
    res.json(resumeToResponse(resume));
  } catch (err) {
    if (err.message === "Not authenticated") {
      res.status(401).json({ detail: "Not authenticated" });
      return;
    }
    res.status(500).json({ detail: err.message });
  }
}

export async function updateResume(req, res) {
  try {
    const userId = getUserId(req);
    const resume_id = paramStr(req.params.resume_id);
    const parsed = UpdateResumeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ detail: parsed.error.issues });
      return;
    }
    const resume = await resumeService.updateResume(
      resume_id,
      userId,
      parsed.data,
    );
    if (!resume) {
      res.status(404).json({ detail: "Resume not found" });
      return;
    }
    res.json(resumeToResponse(resume));
  } catch (err) {
    if (err.message === "Not authenticated") {
      res.status(401).json({ detail: "Not authenticated" });
      return;
    }
    res.status(500).json({ detail: err.message });
  }
}

export async function deleteResume(req, res) {
  try {
    const userId = getUserId(req);
    const resume_id = paramStr(req.params.resume_id);
    const deleted = await resumeService.deleteResume(resume_id, userId);
    if (!deleted) {
      res.status(404).json({ detail: "Resume not found" });
      return;
    }
    res.json({ message: "Resume deleted" });
  } catch (err) {
    if (err.message === "Not authenticated") {
      res.status(401).json({ detail: "Not authenticated" });
      return;
    }
    res.status(500).json({ detail: err.message });
  }
}

export async function generateDescription(req, res) {
  try {
    getUserId(req); // require auth

    const { type, company, role, name, technologies } = req.body;
    if (type !== "experience" && type !== "projects") {
      res.status(400).json({ detail: "type must be 'experience' or 'projects'" });
      return;
    }

    let prompt;
    if (type === "experience") {
      prompt =
        `Write a professional resume description for the role of ${role || "a team member"} ` +
        `at ${company || "a company"}.\n` +
        "Write 3-4 bullet points focused on achievements, responsibilities, and impact.\n" +
        "Use action verbs and quantify results where possible.\n" +
        "Keep each bullet concise and professional.\n" +
        "Return only the bullet points, one per line, starting with '-'.";
    } else {
      prompt =
        `Write a professional resume description for a project called ${name || "a project"} ` +
        `using ${technologies || "modern technologies"}.\n` +
        "Write 2-3 bullet points describing the purpose, technologies used, and key outcomes.\n" +
        "Keep each bullet concise and professional.\n" +
        "Return only the bullet points, one per line, starting with '-'.";
    }

    const description = await llmService.generateContent(prompt);
    res.json({ description });
  } catch (err) {
    if (err.message === "Not authenticated") {
      res.status(401).json({ detail: "Not authenticated" });
      return;
    }
    res.status(500).json({ detail: err.message });
  }
}

export async function analyzeResume(req, res) {
  try {
    getUserId(req); // require auth

    const resumeData = req.body;
    if (!resumeData) {
      res.status(400).json({ detail: "Resume data is required" });
      return;
    }

    const prompt = buildAnalysisPrompt(resumeData);

    let raw;
    try {
      raw = await llmService.generateContent(prompt, 4096);
    } catch (e) {
      getLogger().error({ error: e.message }, "[ANALYZE] LLM call failed");
      res.status(500).json({ detail: `AI service error: ${e.constructor.name}` });
      return;
    }

    if (!raw || !raw.trim()) {
      res.status(500).json({ detail: "AI returned empty response" });
      return;
    }

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          analysis = JSON.parse(match[0]);
        } catch {
          res.status(500).json({ detail: "AI returned malformed JSON" });
          return;
        }
      } else {
        res.status(500).json({ detail: "AI did not return valid analysis" });
        return;
      }
    }

    res.json(analysis);
  } catch (err) {
    if (err.message === "Not authenticated") {
      res.status(401).json({ detail: "Not authenticated" });
      return;
    }
    res.status(500).json({ detail: err.message });
  }
}

function buildAnalysisPrompt(resume) {
  const personalInfo = resume.personal_info || {};
  const education = resume.education || [];
  const experience = resume.experience || [];
  const projects = resume.projects || [];
  const skills = resume.skills || "";

  return `You are an expert resume reviewer with experience in recruiting, ATS optimization, technical hiring, and professional writing.

Analyze the provided resume as if it were being submitted to a highly competitive company. Be objective, constructive, and critical.

Review the resume in the following areas:

Spelling & Grammar: Identify spelling, grammar, punctuation, capitalization, and awkward wording issues.
Formatting & Readability: Evaluate layout, section order, consistency, spacing, bullet formatting, and overall readability.
ATS Compatibility: Check for ATS-friendly formatting, standard section headings, keyword usage, parsing issues, and any elements that could cause problems.
Content Quality: Review each section for clarity, relevance, completeness, and impact.
Bullet Points: Identify weak, vague, repetitive, or passive bullet points and suggest stronger rewrites.
Quantification: Highlight where measurable results or metrics could strengthen the resume.
Technical Evaluation: Verify that technologies are used appropriately and demonstrate sufficient depth.
Consistency: Check for inconsistencies in dates, tense, formatting, punctuation, capitalization, and writing style.
Keywords: Identify missing or weak role-specific keywords that could improve ATS performance.
Recruiter Perspective: Summarize the first impression, strongest aspects, weakest aspects, and whether anything would make a recruiter hesitate.

Return ONLY valid JSON with no markdown formatting or code blocks. Use this exact structure:
{
  "spelling_issues": [
    { "field": "experience.0.description", "text": "the text with the error", "suggestion": "corrected text" }
  ],
  "grammar_issues": [
    { "field": "experience.0.description", "text": "the text with the issue", "suggestion": "improved text" }
  ],
  "content_improvements": [
    { "section": "Experience", "issue": "description of the problem", "suggestion": "how to fix it" }
  ]
}
If there are no issues in a category, return an empty array. Never fabricate information, achievements, responsibilities, or metrics. If information is missing, clearly state what additional details would strengthen the resume.

Resume:
Personal Info: ${JSON.stringify(personalInfo)}
Education: ${JSON.stringify(education)}
Experience: ${JSON.stringify(experience)}
Projects: ${JSON.stringify(projects)}
Skills: ${skills}`;
}

function resumeToResponse(resume) {
  return {
    id: resume.id,
    title: resume.title,
    personal_info: resume.personalInfo,
    skills: resume.skills,
    template: resume.template,
    section_order: resume.sectionOrder,
    education: resume.education.map((e) => ({
      id: e.id,
      college: e.college,
      degree: e.degree,
      cgpa: e.cgpa,
      startYear: e.startYear,
      endYear: e.endYear,
    })),
    experience: resume.experience.map((e) => ({
      id: e.id,
      company: e.company,
      role: e.role,
      description: e.description,
    })),
    projects: resume.projects.map((p) => ({
      id: p.id,
      name: p.name,
      technologies: p.technologies,
      description: p.description,
    })),
  };
}
