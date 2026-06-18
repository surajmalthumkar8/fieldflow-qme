from fastapi import APIRouter
from sqlalchemy import text

from ..services import llm, voice
from ..core.database import engine

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    db_ok = False
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "database": db_ok,
        "ollama": await llm.ollama_up(),
        "tts_provider": voice.active_provider(),
    }
