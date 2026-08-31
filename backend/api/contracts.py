from pydantic import BaseModel, Field, model_validator

from domain.resume import Resume


# ── Auth contracts ───────────────────────────────────────────────


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


# ── Interview contracts ───────────────────────────────────────────


class StartInterviewRequest(BaseModel):
    candidate_name: str
    job_role: str
    resume_id: str | None = None
    resume_text: str | None = None
    jd_text: str
    total_questions: int = 10

    @model_validator(mode="after")
    def validate_resume_source(self):
        if not self.resume_id and not self.resume_text:
            raise ValueError("Either resume_id or resume_text is required")
        if self.resume_id and self.resume_text:
            raise ValueError("Provide either resume_id or resume_text, not both")
        return self


class StartInterviewResponse(BaseModel):
    interview_id: str
    total_questions: int
    question: str
    question_index: int


class AnswerRequest(BaseModel):
    transcript: str


class QuestionFeedback(BaseModel):
    question_number: int
    score: int = Field(ge=0, le=100)
    what_went_well: str
    what_was_missing: str
    how_to_improve: str


class JdMatch(BaseModel):
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)


class AnalysisResult(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    dimensions: dict[str, int] = Field(default_factory=dict)
    strengths: list[str] = Field(default_factory=list)
    areas_to_improve: list[str] = Field(default_factory=list)
    recurring_patterns: list[str] = Field(default_factory=list)
    question_feedback: list[QuestionFeedback] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    jd_match: JdMatch | None = None

    @model_validator(mode="before")
    @classmethod
    def coerce_and_compat(cls, data):
        if isinstance(data, dict):
            if isinstance(data.get("overall_score"), float):
                data["overall_score"] = round(data["overall_score"])
            for dim in (data.get("dimensions") or {}).values():
                if isinstance(dim, float):
                    data["dimensions"] = {
                        k: round(v) for k, v in data["dimensions"].items()
                    }
            if "dimensions" not in data:
                data["dimensions"] = {}
            if "recurring_patterns" not in data:
                data["recurring_patterns"] = []
            if "question_feedback" not in data:
                data["question_feedback"] = []
            if "recommendations" not in data:
                data["recommendations"] = []
            if "jd_match" not in data:
                data["jd_match"] = None
        return data


class AnswerResponse(BaseModel):
    interview_id: str
    question_index: int | None = None
    answered_count: int
    status: str
    next_question: str | None = None
    next_question_index: int | None = None
    total_questions: int | None = None
    is_clarification: bool = False
    next_action: str | None = None
    analysis: AnalysisResult | None = None


class QuestionResult(BaseModel):
    question_index: int
    question: str
    answer: str
    question_type: str | None = None
    topic_label: str | None = None
    topic_source: str | None = None
    answer_status: str | None = None


class InterviewResultResponse(BaseModel):
    interview_id: str
    status: str
    results: list[QuestionResult]
    analysis: AnalysisResult | None = None


# ── RAG contracts ─────────────────────────────────────────────────

MAX_CHARS = 15000


class IngestRequest(BaseModel):
    resume_text: str = Field(..., max_length=MAX_CHARS)
    jd_text: str = Field(..., max_length=MAX_CHARS)
    interview_id: str | None = None


class DocumentResult(BaseModel):
    document_id: str
    chunks_count: int


class IngestResponse(BaseModel):
    resume: DocumentResult
    jd: DocumentResult


class RetrieveRequest(BaseModel):
    query: str
    interview_id: str | None = None
    top_k: int = 5
    document_type: str | None = None


class RetrieveResponse(BaseModel):
    query: str
    results: list[dict]


# ── Resume contracts ──────────────────────────────────────────────


class EducationInput(BaseModel):
    id: str | None = None
    college: str = ""
    degree: str = ""
    cgpa: str = ""
    startYear: str = ""
    endYear: str = ""


class ExperienceInput(BaseModel):
    id: str | None = None
    company: str = ""
    role: str = ""
    description: str = ""


class ProjectInput(BaseModel):
    id: str | None = None
    name: str = ""
    technologies: str = ""
    description: str = ""


class CreateResumeRequest(BaseModel):
    title: str = "Untitled Resume"
    personal_info: dict = Field(default_factory=dict)
    skills: str = ""
    template: str = "classic"
    section_order: list[str] = Field(default_factory=lambda: ["education", "skills", "experience", "projects"])
    education: list[EducationInput] = Field(default_factory=list)
    experience: list[ExperienceInput] = Field(default_factory=list)
    projects: list[ProjectInput] = Field(default_factory=list)


class UpdateResumeRequest(BaseModel):
    title: str | None = None
    personal_info: dict | None = None
    skills: str | None = None
    template: str | None = None
    section_order: list[str] | None = None
    education: list[EducationInput] | None = None
    experience: list[ExperienceInput] | None = None
    projects: list[ProjectInput] | None = None


class ResumeListResponse(BaseModel):
    resumes: list[dict]


class ResumeResponse(BaseModel):
    id: str
    title: str
    personal_info: dict
    skills: str
    template: str
    section_order: list[str]
    education: list[dict]
    experience: list[dict]
    projects: list[dict]

    @classmethod
    def from_domain(cls, resume: Resume) -> "ResumeResponse":
        return cls(
            id=str(resume.id),
            title=resume.title,
            personal_info=resume.personal_info,
            skills=resume.skills,
            template=resume.template,
            section_order=resume.section_order,
            education=[
                {
                    "id": str(e.id),
                    "college": e.college,
                    "degree": e.degree,
                    "cgpa": e.cgpa,
                    "startYear": e.start_year,
                    "endYear": e.end_year,
                }
                for e in resume.education
            ],
            experience=[
                {
                    "id": str(e.id),
                    "company": e.company,
                    "role": e.role,
                    "description": e.description,
                }
                for e in resume.experience
            ],
            projects=[
                {
                    "id": str(p.id),
                    "name": p.name,
                    "technologies": p.technologies,
                    "description": p.description,
                }
                for p in resume.projects
            ],
        )


class DeleteResponse(BaseModel):
    message: str


class GenerateDescriptionRequest(BaseModel):
    type: str
    company: str | None = None
    role: str | None = None
    name: str | None = None
    technologies: str | None = None


class GenerateDescriptionResponse(BaseModel):
    description: str


class AnalyzeResumeRequest(BaseModel):
    personal_info: dict = Field(default_factory=dict)
    education: list[dict] = Field(default_factory=list)
    experience: list[dict] = Field(default_factory=list)
    projects: list[dict] = Field(default_factory=list)
    skills: str = ""
