from infrastructure.repositories.base import InterviewRepositoryInterface
from infrastructure.repositories.postgres_interview_repository import PostgresInterviewRepository

_repository: InterviewRepositoryInterface | None = None


def get_repository() -> InterviewRepositoryInterface:
    global _repository
    if _repository is None:
        _repository = PostgresInterviewRepository()
    return _repository


def get_interview_service() -> "InterviewService":
    from application.interview_service import InterviewService

    return InterviewService(get_repository())
