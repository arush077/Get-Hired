from fastapi import APIRouter, Request
from fastapi.responses import Response, JSONResponse
import edge_tts
import logging
import time

logger = logging.getLogger(__name__)
tts_router = APIRouter(tags=["tts"])


@tts_router.post("/tts")
async def tts(request: Request):
    body = await request.json()
    text = body.get("text", "")
    voice = body.get("voice", "en-US-AvaNeural")
    speed = body.get("speed", 1.0)

    if not text:
        return JSONResponse(content={"error": "text is required"}, status_code=400)

    speed_pct = int((speed - 1.0) * 100)
    rate = f"+{speed_pct}%" if speed_pct >= 0 else f"{speed_pct}%"

    logger.info("[TTS] text_len=%d voice=%s rate=%s", len(text), voice, rate)

    start = time.monotonic()
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    audio_data = b""
    chunk_count = 0
    try:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
                chunk_count += 1
    except Exception as e:
        logger.error("[TTS] stream error after %d chunks, %d bytes: %s", chunk_count, len(audio_data), e)
        raise

    elapsed = time.monotonic() - start
    logger.info(
        "[TTS] done: chunks=%d audio_bytes=%d elapsed=%.2fs",
        chunk_count,
        len(audio_data),
        elapsed,
    )

    return Response(content=audio_data, media_type="audio/mpeg")
