import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:123456@localhost:5432/interviewready")

connect_args = {}
if "localhost" not in DATABASE_URL:
    connect_args["ssl"] = "require"

engine = create_async_engine(DATABASE_URL, echo=False, connect_args=connect_args)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
