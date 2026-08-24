from infrastructure.repositories.base import InterviewRepositoryInterface
from infrastructure.repositories.postgres_interview_repository import PostgresInterviewRepository
from application.llm_service import LLMService
from application.rag_client import RAGClient
from application.interview_service import InterviewService

_repository: InterviewRepositoryInterface | None = None
_llm_service: LLMService | None = None
_rag_client: RAGClient | None = None


def get_repository() -> InterviewRepositoryInterface:
    global _repository
    if _repository is None:
        _repository = PostgresInterviewRepository()
    return _repository


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


def get_rag_client() -> RAGClient:
    global _rag_client
    if _rag_client is None:
        _rag_client = RAGClient()
    return _rag_client


def get_interview_service() -> InterviewService:
    return InterviewService(
        repository=get_repository(),
        llm_service=get_llm_service(),
        rag_client=get_rag_client(),
    )
