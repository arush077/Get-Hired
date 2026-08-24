from abc import ABC, abstractmethod
from uuid import UUID

from domain.chunk import Chunk
from domain.document import Document, DocumentChunk


class ChunkRepositoryInterface(ABC):
    @abstractmethod
    def save_chunks(self, chunks: list[Chunk]) -> None:
        pass

    @abstractmethod
    def search(self, query_embedding: list[float], top_k: int = 5, source: str | None = None) -> list[Chunk]:
        pass

    @abstractmethod
    def delete_by_source(self, source: str) -> bool:
        pass


class DocumentRepositoryInterface(ABC):
    @abstractmethod
    async def save_document(self, document: Document) -> UUID:
        pass

    @abstractmethod
    async def save_chunks(self, document_id: UUID, chunks: list[DocumentChunk]) -> list[DocumentChunk]:
        pass

    @abstractmethod
    async def search_chunks(
        self, query_embedding: list[float], top_k: int = 5, document_type: str | None = None,
        document_ids: list[UUID] | None = None,
    ) -> list[DocumentChunk]:
        pass

    @abstractmethod
    async def link_interview(
        self, interview_id: UUID, resume_document_id: UUID, jd_document_id: UUID
    ) -> None:
        pass

    @abstractmethod
    async def get_document_ids_by_interview(self, interview_id: UUID) -> list[UUID]:
        pass
