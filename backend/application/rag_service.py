import os
from uuid import uuid4

import httpx
from dotenv import load_dotenv

from domain.document import Document, DocumentChunk
from infrastructure.repositories.base import DocumentRepositoryInterface

load_dotenv()

JINA_API_URL = "https://api.jina.ai/v1/embeddings"
JINA_API_KEY = os.getenv("JINA_API_KEY", "")
EMBEDDING_MODEL = "jina-embeddings-v5-text-nano"
EMBEDDING_DIMENSIONS = 768
BATCH_SIZE = 32  # Process in small batches for Render Free (512 MB RAM)


class RAGService:
    def __init__(self, document_repository: DocumentRepositoryInterface):
        self._repo = document_repository
        self._chunk_size = 500
        self._chunk_overlap = 50
        self._client = httpx.AsyncClient(timeout=60.0)
        self._last_chunks: list[dict] = []

    def _split_text(self, text: str) -> list[str]:
        chunks = []
        start = 0
        while start < len(text):
            end = start + self._chunk_size
            chunk_text = text[start:end]

            # Try to break at sentence boundary
            if end < len(text):
                last_period = chunk_text.rfind(".")
                last_newline = chunk_text.rfind("\n")
                break_at = max(last_period, last_newline)
                if break_at > self._chunk_size // 2:
                    chunk_text = text[start : start + break_at + 1]
                    end = start + break_at + 1

            chunks.append(chunk_text.strip())
            start = end - self._chunk_overlap

        return [c for c in chunks if c]  # remove empty

    async def get_embeddings(self, texts: list[str], task: str = "retrieval.passage") -> list[list[float]]:
        all_embeddings: list[list[float]] = []

        # Process in batches for Render Free (512 MB RAM)
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]

            response = await self._client.post(
                JINA_API_URL,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {JINA_API_KEY}",
                },
                json={
                    "model": EMBEDDING_MODEL,
                    "task": task,
                    "input": batch,
                },
            )
            response.raise_for_status()
            data = response.json()

            # Sort by index to maintain order
            sorted_data = sorted(data["data"], key=lambda x: x["index"])
            all_embeddings.extend([item["embedding"] for item in sorted_data])

        return all_embeddings

    async def ingest_documents(self, resume_text: str, jd_text: str, interview_id: str | None = None) -> dict:
        results = {}
        resume_doc_id = None
        all_chunks: list[dict] = []

        for doc_type, text in [("resume", resume_text), ("job_description", jd_text)]:
            document = Document(id=uuid4(), document_type=doc_type)
            await self._repo.save_document(document)

            raw_chunks = self._split_text(text)
            embeddings = await self.get_embeddings(raw_chunks, task="retrieval.passage")

            chunks = [
                DocumentChunk(
                    id=uuid4(),
                    document_id=document.id,
                    chunk_index=i,
                    content=raw_chunks[i],
                    embedding=embeddings[i],
                )
                for i in range(len(raw_chunks))
            ]

            await self._repo.save_chunks(document.id, chunks)

            if doc_type == "resume":
                resume_doc_id = document.id

            results[doc_type] = {
                "document_id": str(document.id),
                "chunks_count": len(chunks),
            }

            for chunk in chunks:
                all_chunks.append({
                    "id": str(chunk.id),
                    "content": chunk.content,
                    "document_type": doc_type,
                })

        if interview_id and resume_doc_id:
            jd_doc_id = results["job_description"]["document_id"]
            from uuid import UUID as _UUID
            await self._repo.link_interview(
                interview_id=_UUID(interview_id),
                resume_document_id=resume_doc_id,
                jd_document_id=_UUID(jd_doc_id),
            )

        results["chunks"] = all_chunks
        self._last_chunks = all_chunks
        return results

    async def retrieve(
        self, query: str, top_k: int = 5, document_type: str | None = None,
        interview_id: str | None = None,
    ) -> list[DocumentChunk]:
        query_embedding = (await self.get_embeddings([query], task="retrieval.query"))[0]

        document_ids = None
        if interview_id:
            from uuid import UUID as _UUID
            document_ids = await self._repo.get_document_ids_by_interview(_UUID(interview_id))

        results = await self._repo.search_chunks(
            query_embedding=query_embedding,
            top_k=top_k,
            document_type=document_type,
            document_ids=document_ids,
        )

        return results

    async def get_chunks_by_ids(self, chunk_ids: list[str]) -> list[DocumentChunk]:
        """Retrieve specific chunks by their IDs."""
        if not chunk_ids:
            return []
        from uuid import UUID as _UUID
        uuids = [_UUID(cid) for cid in chunk_ids]
        return await self._repo.search_chunks_by_ids(uuids)
