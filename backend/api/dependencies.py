from __future__ import annotations

from infrastructure.repositories.document_repository import DocumentRepository
from infrastructure.repositories.interview_repository import PostgresInterviewRepository
from application.rag_service import RAGService
from application.llm_service import LLMService
from application.question_planner import QuestionPlanner
from application.interview_service import InterviewService

_document_repo: DocumentRepository | None = None
_interview_repo: PostgresInterviewRepository | None = None
_rag_service: RAGService | None = None
_llm_service: LLMService | None = None
_planner: QuestionPlanner | None = None


def _get_document_repo() -> DocumentRepository:
    global _document_repo
    if _document_repo is None:
        _document_repo = DocumentRepository()
    return _document_repo


def _get_interview_repo() -> PostgresInterviewRepository:
    global _interview_repo
    if _interview_repo is None:
        _interview_repo = PostgresInterviewRepository()
    return _interview_repo


def _get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService(document_repository=_get_document_repo())
    return _rag_service


def _get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


def _get_planner() -> QuestionPlanner:
    global _planner
    if _planner is None:
        _planner = QuestionPlanner()
    return _planner


def get_interview_service() -> InterviewService:
    return InterviewService(
        repository=_get_interview_repo(),
        llm_service=_get_llm_service(),
        rag_service=_get_rag_service(),
        planner=_get_planner(),
    )


def get_rag_service() -> RAGService:
    return _get_rag_service()
