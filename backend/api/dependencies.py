from __future__ import annotations

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from infrastructure.repositories.document_repository import DocumentRepository
from infrastructure.repositories.interview_repository import PostgresInterviewRepository
from infrastructure.repositories.resume_repository import PostgresResumeRepository
from application.rag_service import RAGService
from application.llm_service import LLMService
from application.auth_service import AuthService
from application.question_planner import QuestionPlanner
from application.interview_service import InterviewService
from application.resume_service import ResumeService

_document_repo: DocumentRepository | None = None
_interview_repo: PostgresInterviewRepository | None = None
_resume_repo: PostgresResumeRepository | None = None
_rag_service: RAGService | None = None
_llm_service: LLMService | None = None
_planner: QuestionPlanner | None = None
_auth_service: AuthService | None = None


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


def _get_resume_repo() -> PostgresResumeRepository:
    global _resume_repo
    if _resume_repo is None:
        _resume_repo = PostgresResumeRepository()
    return _resume_repo


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


def get_resume_service() -> ResumeService:
    return ResumeService(repository=_get_resume_repo())


def get_llm_service() -> LLMService:
    return _get_llm_service()


def get_auth_service() -> AuthService:
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service


# ── Auth middleware ───────────────────────────────────────────────

# Routes that don't require authentication
PUBLIC_PATHS = {
    "/",
    "/health",
    "/api/auth/login",
    "/api/auth/register",
    "/docs",
    "/openapi.json",
    "/redoc",
}


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Allow public paths and OPTIONS requests
        if path in PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        # Allow static files and frontend
        if not path.startswith("/api/"):
            return await call_next(request)

        # Check for auth header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return await call_next(request)

        token = auth_header.split(" ", 1)[1]
        service = get_auth_service()
        user = service.verify_token(token)

        if user:
            request.state.user = user
        else:
            request.state.user = None

        return await call_next(request)
