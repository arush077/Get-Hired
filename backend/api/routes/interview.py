from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from groq import RateLimitError

from api.contracts import (
    StartInterviewRequest,
    StartInterviewResponse,
    AnswerRequest,
    AnswerResponse,
    InterviewResultResponse,
)
from application.interview_service import InterviewService
from api.dependencies import get_interview_service

router = APIRouter(prefix="/api/interviews", tags=["interviews"])


@router.post("", response_model=StartInterviewResponse)
async def start_interview(
    request: Request,
    payload: StartInterviewRequest,
    service: InterviewService = Depends(get_interview_service),
):
    user = getattr(request.state, "user", None)
    user_id = UUID(user["id"]) if user else None

    try:
        interview = await service.start_interview(
            candidate_name=payload.candidate_name,
            job_role=payload.job_role,
            jd_text=payload.jd_text,
            total_questions=payload.total_questions,
            interview_mode=payload.interview_mode,
            user_id=user_id,
            resume_id=payload.resume_id,
            resume_text=payload.resume_text,
        )
    except RateLimitError:
        raise HTTPException(status_code=429, detail="AI service rate limited. Please try again in a few minutes.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    question = interview.current_question()
    return StartInterviewResponse(
        interview_id=str(interview.id),
        total_questions=interview.total_questions,
        question=question.text,
        question_index=0,
        interview_mode=interview.interview_mode.value,
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

    try:
        result = await service.submit_answer(uid, payload.transcript)
    except RateLimitError:
        raise HTTPException(status_code=429, detail="AI service rate limited. Please try again in a few minutes.")
    if not result:
        raise HTTPException(status_code=404, detail="Interview not found or invalid state")

    return result
