from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from infrastructure.db.session import dispose_engine, get_engine
from infrastructure.db.models import Base
from api.dependencies import AuthMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await dispose_engine()


app = FastAPI(title="GetHired", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuthMiddleware)

from api.routes.interview import router as interview_router
from api.routes.rag import router as rag_router
from api.routes.tts import tts_router
from api.routes.auth import router as auth_router
from api.routes.resume import router as resume_router

app.include_router(auth_router)
app.include_router(resume_router)
app.include_router(interview_router)
app.include_router(rag_router)
app.include_router(tts_router)


@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok", "service": "gethired"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
