from infrastructure.repositories.interview_repository import InterviewRepository
from infrastructure.repositories.base import InterviewRepositoryInterface

_repository: InterviewRepositoryInterface | None = None


def get_repository() -> InterviewRepositoryInterface:
    global _repository
    if _repository is None:
        _repository = InterviewRepository()
    return _repository


def get_interview_service() -> "InterviewService":
    from application.interview_service import InterviewService

    return InterviewService(get_repository())
