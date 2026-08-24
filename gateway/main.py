import os

import edge_tts
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

app = FastAPI(title="API Gateway", version="0.1.0")

INTERVIEW_SERVICE_URL = os.getenv("INTERVIEW_SERVICE_URL", "http://localhost:8001")
RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:8004")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _safe_json(resp: httpx.Response):
    content = resp.text
    if "application/json" in resp.headers.get("content-type", ""):
        try:
            content = resp.json()
        except Exception:
            pass
    return content


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    response_class=JSONResponse,
)
async def proxy_api(path: str, request: Request):
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=f"{INTERVIEW_SERVICE_URL}/{path}",
                headers=headers,
                content=body if body else None,
            )
            return JSONResponse(content=_safe_json(resp), status_code=resp.status_code)
        except httpx.ConnectError:
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
    headers = dict(request.headers)
    headers.pop("host", None)

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=f"{RAG_SERVICE_URL}/rag/{path}",
                headers=headers,
                content=body if body else None,
            )
            return JSONResponse(content=_safe_json(resp), status_code=resp.status_code)
        except httpx.ConnectError:
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "gateway"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
