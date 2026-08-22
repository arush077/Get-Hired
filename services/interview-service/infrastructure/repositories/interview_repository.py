from uuid import UUID

from domain.interview import Interview


class InterviewRepository:
    def __init__(self):
        self._store: dict[UUID, Interview] = {}

    def save(self, interview: Interview) -> None:
        self._store[interview.id] = interview

    def get(self, interview_id: UUID) -> Interview | None:
        return self._store.get(interview_id)

    def list_all(self) -> list[Interview]:
        return list(self._store.values())

    def delete(self, interview_id: UUID) -> bool:
        if interview_id in self._store:
            del self._store[interview_id]
            return True
        return False
