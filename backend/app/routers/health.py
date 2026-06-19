from fastapi import APIRouter, Response, status
from sqlalchemy import text

from ..services import llm, voice
from ..core.database import engine

router = APIRouter(tags=["health"])


async def _db_ok() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@router.get("/health")
async def health():
    """Full status (used by the UI badge)."""
    db_ok = await _db_ok()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": db_ok,
        "ollama": await llm.ollama_up(),
        "tts_provider": voice.active_provider(),
    }


@router.get("/health/live")
async def liveness():
    """Liveness probe: is the process up and serving? (No dependency checks — a
    failing dependency must NOT cause the orchestrator to kill the process.)"""
    return {"status": "alive"}


@router.get("/health/ready")
async def readiness(response: Response):
    """Readiness probe: are dependencies OK so we should receive traffic? Returns 503
    when the DB is down so the load balancer drains this instance until it recovers."""
    db_ok = await _db_ok()
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    # DB is required; Ollama is best-effort (chat degrades gracefully without it).
    return {"status": "ready" if db_ok else "not_ready", "database": db_ok, "ollama": await llm.ollama_up()}
