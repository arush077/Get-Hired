from pydantic import BaseModel, model_validator


class StartInterviewRequest(BaseModel):
    candidate_name: str
    job_role: str
    resume_text: str
    jd_text: str
    total_questions: int = 10


class StartInterviewResponse(BaseModel):
    interview_id: str
    total_questions: int
    question: str
    question_index: int


class AnswerRequest(BaseModel):
    transcript: str


class AnalysisResult(BaseModel):
    overall_score: int
    strengths: list[str]
    areas_to_improve: list[str]

    @model_validator(mode="before")
    @classmethod
    def coerce_score(cls, data):
        if isinstance(data, dict) and isinstance(data.get("overall_score"), float):
            data["overall_score"] = round(data["overall_score"])
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
    analysis: AnalysisResult | None = None


class QuestionResult(BaseModel):
    question_index: int
    question: str
    answer: str


class InterviewResultResponse(BaseModel):
    interview_id: str
    status: str
    results: list[QuestionResult]
    analysis: AnalysisResult | None = None
