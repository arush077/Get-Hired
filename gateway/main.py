import os
from pathlib import Path

import edge_tts
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="API Gateway", version="0.1.0")

INTERVIEW_SERVICE_URL = os.getenv(
    "INTERVIEW_SERVICE_URL", "http://localhost:8001"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory=str(BASE_DIR / "frontend"))
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "frontend" / "static")), name="static")


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    response_class=JSONResponse,
)
async def proxy(path: str, request: Request):
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=f"{INTERVIEW_SERVICE_URL}/{path}",
                headers=headers,
                content=body if body else None,
            )
            content = resp.text
            if resp.headers.get("content-type", "").startswith("application/json"):
                content = resp.json()
            return JSONResponse(content=content, status_code=resp.status_code)
        except httpx.ConnectError:
            return JSONResponse(
                content={"error": "Interview service unavailable"},
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

    # Convert float speed (0.5-2.0) to edge-tts rate string ("+0%", "+20%", "-10%")
    speed_pct = int((speed - 1.0) * 100)
    rate = f"+{speed_pct}%" if speed_pct >= 0 else f"{speed_pct}%"

    print(f"[TTS] text={text!r} voice={voice} speed={speed} rate={rate}")

    communicate = edge_tts.Communicate(text, voice, rate=rate)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]

    print(f"[TTS] generated {len(audio_data)} bytes")
    return Response(content=audio_data, media_type="audio/mpeg")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "gateway"}
