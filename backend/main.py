from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from infrastructure.db.session import dispose_engine, get_engine
from infrastructure.db.models import Base
from api.dependencies import AuthMiddleware
from application.rate_limiter import limiter

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await dispose_engine()


app = FastAPI(title="GetHired", version="2.0.0", lifespan=lifespan)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    response = _rate_limit_exceeded_handler(request, exc)
    response.headers["Access-Control-Expose-Headers"] = "Retry-After"
    return response


ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://get-hired-weld.vercel.app").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuthMiddleware)

from api.routes.interview import router as interview_router
from api.routes.tts import tts_router
from api.routes.auth import router as auth_router
from api.routes.resume import router as resume_router

app.include_router(auth_router)
app.include_router(resume_router)
app.include_router(interview_router)
app.include_router(tts_router)


@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok", "service": "gethired"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
