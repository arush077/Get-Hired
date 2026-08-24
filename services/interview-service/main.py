import sys
import os
from contextlib import asynccontextmanager

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.interview import router as interview_router
from infrastructure.db.models import Base
from infrastructure.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[DB] PostgreSQL connected")
    yield
    await engine.dispose()
    print("[DB] PostgreSQL connection closed")


app = FastAPI(title="Interview Service", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(interview_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "interview-service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
