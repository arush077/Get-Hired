from abc import ABC, abstractmethod
from uuid import UUID

from domain.document import Document, DocumentChunk
from domain.interview import Interview
from domain.resume import Resume


class InterviewRepositoryInterface(ABC):
    @abstractmethod
    def save(self, interview: Interview) -> None:
        pass

    @abstractmethod
    def get(self, interview_id: UUID) -> Interview | None:
        pass

    @abstractmethod
    def list_all(self) -> list[Interview]:
        pass

    @abstractmethod
    def delete(self, interview_id: UUID) -> bool:
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


class ResumeRepositoryInterface(ABC):
    @abstractmethod
    async def create(self, resume: Resume) -> Resume:
        pass

    @abstractmethod
    async def get(self, resume_id: UUID, user_id: UUID) -> Resume | None:
        pass

    @abstractmethod
    async def list_by_user(self, user_id: UUID) -> list[dict]:
        pass

    @abstractmethod
    async def update(self, resume: Resume) -> Resume | None:
        pass

    @abstractmethod
    async def delete(self, resume_id: UUID, user_id: UUID) -> bool:
        pass
