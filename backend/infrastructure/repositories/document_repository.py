from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.document import Document, DocumentChunk
from infrastructure.db.models import DocumentChunkModel, DocumentModel, InterviewDocumentModel
from infrastructure.db.session import get_session_factory
from infrastructure.repositories.base import DocumentRepositoryInterface


class DocumentRepository(DocumentRepositoryInterface):
    def __init__(self):
        self._get_session_factory = get_session_factory

    async def save_document(self, document: Document) -> UUID:
        async with self._get_session_factory()() as session:
            async with session.begin():
                db_doc = DocumentModel(
                    id=document.id,
                    document_type=document.document_type,
                )
                session.add(db_doc)
        return document.id

    async def save_chunks(self, document_id: UUID, chunks: list[DocumentChunk]) -> list[DocumentChunk]:
        async with self._get_session_factory()() as session:
            async with session.begin():
                for chunk in chunks:
                    db_chunk = DocumentChunkModel(
                        id=chunk.id,
                        document_id=document_id,
                        chunk_index=chunk.chunk_index,
                        content=chunk.content,
                        embedding=chunk.embedding,
                    )
                    session.add(db_chunk)
        return chunks

    async def search_chunks(
        self, query_embedding: list[float], top_k: int = 5, document_type: str | None = None,
        document_ids: list[UUID] | None = None,
    ) -> list[DocumentChunk]:
        async with self._get_session_factory()() as session:
            cosine_dist = DocumentChunkModel.embedding.cosine_distance(query_embedding)

            query = (
                select(DocumentChunkModel, cosine_dist.label("distance"))
                .order_by(cosine_dist)
                .limit(top_k)
            )

            if document_ids is not None:
                if len(document_ids) == 0:
                    return []
                query = query.where(DocumentChunkModel.document_id.in_(document_ids))
            elif document_type:
                query = query.join(
                    DocumentModel, DocumentChunkModel.document_id == DocumentModel.id
                ).where(DocumentModel.document_type == document_type)

            result = await session.execute(query)
            rows = result.all()

            return [
                DocumentChunk(
                    id=row.DocumentChunkModel.id,
                    document_id=row.DocumentChunkModel.document_id,
                    chunk_index=row.DocumentChunkModel.chunk_index,
                    content=row.DocumentChunkModel.content,
                    embedding=row.DocumentChunkModel.embedding,
                    created_at=row.DocumentChunkModel.created_at,
                )
                for row in rows
            ]

    async def link_interview(
        self, interview_id: UUID, resume_document_id: UUID, jd_document_id: UUID
    ) -> None:
        async with self._get_session_factory()() as session:
            async with session.begin():
                link = InterviewDocumentModel(
                    interview_id=interview_id,
                    resume_document_id=resume_document_id,
                    jd_document_id=jd_document_id,
                )
                session.add(link)

    async def get_document_ids_by_interview(self, interview_id: UUID) -> list[UUID]:
        async with self._get_session_factory()() as session:
            result = await session.execute(
                select(InterviewDocumentModel).where(
                    InterviewDocumentModel.interview_id == interview_id
                )
            )
            link = result.scalar_one_or_none()
            if not link:
                return []
            return [link.resume_document_id, link.jd_document_id]
