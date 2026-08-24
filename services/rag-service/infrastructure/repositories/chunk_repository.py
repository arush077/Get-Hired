from sqlalchemy import select, text, delete
from sqlalchemy.ext.asyncio import AsyncSession

from domain.chunk import Chunk
from infrastructure.db.models import Base, ChunkModel
from infrastructure.db.session import async_session_factory
from infrastructure.repositories.base import ChunkRepositoryInterface


class ChunkRepository(ChunkRepositoryInterface):
    def __init__(self):
        self._session_factory = async_session_factory

    async def save_chunks(self, chunks: list[Chunk]) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                for chunk in chunks:
                    db_chunk = ChunkModel(
                        id=chunk.id,
                        source=chunk.source,
                        text=chunk.text,
                        embedding=chunk.embedding,
                    )
                    session.add(db_chunk)

    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        source: str | None = None,
    ) -> list[Chunk]:
        async with self._session_factory() as session:
            # pgvector cosine distance: <=> operator
            # lower distance = more similar
            cosine_dist = ChunkModel.embedding.cosine_distance(query_embedding)

            query = (
                select(ChunkModel, cosine_dist.label("distance"))
                .order_by(cosine_dist)
                .limit(top_k)
            )

            if source:
                query = query.where(ChunkModel.source == source)

            result = await session.execute(query)
            rows = result.all()

            return [
                Chunk(
                    id=row.ChunkModel.id,
                    source=row.ChunkModel.source,
                    text=row.ChunkModel.text,
                    embedding=row.ChunkModel.embedding,
                    created_at=row.ChunkModel.created_at,
                )
                for row in rows
            ]

    async def delete_by_source(self, source: str) -> bool:
        async with self._session_factory() as session:
            async with session.begin():
                result = await session.execute(
                    delete(ChunkModel).where(ChunkModel.source == source)
                )
                return result.rowcount > 0
