import os

import httpx
from dotenv import load_dotenv

load_dotenv()

JINA_API_URL = "https://api.jina.ai/v1/embeddings"
JINA_API_KEY = os.getenv("JINA_API_KEY", "")
EMBEDDING_MODEL = "jina-embeddings-v5-text-nano"
BATCH_SIZE = 32


class EmbeddingService:
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=60.0)

    async def get_embeddings(self, texts: list[str], task: str = "retrieval.passage") -> list[list[float]]:
        all_embeddings: list[list[float]] = []

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

            sorted_data = sorted(data["data"], key=lambda x: x["index"])
            all_embeddings.extend([item["embedding"] for item in sorted_data])

        return all_embeddings
