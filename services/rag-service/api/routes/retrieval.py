from pydantic import BaseModel

from fastapi import APIRouter, Depends

from application.rag_service import RAGService
from api.dependencies import get_rag_service

router = APIRouter(prefix="/rag", tags=["rag"])


class RetrieveRequest(BaseModel):
    query: str
    interview_id: str | None = None
    top_k: int = 5
    document_type: str | None = None


class RetrieveResponse(BaseModel):
    query: str
    results: list[dict]


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
