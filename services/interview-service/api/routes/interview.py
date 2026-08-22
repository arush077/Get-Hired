from uuid import UUID

from fastapi import APIRouter, HTTPException

from shared.contracts.interview import (
    StartInterviewRequest,
    StartInterviewResponse,
    AnswerRequest,
    AnswerResponse,
    InterviewResultResponse,
)
from application.interview_service import InterviewService
from infrastructure.repositories.interview_repository import InterviewRepository

router = APIRouter(prefix="/interviews", tags=["interviews"])

_repository = InterviewRepository()
_service = InterviewService(_repository)


@router.post("", response_model=StartInterviewResponse)
def start_interview(payload: StartInterviewRequest):
    interview = _service.start_interview(payload.candidate_name, payload.job_role)
    question = interview.current_question()
    return StartInterviewResponse(
        interview_id=str(interview.id),
        total_questions=interview.total_questions,
        question=question.text,
        question_index=0,
    )


@router.get("/{interview_id}/results", response_model=InterviewResultResponse)
def get_results(interview_id: str):
    try:
        uid = UUID(interview_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview ID")

    results = _service.get_results(uid)
    if not results:
        raise HTTPException(status_code=404, detail="Interview not found")

    return results


@router.post("/{interview_id}/answers", response_model=AnswerResponse)
def submit_answer(interview_id: str, payload: AnswerRequest):
    try:
        uid = UUID(interview_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview ID")

    result = _service.submit_answer(uid, payload.transcript)
    if not result:
        raise HTTPException(status_code=404, detail="Interview not found or invalid state")

    return result
