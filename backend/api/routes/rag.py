from fastapi import APIRouter, Depends, HTTPException

from api.contracts import (
    IngestRequest,
    IngestResponse,
    DocumentResult,
    RetrieveRequest,
    RetrieveResponse,
)
from application.rag_service import RAGService
from api.dependencies import get_rag_service

router = APIRouter(prefix="/rag", tags=["rag"])


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


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve_chunks(
    payload: RetrieveRequest,
    service: RAGService = Depends(get_rag_service),
):
    chunks = await service.retrieve(
        query=payload.query,
        top_k=payload.top_k,
        document_type=payload.document_type,
        interview_id=payload.interview_id,
    )

    return RetrieveResponse(
        query=payload.query,
        results=[
            {
                "id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "content": chunk.content,
            }
            for chunk in chunks
        ],
    )
