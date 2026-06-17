from fastapi import APIRouter, HTTPException, Response

from .. import voice
from ..schemas import VoiceIn

router = APIRouter(prefix="/voice", tags=["voice"])


@router.get("/status")
async def status():
    return {
        "provider": voice.active_provider(),
        "kokoro_available": voice.kokoro_available(),
        "say_available": voice.say_available(),
    }


@router.post("")
async def synthesize(body: VoiceIn):
    """Text -> WAV audio of the receptionist's (female) voice."""
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "text required")
    try:
        audio, provider = await voice.synthesize(text, body.voice)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"X-TTS-Provider": provider, "Cache-Control": "no-store"},
    )
