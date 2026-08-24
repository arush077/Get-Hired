from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException

from application.rag_service import RAGService
from api.dependencies import get_rag_service

router = APIRouter(prefix="/rag", tags=["rag"])

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


@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(
    payload: IngestRequest,
    service: RAGService = Depends(get_rag_service),
):
    if not payload.resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume text cannot be empty")
    if not payload.jd_text.strip():
        raise HTTPException(status_code=400, detail="Job description text cannot be empty")

    results = await service.ingest_documents(
        resume_text=payload.resume_text,
        jd_text=payload.jd_text,
        interview_id=payload.interview_id,
    )

    return IngestResponse(
        resume=DocumentResult(
            document_id=results["resume"]["document_id"],
            chunks_count=results["resume"]["chunks_count"],
        ),
        jd=DocumentResult(
            document_id=results["job_description"]["document_id"],
            chunks_count=results["job_description"]["chunks_count"],
        ),
    )
