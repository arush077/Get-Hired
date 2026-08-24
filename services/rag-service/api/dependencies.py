from application.rag_service import RAGService
from infrastructure.repositories.document_repository import DocumentRepository

_repository = DocumentRepository()
_service = RAGService(document_repository=_repository)


def get_rag_service() -> RAGService:
    return _service
