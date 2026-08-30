from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from infrastructure.db.session import dispose_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await dispose_engine()


app = FastAPI(title="InterviewReady", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.routes.interview import router as interview_router
from api.routes.rag import router as rag_router
from api.routes.tts import tts_router

app.include_router(interview_router)
app.include_router(rag_router)
app.include_router(tts_router)


@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok", "service": "interviewready"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
