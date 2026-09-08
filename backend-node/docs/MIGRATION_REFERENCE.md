# Migration Reference: Python/Fastify → Node.js/Express

This document is the single source of truth for migrating the Get-Hired backend from Python to Node.js. The Python backend is frozen at git tag `backend-python-stable`.

---

## 1. API Request/Response Contracts

### Auth

#### POST /api/auth/register
Request:
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```
Response (200):
```json
{
  "token": "jwt_string",
  "user": {
    "id": "uuid_string",
    "name": "string",
    "email": "string"
  }
}
```
Errors: 409 "Email already registered"

#### POST /api/auth/login
Request:
```json
{
  "email": "string",
  "password": "string"
}
```
Response (200): Same shape as register response.
Errors: 401 "Invalid credentials"

#### GET /api/auth/me
Headers: `Authorization: Bearer <token>`
Response (200):
```json
{
  "id": "uuid_string",
  "name": "string",
  "email": "string"
}
```
Errors: 401 "Not authenticated", 404 "User not found"

### Interviews

#### POST /api/interviews
Headers: `Authorization: Bearer <token>` (OPTIONAL — anonymous interviews allowed)
Request:
```json
{
  "candidate_name": "string",
  "job_role": "string",
  "resume_id": "uuid_string | null",
  "resume_text": "string | null",
  "jd_text": "string",
  "total_questions": 10,
  "interview_mode": "MIXED"
}
```
Validation: Exactly one of `resume_id` or `resume_text` must be provided. Not both, not neither.
Response (200):
```json
{
  "interview_id": "uuid_string",
  "total_questions": 10,
  "question": "string (first question text)",
  "question_index": 0,
  "interview_mode": "MIXED"
}
```
Errors: 400 "Resume not found" or "Resume text is required", 429 rate limited

#### POST /api/interviews/:interview_id/answers
Headers: `Authorization: Bearer <token>` (required if interview has user_id)
Request:
```json
{
  "transcript": "string (candidate's answer)"
}
```
Response (200):
```json
{
  "interview_id": "uuid_string",
  "question_index": 3,
  "answered_count": 4,
  "status": "WAITING_FOR_ANSWER",
  "next_question": "string or null",
  "next_question_index": 3,
  "total_questions": 10,
  "is_clarification": false,
  "next_action": "FOLLOW_UP | NEW_TOPIC | CLARIFY | null",
  "analysis": null | { analysis object }
}
```
When `is_clarification: true`:
- `next_question` is the clarification/rephrased question
- `next_question_index` equals current index (no advancement)
- `status` is WAITING_FOR_ANSWER

When interview completes (`status: "COMPLETED"`):
- `question_index` is null
- `next_question` is null
- `next_question_index` is null
- `analysis` may be null (generated in background)

Errors: 400 "Invalid interview ID", 403 "Not authorized", 404 "Interview not found", 429 rate limited

#### GET /api/interviews/:interview_id/results
Headers: `Authorization: Bearer <token>` (required if interview has user_id)
Response (200):
```json
{
  "interview_id": "uuid_string",
  "status": "COMPLETED",
  "results": [
    {
      "question_index": 0,
      "question": "string",
      "answer": "string",
      "question_type": "HR | PRIMARY | FOLLOW_UP",
      "topic_label": "string",
      "topic_source": "string",
      "answer_status": "ANSWERED | PARTIAL_ANSWER | DOES_NOT_KNOW | NEEDS_CLARIFICATION"
    }
  ],
  "analysis": {
    "overall_score": 75,
    "dimensions": {
      "technical_depth": 80,
      "correctness": 70,
      "specificity": 75,
      "clarity": 70,
      "communication": 75
    },
    "strengths": ["string"],
    "areas_to_improve": ["string"],
    "recurring_patterns": ["string"],
    "question_feedback": [
      {
        "question_number": 1,
        "score": 80,
        "what_went_well": "string",
        "what_was_missing": "string",
        "how_to_improve": "string"
      }
    ],
    "recommendations": ["string"],
    "jd_match": {
      "strengths": ["string"],
      "gaps": ["string"]
    }
  }
}
```
Errors: 400 "Invalid interview ID", 403 "Not authorized", 404 "Interview not found" or "Interview results not available"

### Resumes

#### GET /api/resumes
Headers: `Authorization: Bearer <token>` (required)
Response (200):
```json
{
  "resumes": [
    {
      "id": "uuid_string",
      "title": "string",
      "updated_at": "ISO 8601 string or null"
    }
  ]
}
```

#### POST /api/resumes
Headers: `Authorization: Bearer <token>` (required)
Request:
```json
{
  "title": "Untitled Resume",
  "personal_info": {
    "fullName": "",
    "email": "",
    "phone": "",
    "linkedin": "",
    "github": ""
  },
  "skills": "string",
  "template": "classic",
  "section_order": ["education", "skills", "experience", "projects"],
  "education": [
    {
      "college": "string",
      "degree": "string",
      "cgpa": "string",
      "startYear": "string",
      "endYear": "string"
    }
  ],
  "experience": [
    {
      "company": "string",
      "role": "string",
      "description": "string"
    }
  ],
  "projects": [
    {
      "name": "string",
      "technologies": "string",
      "description": "string"
    }
  ]
}
```
Response (201): Full ResumeResponse (see below)

#### POST /api/resumes/import
Headers: `Authorization: Bearer <token>` (required)
Request: `multipart/form-data` with field `file` (PDF or DOCX, max 10MB)
Response (201): Full ResumeResponse
Errors: 400 "No file provided", "Only PDF and DOCX files are supported", "File too large (max 10MB)", 500 "Failed to parse resume content"

#### GET /api/resumes/:resume_id
Headers: `Authorization: Bearer <token>` (required)
Response (200): ResumeResponse
Errors: 400 "Invalid resume ID", 404 "Resume not found"

#### PUT /api/resumes/:resume_id
Headers: `Authorization: Bearer <token>` (required)
Request: Partial resume data (only provided fields are updated)
Response (200): ResumeResponse
Errors: 400 "Invalid resume ID", 404 "Resume not found"

#### DELETE /api/resumes/:resume_id
Headers: `Authorization: Bearer <token>` (required)
Response (200):
```json
{
  "message": "Resume deleted"
}
```
Errors: 400 "Invalid resume ID", 404 "Resume not found"

#### POST /api/resumes/ai/generate
Headers: `Authorization: Bearer <token>` (required)
Rate limit: 5/minute per user
Request:
```json
{
  "type": "experience | projects",
  "company": "string (optional)",
  "role": "string (optional)",
  "name": "string (optional)",
  "technologies": "string (optional)"
}
```
Response (200):
```json
{
  "description": "string (bullet points)"
}
```

#### POST /api/resumes/ai/analyze
Headers: `Authorization: Bearer <token>` (required)
Rate limit: 1/minute per user
Request:
```json
{
  "personal_info": {},
  "education": [],
  "experience": [],
  "projects": [],
  "skills": "string"
}
```
Response (200): Analysis JSON with spelling_issues, grammar_issues, content_improvements

### ResumeResponse Shape

```json
{
  "id": "uuid_string",
  "title": "string",
  "personal_info": {},
  "skills": "string",
  "template": "string",
  "section_order": ["string"],
  "education": [
    {
      "id": "uuid_string",
      "college": "string",
      "degree": "string",
      "cgpa": "string",
      "startYear": "string",
      "endYear": "string"
    }
  ],
  "experience": [
    {
      "id": "uuid_string",
      "company": "string",
      "role": "string",
      "description": "string"
    }
  ],
  "projects": [
    {
      "id": "uuid_string",
      "name": "string",
      "technologies": "string",
      "description": "string"
    }
  ]
}
```

---

## 2. topic_plan JSON Schema

Stored as TEXT column in `interviews` table. Serialized/deserialized via `topic_serialization.py`.

```json
[
  {
    "id": "string (snake_case identifier, e.g. 'uber_pagination')",
    "label": "string (5-15 word description of interviewable subject)",
    "source": "string (exact entity name from resume, e.g. 'Uber Software Engineer', 'MergePilot')",
    "primary_question": "string (15-35 words, specific and grounded in resume evidence)",
    "priority": "int (1-10, 10=highest relevance)",
    "status": "AVAILABLE | ACTIVE | EXHAUSTED | SKIPPED",
    "questions_asked": "int (0-based counter)",
    "exhaustion_reason": "string | null ('DOES_NOT_KNOW' | 'SUFFICIENTLY_EXPLORED' | 'MAX_QUESTIONS_REACHED' | null)"
  }
]
```

**Serialization (Python → DB):**
```python
json.dumps([{"id": t.id, "label": t.label, "source": t.source,
  "primary_question": t.primary_question, "priority": t.priority,
  "status": t.status.value, "questions_asked": t.questions_asked,
  "exhaustion_reason": t.exhaustion_reason} for t in topic_plan])
```

**Deserialization (DB → Python):**
```python
[TopicEntry(id=t["id"], label=t["label"], source=t.get("source",""),
  primary_question=t.get("primary_question",""), priority=t["priority"],
  status=TopicStatus(t["status"]), questions_asked=t.get("questions_asked",0),
  exhaustion_reason=t.get("exhaustion_reason")) for t in json.loads(raw)]
```

---

## 3. Answer-Index Mapping

This is a critical subtlety.

**Domain model:** `Interview.answers` is `dict[int, Answer]` keyed by **question index** (0-based integer).

**Database model:** `AnswerModel` has `question_id` (UUID FK to `questions` table).

**Repository mapping:**
```python
q_id_to_index = {q.id: q.question_index for q in questions}
# Then for each answer:
idx = q_id_to_index[a.question_id]
answers_dict[idx] = Answer(...)
```

**Node must preserve this mapping.** When saving:
1. For each answer in the domain `answers` dict, look up the question UUID by index
2. Insert/update AnswerModel with that question UUID

When loading:
1. Load all questions, build `{question_uuid: question_index}` map
2. For each AnswerModel, find the question index and store in the dict

---

## 4. Double State Transition (`advance()`)

File: `domain/interview.py`

```python
def advance(self) -> None:
    if self.current_question_index < len(self.questions) - 1:
        self.current_question_index += 1
        self.status = self.status.next()  # EVALUATING -> NEXT_QUESTION
        self.status = self.status.next()  # NEXT_QUESTION -> WAITING_FOR_ANSWER
    else:
        self.status = InterviewState.COMPLETED
```

**Effect:** After `advance()`, status is always `WAITING_FOR_ANSWER` (or `COMPLETED` if at the last question). The double-transition is intentional — it simulates moving through EVALUATING and NEXT_QUESTION in one step.

**Node port must replicate this exactly.**

---

## 5. State Machine

File: `domain/interview_state.py`

```
CREATED -> IN_PROGRESS -> WAITING_FOR_ANSWER -> EVALUATING -> NEXT_QUESTION -> (back to WAITING_FOR_ANSWER or COMPLETED)
```

Transitions:
```python
{
  CREATED: IN_PROGRESS,
  IN_PROGRESS: WAITING_FOR_ANSWER,
  WAITING_FOR_ANSWER: EVALUATING,
  EVALUATING: NEXT_QUESTION,
  NEXT_QUESTION: WAITING_FOR_ANSWER,
}
```

Any state not in the map returns `COMPLETED` (terminal).

`can_accept_answer()` returns `true` only for `WAITING_FOR_ANSWER`.

---

## 6. LLM Prompts (Verbatim)

### 6a. Topic Planning Prompt

**System message:**
```
You are an expert interview planner. Given a candidate's resume and a job description,
create a focused interview plan.

OUTPUT FORMAT — return ONLY valid JSON:
{"topics": [{"id": "...", "label": "...", "source": "...", "priority": N, "primary_question": "..."}]}

RULES:
- Generate at least {count} topics, ideally up to {count + 2}.
- Each topic MUST belong to a specific source entity from the resume:
  a work experience (company name), a project name, education, or certification.
- The 'source' field MUST be the exact entity name from the resume
  (e.g., 'Uber Software Engineer', 'MergePilot', 'AcadAssist', 'Education').
- NEVER mix facts from different projects, jobs, or resume sections.
  A question about MergePilot must only use MergePilot facts.
- Merge topics that represent the SAME interviewable subject.
- Rank by relevance to the job role (10=highest, 1=lowest).
- Each topic gets ONE primary question that is specific, grounded in the resume,
  and uses concrete details (project names, tools, metrics).
- Do NOT invent tools, technologies, metrics, or responsibilities not in the resume.
- Do NOT combine technologies from different projects unless the resume explicitly
  states they were used together.
- topic id: short snake_case identifier (e.g., 'uber_pagination', 'mergepilot_architecture')
- label: 5-15 word description of the interviewable subject
- question: 15-35 words, specific and grounded in resume evidence
- source: REQUIRED — must be a specific entity name from the resume, never empty
{strategy_block}
```

**User message:**
```
Job Role: {job_role}

=== CANDIDATE RESUME ===
{resume_text}

=== JOB DESCRIPTION ===
{jd_text}

Create an interview plan with at most {count} topics.
Return ONLY valid JSON.
```

**Retry prompt (stricter):**
```
System: Return ONLY a JSON object. No markdown. No explanation.
Return at most {count} topics.
{"topics": [{"id": "string", "label": "string", "source": "string",
"priority": 1-10, "primary_question": "string"}]}
Each topic MUST have: id, label, source (entity from resume), priority, primary_question.
source must be a specific entity name from the resume, not 'Candidate'.

User: Job Role: {job_role}

Resume:
{resume_text}

JD:
{jd_text}

Return ONLY valid JSON with topics.
```

### 6b. classify_and_decide Prompt

**System message:**
```
You are an expert interview analyst. Analyze the candidate's answer and decide what to do next.

STEP 1: Classify the answer status:
- ANSWERED: Candidate provided a meaningful answer with substance
- PARTIAL_ANSWER: Candidate started answering but it's incomplete or lacks detail
- DOES_NOT_KNOW: Candidate explicitly says they don't know, have no experience, weren't involved, or someone else handled it
- NEEDS_CLARIFICATION: Candidate is asking what the question means or asking for clarification

STEP 2: Decide the next action:
- FOLLOW_UP: Answer is incomplete or interesting — ask a deeper follow-up on the SAME topic.
  Generate the follow-up question in the 'question' field.
- NEW_TOPIC: Answer is sufficient, topic is explored, or candidate doesn't know. Move on.
- CLARIFY: Candidate didn't understand. Generate a genuine rephrasing in 'clarification_text'.
- END: Interview is complete.

PROVENANCE RULES — CRITICAL:
- The current topic is about: {current_topic_source}
- ONLY use facts from the Resume/JD context provided below.
- NEVER invent candidate experience, projects, technologies, responsibilities, or achievements.
- NEVER mix facts from different projects, jobs, or resume sections.
- If the context mentions a specific tool or metric for THIS topic, you may reference it.
- Do NOT reference tools, metrics, or responsibilities from OTHER projects or experiences.
{strategy_block}

RULES:
- If answer_status is DOES_NOT_KNOW, next_action MUST be NEW_TOPIC.
- If answer_status is NEEDS_CLARIFICATION, next_action MUST be CLARIFY.
- If questions_on_topic >= 2, next_action MUST be NEW_TOPIC (hard cap).
- Prefer topic diversity. Don't stay on the same topic unless the follow-up is truly valuable.
- IMPORTANT: 'no' or 'did not' in a substantive answer is NOT DOES_NOT_KNOW.
- For FOLLOW_UP: generate a question (15-35 words) grounded in the resume evidence for this topic.
- For CLARIFY: genuinely rephrase the question. Do NOT just prepend 'Let me rephrase that.'.
- For NEW_TOPIC: suggest next_topic_id from available topics if possible.

Current topic: {current_topic_label} ({current_topic_source})
Questions asked on this topic: {questions_on_topic}
Available topics: {remaining_text}
Previously asked questions:
{asked_text}

Return ONLY valid JSON: {"answer_status": "...", "next_action": "...", "next_topic_id": null,
"reason": "...", "question": null, "clarification_text": null}
- question: filled only when next_action is FOLLOW_UP
- clarification_text: filled only when next_action is CLARIFY
- next_topic_id: suggested topic for NEW_TOPIC, or null
- reason: one sentence for debugging
```

**User message:**
```
Job Role: {job_role}

=== CANDIDATE RESUME ===
{resume_text}

=== JOB DESCRIPTION ===
{jd_text}

Current Question: {current_question}
Candidate Answer: {candidate_answer}

Recent Interview History:
{history_text}
```

### 6c. generate_analysis Prompt

**System message:**
```
You are an expert interview evaluator. Analyze the completed interview
and provide a detailed structured evaluation.

INPUT: You receive the candidate's resume, the target job description,
and the full interview transcript with question types, topics, and answer statuses.

EVALUATION RULES:
- Evaluate ONLY what the candidate actually demonstrated.
- Do not assume skills not demonstrated or invent experience.
- Judge answers in context of the specific questions asked.
- Evaluate the interview as a whole for patterns.
- Penalize vague, incomplete, repetitive, or off-topic answers.
- Reward specific examples, clear reasoning, structured answers.
- Do not require every answer to contain a measurable metric.
- For recurring patterns: only report if visible in 2+ answers.
- For JD match: compare demonstrated skills against JD requirements.
{strategy_block}

OUTPUT SCHEMA (return ONLY valid JSON):
{
  "overall_score": int (0-100),
  "dimensions": {
    "technical_depth": int (0-100),
    "correctness": int (0-100),
    "specificity": int (0-100),
    "clarity": int (0-100),
    "communication": int (0-100)
  },
  "strengths": [str, str],
  "areas_to_improve": [str, str],
  "recurring_patterns": [str, str],
  "question_feedback": [
    {
      "question_number": int (1-based),
      "score": int (0-100),
      "what_went_well": str,
      "what_was_missing": str,
      "how_to_improve": str
    }
  ],
  "recommendations": [str, str],
  "jd_match": {
    "strengths": [str, str],
    "gaps": [str, str]
  }
}

DIMENSION GUIDELINES:
- technical_depth: Understanding of concepts, not just naming tools
- correctness: Accuracy of technical claims and approaches
- specificity: Concrete examples, metrics, details vs vague statements
- clarity: How well answers are structured and explained
- communication: Overall clarity, conciseness, and flow of responses

PER-QUESTION FEEDBACK:
- Reference the actual question and actual answer
- Be specific, not generic
- Score reflects how well that particular answer addressed the question

RECOMMENDATIONS:
- Must be concrete and practiceable
- Based on the actual recurring weaknesses identified
- Example: 'Practice explaining X by structuring answers as: problem → approach → trade-off → result'

JD MATCH:
- Compare what the candidate demonstrated against the JD requirements
- Cite specific evidence from their answers
- Do not simply repeat the JD text
```

**User message:**
```
Job Role: {job_role}

=== CANDIDATE RESUME ===
{resume_text}

=== JOB DESCRIPTION ===
{jd_text}

=== INTERVIEW TRANSCRIPT ===

{qa_block}
```

---

## 7. Strategy Instructions (Verbatim)

### ResumeDeepDiveStrategy

**Initial planning:**
```
Interview mode: Resume Deep Dive.

Focus primarily on the candidate's actual work experience and projects.

Prioritize:
- what the candidate personally built
- ownership and responsibility
- technical implementation decisions
- architecture and design choices
- trade-offs
- debugging and difficult engineering problems
- measurable impact
- why a particular approach was chosen

Questions should investigate the candidate's actual involvement rather than
asking generic textbook questions.

Prefer questions about:
- what problem the candidate was solving
- why a particular approach was chosen
- alternatives considered
- trade-offs
- difficult implementation details
- debugging
- measurable outcomes
- what the candidate would change now

Every resume-grounded topic must clearly belong to one specific project,
company, internship, or work experience.

Never combine facts from multiple unrelated projects into one question.

Avoid generic CS questions unless they are directly relevant to something
the candidate actually worked on or the JD strongly requires.

Example style:
"You mentioned moving Uber's gig-listing page to server-side pagination.
What problem were you seeing with the original approach, and how did the new
design address it?"
```

**Runtime:**
```
INTERVIEW MODE: Resume Deep Dive.

Focus follow-ups on:
- implementation details
- ownership
- reasoning behind decisions
- trade-offs
- debugging
- measurable impact
- concrete examples

Follow-ups should deepen the current project/experience instead of jumping to
generic theory.
```

**Evaluation:**
```
EVALUATION MODE: Resume Deep Dive.

Focus evaluation on:
- depth of technical understanding demonstrated
- specificity of examples and implementation details
- ownership and personal contribution vs team effort
- reasoning behind technical decisions
- awareness of trade-offs and alternatives
- problem-solving approach and debugging skills

Weight technical_depth and specificity more heavily than communication.
```

### TechnicalStrategy

**Initial planning:**
```
Interview mode: Technical.

Focus on the candidate's technical skills mentioned in their Resume and the
Job Description. Probe depth of understanding, not surface-level knowledge.

Prioritize:
- technical skills and tools listed in the Resume and JD
- system design and architecture decisions
- data structures and algorithms relevant to the role
- debugging and problem-solving approaches
- trade-offs between technical approaches
- performance optimization
- code quality and best practices
- familiarity with relevant frameworks, libraries, and infrastructure

Questions should be grounded in the candidate's Resume and the JD requirements.

Do NOT ask generic textbook questions unless the JD explicitly requires that skill.

For each technical skill or project mentioned, ask about:
- how it works under the hood
- why it was chosen over alternatives
- what problems it solves
- edge cases and failure modes
- how the candidate would improve it

Example style:
"Your Resume mentions using Redis for caching. Walk me through your caching
strategy — what data did you cache, how did you handle cache invalidation, and
what was the measurable impact on response times?"
```

**Runtime:**
```
INTERVIEW MODE: Technical.

Focus follow-ups on:
- implementation details and internals
- why a specific technology or approach was chosen
- trade-offs and alternatives considered
- edge cases and failure handling
- performance characteristics
- how it connects to the JD requirements

Push vague answers like 'I used X' toward concrete technical depth:
how X works, why X over Y, what broke, and how it was fixed.
```

**Evaluation:**
```
EVALUATION MODE: Technical.

Focus evaluation on:
- depth of technical understanding (not just naming tools)
- correctness of technical claims
- specificity of implementation details
- ability to reason about trade-offs
- problem-solving approach
- awareness of edge cases and failure modes

Weight technical_depth and correctness more heavily than communication.
```

### HRScreeningStrategy

**Initial planning:**
```
Interview mode: HR Screening.

Simulate an initial recruiter-style conversation.

Focus on:
- tell me about yourself
- motivation for software engineering
- motivation for the role
- interest in the company when company information is available
- career goals
- strengths
- areas for improvement
- preferred working environment
- expectations
- general role fit

Keep questions:
- conversational
- concise
- accessible when spoken aloud

Avoid deep technical implementation questions.

Do not invent or assume personal information.

Do not ask for salary expectations, notice period, relocation, visa status,
availability, or other personal details unless explicitly provided as interview inputs.

Example style:
"What interests you about this role, and how does it fit into what you want
to work on next?"
```

**Runtime:**
```
INTERVIEW MODE: HR Screening.

Keep follow-ups conversational and focused on:
- motivation
- fit
- career goals
- communication
- role expectations

Avoid turning the interview into a technical deep dive.
```

**Evaluation:**
```
EVALUATION MODE: HR Screening.

Focus evaluation on:
- communication clarity and conciseness
- self-awareness and reflection
- motivation and role fit
- career direction and goals
- cultural fit indicators

Weight communication and clarity most heavily.
Do not penalize lack of technical depth.
```

### MixedInterviewStrategy

**Initial planning:**
```
Interview mode: Mixed Interview.

Create a realistic end-to-end software engineering interview combining:
- Resume / work experience
- Technical skills
- HR / motivation

For a 10-question interview, aim approximately for:
- 5 Resume / Experience questions
- 3 Technical questions
- 2 HR questions

Maintain reasonable distribution instead of clustering all questions in one category.

Resume questions must preserve project and experience boundaries.

Technical questions should probe depth on skills mentioned in the Resume and JD.

HR questions should remain conversational.

Do not create DSA/coding questions requiring a code editor.

The interview should feel like one realistic interview rather than unrelated
question categories.

Example topic types:
Resume: "Tell me about the biggest technical challenge you faced in MergePilot."
Technical: "How does your caching layer handle cache invalidation under high write throughput?"
HR: "What are you looking for in your next role?"
```

**Runtime:**
```
INTERVIEW MODE: Mixed Interview.

Respect the category of the current question:
- Resume question: stay focused on the candidate's experience.
- Technical question: stay focused on implementation depth and trade-offs.
- HR question: stay conversational.

Maintain the intended mixed interview balance.
```

**Evaluation:**
```
EVALUATION MODE: Mixed Interview.

Evaluate across all dimensions:
- technical_depth for resume/experience questions
- correctness and depth for technical questions
- clarity and motivation for HR questions

Balance the evaluation across technical, depth, and communication dimensions.
```

---

## 8. Environment Contract

**Required:**
| Variable | Purpose | Source |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection URL | `session.py` |
| `JWT_SECRET` | JWT signing secret (HS256) | `auth_service.py` |
| `GROQ_API_KEY` | Groq LLM API key | `llm_service.py` |

**Optional:**
| Variable | Default | Purpose |
|---|---|---|
| `JINA_API_KEY` | `""` | Jina embeddings API key |
| `ALLOWED_ORIGINS` | `https://get-hired-weld.vercel.app` | CORS origins (comma-separated) |
| `PORT` | `8000` | Server port |
| `REDIS_URL` | `""` | Redis for BullMQ (future) |
| `LOG_LEVEL` | `info` | Pino log level |

**JWT Configuration:**
- Algorithm: HS256
- Expiry: 7 days
- Payload: `{ "sub": user_id_string, "email": email_string }`
- Library: `python-jose` (Python), `@fastify/jwt` or `jsonwebtoken` (Node)

**Database:**
- PostgreSQL 16
- Driver: asyncpg (Python), pg (Node)
- Pool: max 20 connections, idle timeout 30s, connect timeout 5s
- SSL: required for non-local connections (production)
- Auto-converts `postgresql://` to `postgresql+asyncpg://` in Python

---

## 9. Interview Modes

```typescript
enum InterviewMode {
  RESUME_DEEP_DIVE = "RESUME_DEEP_DIVE",
  TECHNICAL = "TECHNICAL",
  HR_SCREENING = "HR_SCREENING",
  MIXED = "MIXED",
}
```

Default: `MIXED`

---

## 10. Question Types

```typescript
enum QuestionType {
  HR = "HR",
  PRIMARY = "PRIMARY",
  FOLLOW_UP = "FOLLOW_UP",
}
```

---

## 11. Answer Statuses

```typescript
enum AnswerStatus {
  ANSWERED = "ANSWERED",
  PARTIAL_ANSWER = "PARTIAL_ANSWER",
  DOES_NOT_KNOW = "DOES_NOT_KNOW",
  NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION",
}
```

---

## 12. Topic Statuses

```typescript
enum TopicStatus {
  AVAILABLE = "AVAILABLE",
  ACTIVE = "ACTIVE",
  EXHAUSTED = "EXHAUSTED",
  SKIPPED = "SKIPPED",
}
```

---

## 13. Analysis Statuses

```typescript
enum AnalysisStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}
```

---

## 14. Hard Rules (QuestionPlanner)

File: `application/question_planner.py`

```python
def apply_hard_rules(classification, topic_plan, current_topic, questions_answered, total_questions):
    answer_status = classification["answer_status"]
    next_action = classification["next_action"]

    # NEEDS_CLARIFICATION always forces CLARIFY
    if answer_status == "NEEDS_CLARIFICATION":
        return {**classification, "next_action": "CLARIFY"}

    # DOES_NOT_KNOW always forces NEW_TOPIC and exhausts topic
    if answer_status == "DOES_NOT_KNOW":
        if current_topic:
            current_topic.status = TopicStatus.EXHAUSTED
            current_topic.exhaustion_reason = "DOES_NOT_KNOW"
        return {**classification, "next_action": "NEW_TOPIC"}

    # Max questions per topic reached → exhaust and force NEW_TOPIC
    if current_topic and current_topic.questions_asked >= MAX_QUESTIONS_PER_TOPIC:  # MAX=2
        current_topic.status = TopicStatus.EXHAUSTED
        current_topic.exhaustion_reason = "MAX_QUESTIONS_REACHED"
        return {**classification, "next_action": "NEW_TOPIC"}

    # Budget check: if questions_remaining <= unvisited_topics, no follow-ups allowed
    questions_remaining = total_questions - questions_answered
    unvisited = [t for t in topic_plan if t.status == TopicStatus.AVAILABLE]
    if questions_remaining <= len(unvisited) and next_action == "FOLLOW_UP":
        return {**classification, "next_action": "NEW_TOPIC"}

    # If no unvisited topics remain, force NEW_TOPIC
    if not unvisited and next_action == "FOLLOW_UP":
        return {**classification, "next_action": "NEW_TOPIC"}

    return classification
```

**Constants:**
- `MAX_QUESTIONS_PER_TOPIC = 2`
- `DEDUP_THRESHOLD = 0.85` (cosine similarity)
- `MAX_TOPICS = 8`

---

## 15. InterviewService submit_answer Flow

```
1. Check interview.status.can_accept_answer() — must be WAITING_FOR_ANSWER
2. Create Answer(transcript=transcript)
3. interview.submit_answer(answer)  — records answer at current_question_index, transitions to EVALUATING
4. Get current question and current topic
5. Build PlannerContext (unvisited topics, previous QA, previous questions)
6. Resolve strategy via InterviewStrategyFactory.get(interview_mode)
7. ONE LLM CALL: classify_and_decide(resume, jd, topic, question, answer, history, strategy)
8. apply_hard_rules(classification) — Python enforces budget/exhaustion/caps
9. If CLARIFY:
   - Set status = WAITING_FOR_ANSWER
   - Save interview
   - Return response with clarification_text, is_clarification=true
10. If NEW_TOPIC and current_topic exists:
    - Exhaust current_topic (status=EXHAUSTED, set exhaustion_reason)
11. Increment current_topic.questions_asked
12. If budget allows (answered_count < total_questions):
    - If NEW_TOPIC: select next topic via planner.select_topic(), use primary_question
    - If FOLLOW_UP: use question from classify_and_decide result
    - Append new Question to interview.questions
    - interview.advance() — increments index, double-transitions to WAITING_FOR_ANSWER
    - asyncio.create_task(embedding background)
13. If budget exhausted:
    - Set status = COMPLETED
    - asyncio.create_task(analysis background)
14. Save interview
15. Return response
```

---

## 16. InterviewService get_results Flow

```
1. Load interview from repository
2. If COMPLETED and analysis is null:
   a. If analysis_status == PROCESSING: poll every 500ms up to 45s
   b. If analysis_status != PROCESSING: generate synchronously with asyncio.Lock
3. Build topic_map: question_index → (topic_label, topic_source)
4. For each question, find matching answer and topic
5. Return {interview_id, status, results: [...], analysis}
```

---

## 17. Auth Behavior

- Passwords hashed with bcrypt (truncated to 72 bytes)
- JWT signed with HS256, 7-day expiry
- Payload: `{sub: user_id, email: email}`
- AuthMiddleware runs on every request
- Skips public paths: `/`, `/health`, `/api/auth/login`, `/api/auth/register`, `/docs`, `/openapi.json`, `/redoc`
- Skips OPTIONS requests (CORS preflight)
- Skips non-`/api/` paths
- If Bearer token present: verify JWT, set `request.state.user = {id, email}` or `None`
- If no token: `request.state.user = None` (downstream routes decide)
- `ensure_user_exists()` auto-creates DB user for first-time OAuth JWTs

---

## 18. Database Schema Summary

**users:**
- id (UUID, PK)
- name (VARCHAR 255)
- email (VARCHAR 255, UNIQUE)
- password_hash (VARCHAR 255)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

**interviews:**
- id (UUID, PK)
- user_id (UUID, FK→users, nullable)
- candidate_name (VARCHAR 255)
- job_role (VARCHAR 255)
- interview_mode (VARCHAR 50, default "MIXED")
- status (VARCHAR 50, default "CREATED")
- resume_id (UUID, FK→resumes, nullable)
- current_question_index (INT, default 0)
- total_questions (INT, default 10)
- resume_snapshot (TEXT, default "")
- jd_snapshot (TEXT, default "")
- topic_plan (TEXT, default "[]") — JSON serialized
- current_topic_id (VARCHAR 255, nullable)
- analysis (TEXT, nullable) — JSON serialized
- analysis_status (VARCHAR 50, default "PENDING")
- created_at (TIMESTAMPTZ)

**questions:**
- id (UUID, PK)
- interview_id (UUID, FK→interviews, CASCADE)
- question_text (TEXT)
- question_index (INT)
- question_type (VARCHAR 20, default "PRIMARY")
- created_at (TIMESTAMPTZ)

**answers:**
- id (UUID, PK)
- interview_id (UUID, FK→interviews, CASCADE)
- question_id (UUID, FK→questions, CASCADE)
- transcript (TEXT, default "")
- answer_status (VARCHAR 20, nullable)
- created_at (TIMESTAMPTZ)

**resumes:**
- id (UUID, PK)
- user_id (UUID, FK→users, CASCADE)
- title (VARCHAR 255, default "Untitled Resume")
- personal_info (TEXT, default "{}") — JSON serialized
- skills (TEXT, default "")
- template (VARCHAR 50, default "classic")
- section_order (TEXT, default '["education","skills","experience","projects"]') — JSON serialized
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

**resume_education:**
- id (UUID, PK)
- resume_id (UUID, FK→resumes, CASCADE)
- sort_order (INT, default 0)
- college (VARCHAR 255, default "")
- degree (VARCHAR 255, default "")
- cgpa (VARCHAR 50, default "")
- start_year (VARCHAR 20, default "")
- end_year (VARCHAR 20, default "")

**resume_experience:**
- id (UUID, PK)
- resume_id (UUID, FK→resumes, CASCADE)
- sort_order (INT, default 0)
- company (VARCHAR 255, default "")
- role (VARCHAR 255, default "")
- description (TEXT, default "")

**resume_projects:**
- id (UUID, PK)
- resume_id (UUID, FK→resumes, CASCADE)
- sort_order (INT, default 0)
- name (VARCHAR 255, default "")
- technologies (VARCHAR 500, default "")
- description (TEXT, default "")
