-- Get-Hired database schema backup
-- Reconstructed from backend/docs/MIGRATION_REFERENCE.md (Database Schema Summary)
--
-- This is a schema-only dump (no row data). It is safe to commit to version control.
-- Regenerate against your live Supabase DB whenever it is reachable:
--
--   npm run db:backup-schema
--
-- Restore (manual / opt-in only, never run on app startup):
--
--   psql "$DATABASE_URL" -f backend/database/schema.sql
--
-- NOTE: If you restore onto an existing database, tables may already exist.
-- Use `CREATE TABLE IF NOT EXISTS` or drop/recreate as appropriate for your env.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- interviews
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  candidate_name VARCHAR(255) NOT NULL DEFAULT '',
  job_role VARCHAR(255) NOT NULL DEFAULT '',
  interview_mode VARCHAR(50) NOT NULL DEFAULT 'MIXED',
  status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  current_question_index INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 10,
  resume_snapshot TEXT NOT NULL DEFAULT '',
  jd_snapshot TEXT NOT NULL DEFAULT '',
  topic_plan TEXT NOT NULL DEFAULT '[]',
  current_topic_id VARCHAR(255),
  analysis TEXT,
  analysis_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL DEFAULT '',
  question_index INT NOT NULL,
  question_type VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- answers
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL DEFAULT '',
  answer_status VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- resumes
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Resume',
  personal_info TEXT NOT NULL DEFAULT '{}',
  skills TEXT NOT NULL DEFAULT '',
  template VARCHAR(50) NOT NULL DEFAULT 'classic',
  section_order TEXT NOT NULL DEFAULT '["education","skills","experience","projects"]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- resume_education
CREATE TABLE IF NOT EXISTS resume_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  college VARCHAR(255) NOT NULL DEFAULT '',
  degree VARCHAR(255) NOT NULL DEFAULT '',
  cgpa VARCHAR(50) NOT NULL DEFAULT '',
  start_year VARCHAR(20) NOT NULL DEFAULT '',
  end_year VARCHAR(20) NOT NULL DEFAULT ''
);

-- resume_experience
CREATE TABLE IF NOT EXISTS resume_experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  company VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);

-- resume_projects
CREATE TABLE IF NOT EXISTS resume_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  name VARCHAR(255) NOT NULL DEFAULT '',
  technologies VARCHAR(500) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);
