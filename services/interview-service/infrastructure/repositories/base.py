from abc import ABC, abstractmethod
from uuid import UUID

from domain.interview import Interview


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
