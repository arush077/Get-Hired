from abc import ABC, abstractmethod
from uuid import UUID

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
