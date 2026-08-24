from pydantic import BaseModel


class StartInterviewRequest(BaseModel):
    candidate_name: str
    job_role: str
    resume_text: str
    jd_text: str


class StartInterviewResponse(BaseModel):
    interview_id: str
    total_questions: int
    question: str
    question_index: int


class AnswerRequest(BaseModel):
    transcript: str


class AnswerResponse(BaseModel):
    interview_id: str
    question_index: int
    answered_count: int
    status: str
    next_question: str | None = None
    next_question_index: int | None = None
    total_questions: int | None = None


class QuestionResult(BaseModel):
    question_index: int
    question: str
    answer: str


class InterviewResultResponse(BaseModel):
    interview_id: str
    status: str
    results: list[QuestionResult]
