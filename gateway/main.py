import asyncio
import logging
import os
from contextlib import asynccontextmanager

import edge_tts
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

INTERVIEW_SERVICE_URL = os.getenv("INTERVIEW_SERVICE_URL", "http://localhost:8001")
RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:8004")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async def _warm_service(name: str, url: str):
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(f"{url}/health")
                    if resp.status_code == 200:
                        logger.info("[WARM-UP] %s is up", name)
                        return
                    logger.warning("[WARM-UP] %s returned %d", name, resp.status_code)
            except (httpx.TimeoutException, httpx.ConnectError):
                logger.warning("[WARM-UP] %s not ready (attempt %d)", name, attempt + 1)
            await asyncio.sleep(2)

    await asyncio.gather(
        _warm_service("Interview Service", INTERVIEW_SERVICE_URL),
        _warm_service("RAG Service", RAG_SERVICE_URL),
    )
    yield


app = FastAPI(title="API Gateway", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SKIP_HEADERS = {"host", "accept-encoding", "content-length", "transfer-encoding"}
RETRY_DELAYS = [2, 4, 8]
RETRYABLE_STATUS = {502, 503, 504}


def _safe_json(resp: httpx.Response):
    content_type = resp.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            return resp.json()
        except Exception:
            pass
    return resp.text


async def _proxy_with_retry(
    method: str, url: str, headers: dict, body: bytes, timeout: float = 90.0
) -> httpx.Response:
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                resp = await client.request(
                    method=method, url=url, headers=headers, content=body if body else None
                )
            if resp.status_code == 429:
                retry_after = resp.headers.get("retry-after")
                if retry_after and attempt == 0:
                    await asyncio.sleep(int(retry_after))
                    continue
                return resp
            if resp.status_code in RETRYABLE_STATUS and attempt < len(RETRY_DELAYS):
                await asyncio.sleep(RETRY_DELAYS[attempt])
                continue
            return resp
        except (httpx.TimeoutException, httpx.ConnectError):
            if attempt < len(RETRY_DELAYS):
                await asyncio.sleep(RETRY_DELAYS[attempt])
                continue
            raise


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    response_class=JSONResponse,
)
async def proxy_api(path: str, request: Request):
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in SKIP_HEADERS}

    try:
        resp = await _proxy_with_retry(
            request.method, f"{INTERVIEW_SERVICE_URL}/{path}", headers, body
        )
        return JSONResponse(content=_safe_json(resp), status_code=resp.status_code)
    except (httpx.TimeoutException, httpx.ConnectError):
        return JSONResponse(
            content={"error": "Interview service unavailable"},
            status_code=503,
        )


@app.api_route(
    "/rag/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    response_class=JSONResponse,
)
async def proxy_rag(path: str, request: Request):
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in SKIP_HEADERS}

    try:
        resp = await _proxy_with_retry(
            request.method, f"{RAG_SERVICE_URL}/rag/{path}", headers, body
        )
        return JSONResponse(content=_safe_json(resp), status_code=resp.status_code)
    except (httpx.TimeoutException, httpx.ConnectError):
        return JSONResponse(
            content={"error": "RAG service unavailable"},
            status_code=503,
        )


@app.post("/tts")
async def tts(request: Request):
    body = await request.json()
    text = body.get("text", "")
    voice = body.get("voice", "en-US-AvaNeural")
    speed = body.get("speed", 1.0)

    if not text:
        return JSONResponse(content={"error": "text is required"}, status_code=400)

    speed_pct = int((speed - 1.0) * 100)
    rate = f"+{speed_pct}%" if speed_pct >= 0 else f"{speed_pct}%"

    communicate = edge_tts.Communicate(text, voice, rate=rate)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]

    return Response(content=audio_data, media_type="audio/mpeg")


@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok", "service": "gateway"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
