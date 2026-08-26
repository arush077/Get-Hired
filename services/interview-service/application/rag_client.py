import asyncio
import logging
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:8004")

RETRY_DELAYS = [2, 4, 8]
RETRYABLE_STATUS = {502, 503, 504}


class RAGClient:
    def __init__(self):
        self._base_url = RAG_SERVICE_URL
        self._client = httpx.AsyncClient(timeout=90.0)

    async def warm_up(self) -> bool:
        try:
            resp = await self._client.get(
                f"{self._base_url}/health", timeout=5.0
            )
            return resp.status_code == 200
        except (httpx.TimeoutException, httpx.ConnectError):
            return False

    async def _request_with_retry(
        self, method: str, url: str, **kwargs
    ) -> httpx.Response:
        for attempt in range(len(RETRY_DELAYS) + 1):
            try:
                response = await self._client.request(
                    method, url, timeout=90.0, **kwargs
                )
                if response.status_code == 429:
                    retry_after = response.headers.get("retry-after")
                    if retry_after and attempt == 0:
                        await asyncio.sleep(int(retry_after))
                        continue
                    response.raise_for_status()
                if response.status_code in RETRYABLE_STATUS and attempt < len(RETRY_DELAYS):
                    await asyncio.sleep(RETRY_DELAYS[attempt])
                    continue
                response.raise_for_status()
                return response
            except (httpx.TimeoutException, httpx.ConnectError):
                if attempt < len(RETRY_DELAYS):
                    await asyncio.sleep(RETRY_DELAYS[attempt])
                    continue
                raise

    async def ingest_documents(
        self, resume_text: str, jd_text: str, interview_id: str
    ) -> dict:
        is_warm = await self.warm_up()
        if not is_warm:
            logger.warning("RAG service warm-up failed, proceeding with retries")

        response = await self._request_with_retry(
            "POST",
            f"{self._base_url}/rag/ingest",
            json={
                "resume_text": resume_text,
                "jd_text": jd_text,
                "interview_id": interview_id,
            },
        )
        return response.json()

    async def retrieve_context(
        self, query: str, interview_id: str, top_k: int = 3
    ) -> list[str]:
        response = await self._request_with_retry(
            "POST",
            f"{self._base_url}/rag/retrieve",
            json={
                "query": query,
                "interview_id": interview_id,
                "top_k": top_k,
            },
        )
        data = response.json()
        return [r["content"] for r in data.get("results", [])]
