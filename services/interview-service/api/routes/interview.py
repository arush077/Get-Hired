from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from shared.contracts.interview import (
    StartInterviewRequest,
    StartInterviewResponse,
    AnswerRequest,
    AnswerResponse,
    InterviewResultResponse,
)
from application.interview_service import InterviewService
from api.dependencies import get_interview_service

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.post("", response_model=StartInterviewResponse)
async def start_interview(
    payload: StartInterviewRequest,
    service: InterviewService = Depends(get_interview_service),
):
    interview = await service.start_interview(
        candidate_name=payload.candidate_name,
        job_role=payload.job_role,
        resume_text=payload.resume_text,
        jd_text=payload.jd_text,
    )
    question = interview.current_question()
    return StartInterviewResponse(
        interview_id=str(interview.id),
        total_questions=interview.total_questions,
        question=question.text,
        question_index=0,
    )


@router.get("/{interview_id}/results", response_model=InterviewResultResponse)
async def get_results(
    interview_id: str,
    service: InterviewService = Depends(get_interview_service),
):
    try:
        uid = UUID(interview_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview ID")

    results = await service.get_results(uid)
    if not results:
        raise HTTPException(status_code=404, detail="Interview not found")

    return results


@router.post("/{interview_id}/answers", response_model=AnswerResponse)
async def submit_answer(
    interview_id: str,
    payload: AnswerRequest,
    service: InterviewService = Depends(get_interview_service),
):
    try:
        uid = UUID(interview_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview ID")

    result = await service.submit_answer(uid, payload.transcript)
    if not result:
        raise HTTPException(status_code=404, detail="Interview not found or invalid state")

    return result
