import os

import httpx
from dotenv import load_dotenv

load_dotenv()

RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:8004")


class RAGClient:
    def __init__(self):
        self._base_url = RAG_SERVICE_URL
        self._client = httpx.AsyncClient(timeout=60.0)

    async def ingest_documents(
        self, resume_text: str, jd_text: str, interview_id: str
    ) -> dict:
        response = await self._client.post(
            f"{self._base_url}/rag/ingest",
            json={
                "resume_text": resume_text,
                "jd_text": jd_text,
                "interview_id": interview_id,
            },
        )
        response.raise_for_status()
        return response.json()

    async def retrieve_context(
        self, query: str, interview_id: str, top_k: int = 3
    ) -> list[str]:
        response = await self._client.post(
            f"{self._base_url}/rag/retrieve",
            json={
                "query": query,
                "interview_id": interview_id,
                "top_k": top_k,
            },
        )
        response.raise_for_status()
        data = response.json()
        return [r["content"] for r in data.get("results", [])]
