import { getPool } from "../infrastructure/db/pool.js";
import { withTransaction } from "../infrastructure/db/transaction.js";
import { Resume, ResumeEducation, ResumeExperience, ResumeProject } from "../models/resume.js";

export class PostgresResumeRepository {
  async create(resume) {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO resumes (id, user_id, title, personal_info, skills, template, section_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          resume.id,
          resume.userId,
          resume.title,
          JSON.stringify(resume.personalInfo),
          resume.skills,
          resume.template,
          JSON.stringify(resume.sectionOrder),
        ],
      );

      for (let i = 0; i < resume.education.length; i++) {
        const e = resume.education[i];
        await client.query(
          `INSERT INTO resume_education (id, resume_id, sort_order, college, degree, cgpa, start_year, end_year)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [e.id, resume.id, i, e.college, e.degree, e.cgpa, e.startYear, e.endYear],
        );
      }

      for (let i = 0; i < resume.experience.length; i++) {
        const e = resume.experience[i];
        await client.query(
          `INSERT INTO resume_experience (id, resume_id, sort_order, company, role, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [e.id, resume.id, i, e.company, e.role, e.description],
        );
      }

      for (let i = 0; i < resume.projects.length; i++) {
        const p = resume.projects[i];
        await client.query(
          `INSERT INTO resume_projects (id, resume_id, sort_order, name, technologies, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [p.id, resume.id, i, p.name, p.technologies, p.description],
        );
      }
    });

    return resume;
  }

  async get(resumeId, userId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, user_id, title, personal_info, skills, template, section_order, created_at, updated_at
       FROM resumes WHERE id = $1 AND user_id = $2`,
      [resumeId, userId],
    );

    const row = result.rows[0];
    if (!row) return null;

    const [eduResult, expResult, projResult] = await Promise.all([
      pool.query(
        `SELECT id, resume_id, sort_order, college, degree, cgpa, start_year, end_year
         FROM resume_education WHERE resume_id = $1 ORDER BY sort_order`,
        [resumeId],
      ),
      pool.query(
        `SELECT id, resume_id, sort_order, company, role, description
         FROM resume_experience WHERE resume_id = $1 ORDER BY sort_order`,
        [resumeId],
      ),
      pool.query(
        `SELECT id, resume_id, sort_order, name, technologies, description
         FROM resume_projects WHERE resume_id = $1 ORDER BY sort_order`,
        [resumeId],
      ),
    ]);

    return new Resume({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      personalInfo: row.personal_info ? JSON.parse(row.personal_info) : {},
      skills: row.skills || "",
      template: row.template || "classic",
      sectionOrder: row.section_order ? JSON.parse(row.section_order) : [],
      education: eduResult.rows.map(
        (e) =>
          new ResumeEducation({
            id: e.id,
            resumeId: e.resume_id,
            sortOrder: e.sort_order,
            college: e.college,
            degree: e.degree,
            cgpa: e.cgpa,
            startYear: e.start_year,
            endYear: e.end_year,
          }),
      ),
      experience: expResult.rows.map(
        (e) =>
          new ResumeExperience({
            id: e.id,
            resumeId: e.resume_id,
            sortOrder: e.sort_order,
            company: e.company,
            role: e.role,
            description: e.description,
          }),
      ),
      projects: projResult.rows.map(
        (p) =>
          new ResumeProject({
            id: p.id,
            resumeId: p.resume_id,
            sortOrder: p.sort_order,
            name: p.name,
            technologies: p.technologies,
            description: p.description,
          }),
      ),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async listByUser(userId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, title, updated_at FROM resumes WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId],
    );

    return result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    }));
  }

  async update(resume) {
    const existing = await this.get(resume.id, resume.userId);
    if (!existing) return null;

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE resumes SET title = $1, personal_info = $2, skills = $3, template = $4,
         section_order = $5, updated_at = NOW()
         WHERE id = $6 AND user_id = $7`,
        [
          resume.title,
          JSON.stringify(resume.personalInfo),
          resume.skills,
          resume.template,
          JSON.stringify(resume.sectionOrder),
          resume.id,
          resume.userId,
        ],
      );

      await client.query("DELETE FROM resume_education WHERE resume_id = $1", [resume.id]);
      for (let i = 0; i < resume.education.length; i++) {
        const e = resume.education[i];
        await client.query(
          `INSERT INTO resume_education (id, resume_id, sort_order, college, degree, cgpa, start_year, end_year)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [e.id, resume.id, i, e.college, e.degree, e.cgpa, e.startYear, e.endYear],
        );
      }

      await client.query("DELETE FROM resume_experience WHERE resume_id = $1", [resume.id]);
      for (let i = 0; i < resume.experience.length; i++) {
        const e = resume.experience[i];
        await client.query(
          `INSERT INTO resume_experience (id, resume_id, sort_order, company, role, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [e.id, resume.id, i, e.company, e.role, e.description],
        );
      }

      await client.query("DELETE FROM resume_projects WHERE resume_id = $1", [resume.id]);
      for (let i = 0; i < resume.projects.length; i++) {
        const p = resume.projects[i];
        await client.query(
          `INSERT INTO resume_projects (id, resume_id, sort_order, name, technologies, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [p.id, resume.id, i, p.name, p.technologies, p.description],
        );
      }
    });

    return resume;
  }

  async delete(resumeId, userId) {
    const pool = getPool();
    const result = await pool.query(
      "DELETE FROM resumes WHERE id = $1 AND user_id = $2",
      [resumeId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
