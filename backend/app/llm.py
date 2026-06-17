"""Thin async Ollama client (chat, structured JSON, embeddings) over the REST API.

Deliberately framework-free (no langchain) — one small HTTP wrapper keeps the
dependency surface and cold-start tiny, per the project's simplicity principle.
"""
import asyncio
import json
from typing import Any

import httpx

from .config import get_settings, model_for

settings = get_settings()

_MAX_RETRIES = 2  # transport drops happen when Ollama swaps models under memory pressure


async def chat(
    role: str,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.5,
    num_ctx: int = 8192,
    json_format: bool = False,
) -> str:
    """Call Ollama /api/chat for a receptionist `role`; return the assistant text.

    Retries on transient transport errors (a dropped connection while Ollama loads
    or swaps a model is common on a memory-constrained box)."""
    model = model_for(role)
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature, "num_ctx": num_ctx},
    }
    if json_format:
        payload["format"] = "json"
    # Disable the "thinking" channel on qwen3.x — it otherwise emits minutes of
    # reasoning tokens and slows/corrupts structured output. Only thinking models
    # accept this flag, so gate it on the model name.
    if "qwen3" in model:
        payload["think"] = False

    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
                r = await client.post(f"{settings.ollama_host}/api/chat", json=payload)
                r.raise_for_status()
                return (r.json().get("message") or {}).get("content", "").strip()
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(1.5 * (attempt + 1))
    raise last_exc  # type: ignore[misc]


async def chat_json(
    role: str,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.2,
    num_ctx: int = 8192,
) -> dict:
    """Chat that must return a JSON object. Tolerates stray prose around it."""
    raw = await chat(role, messages, temperature=temperature, num_ctx=num_ctx, json_format=True)
    return _extract_json(raw)


async def embed(text: str) -> list[float]:
    """Embed one string with the configured embedding model."""
    async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
        r = await client.post(
            f"{settings.ollama_host}/api/embeddings",
            json={"model": model_for("embedding"), "prompt": text},
        )
        r.raise_for_status()
        return r.json()["embedding"]


def _extract_json(raw: str) -> dict:
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                pass
    return {}


async def ollama_up() -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.ollama_host}/api/tags")
            return r.status_code == 200
    except httpx.HTTPError:
        return False
