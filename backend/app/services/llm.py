"""LLM access layer — LangChain so the provider is swappable in ONE place.

Today everything runs on local Ollama via `langchain_ollama`. To switch a role (or
all roles) to another provider later, change `_make_chat_model` to return e.g.
`ChatOpenAI(...)` / `ChatAnthropic(...)` — the routers call `chat`/`chat_json`/`embed`
and never see the provider. (A tiny httpx ping is kept only for the health check.)
"""
import asyncio
import contextvars
import json
from functools import lru_cache

import httpx
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama, OllamaEmbeddings

from ..core.config import get_settings, host_for, model_for

settings = get_settings()

_MAX_RETRIES = 2  # transient transport drops happen when Ollama swaps models

# Last call's token usage (prompt, output), per async task — so a caller can meter
# tokens without threading the value through every signature. Set on each chat().
_last_usage: contextvars.ContextVar[tuple[int, int]] = contextvars.ContextVar("usage", default=(0, 0))


def last_usage() -> tuple[int, int]:
    """(prompt_tokens, output_tokens) from the most recent chat() in this task."""
    return _last_usage.get()


# ONE context size for every call (chat, scoring, prewarm). Ollama keeps a separate
# resident model instance per (model, num_ctx); if these differ it RELOADS the model
# (~40s cold-load) on every switch. Keeping them identical means the model loads once
# and stays hot — this is the single biggest latency win for local Ollama.
NUM_CTX = 4096


# --- Provider-swappable factory ------------------------------------------------
def _make_chat_model(
    role: str, *, temperature: float, num_ctx: int, json_format: bool, num_predict: int | None
) -> ChatOllama:
    """Return a LangChain chat model for a receptionist role.

    Swap point: branch on settings.llm_provider here to return ChatOpenAI /
    ChatAnthropic / etc. instead of ChatOllama — nothing else in the app changes.
    """
    model = model_for(role)
    kwargs: dict = {
        "model": model,
        "base_url": host_for(role),  # reasoning roles may target a separate Ollama
        "temperature": temperature,
        "num_ctx": num_ctx,
        "keep_alive": settings.ollama_keep_alive,
    }
    if num_predict:
        kwargs["num_predict"] = num_predict  # cap output length -> shorter, faster replies
    if json_format:
        kwargs["format"] = "json"
    # qwen3.x ships a "thinking" channel that stalls/garbles structured output —
    # disable it (LangChain maps reasoning=False -> Ollama think:false).
    if "qwen3" in model:
        kwargs["reasoning"] = False
    return ChatOllama(**kwargs)


@lru_cache(maxsize=1)
def _embedder() -> OllamaEmbeddings:
    return OllamaEmbeddings(model=model_for("embedding"), base_url=settings.ollama_host)


def _to_lc(messages: list[dict[str, str]]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for m in messages:
        role, content = m.get("role"), m.get("content", "")
        if role == "system":
            out.append(SystemMessage(content))
        elif role == "assistant":
            out.append(AIMessage(content))
        else:
            out.append(HumanMessage(content))
    return out


# --- Public API ----------------------------------------------------------------
async def chat(
    role: str,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.5,
    num_ctx: int = NUM_CTX,
    json_format: bool = False,
    num_predict: int | None = None,
    retries: int | None = None,
) -> str:
    """Call the role's chat model; return the assistant text. Retries transient errors
    (set retries=0 for calls where a retry storm would just multiply a slow hang)."""
    model = _make_chat_model(
        role, temperature=temperature, num_ctx=num_ctx, json_format=json_format, num_predict=num_predict
    )
    lc_messages = _to_lc(messages)
    last_exc: Exception | None = None
    max_retries = _MAX_RETRIES if retries is None else retries
    for attempt in range(max_retries + 1):
        try:
            resp = await model.ainvoke(lc_messages)
            # Capture token usage for billing (Ollama reports prompt_eval_count /
            # eval_count via LangChain's usage_metadata). Best-effort.
            try:
                um = getattr(resp, "usage_metadata", None) or {}
                _last_usage.set((int(um.get("input_tokens", 0) or 0), int(um.get("output_tokens", 0) or 0)))
            except Exception:
                _last_usage.set((0, 0))
            content = resp.content
            return (content if isinstance(content, str) else str(content)).strip()
        except Exception as exc:  # noqa: BLE001 — broad retry on transport/runtime errors
            last_exc = exc
            if attempt < max_retries:
                await asyncio.sleep(1.5 * (attempt + 1))
    raise last_exc  # type: ignore[misc]


async def chat_json(
    role: str,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.2,
    num_ctx: int = NUM_CTX,
    num_predict: int | None = None,
    retries: int | None = None,
) -> dict:
    """Chat that must return a JSON object. Tolerates stray prose around it."""
    raw = await chat(
        role, messages, temperature=temperature, num_ctx=num_ctx, json_format=True,
        num_predict=num_predict, retries=retries,
    )
    return _extract_json(raw)


async def embed(text: str) -> list[float]:
    """Embed one string with the configured embedding model."""
    return await _embedder().aembed_query(text)


async def prewarm(roles: list[str]) -> None:
    """Load the given roles' models into memory so the first real turn is fast."""
    seen: set[str] = set()
    for role in roles:
        model = model_for(role)
        if model in seen:
            continue
        seen.add(model)
        try:
            # Warm at the SAME num_ctx the real calls use, so the resident model
            # instance is reused (a different ctx would force a reload on turn 1).
            await chat(role, [{"role": "user", "content": "hi"}], temperature=0.0)
        except Exception:
            pass  # best-effort warmup


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
    """Lightweight liveness ping (infra health, not an LLM call)."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.ollama_host}/api/tags")
            return r.status_code == 200
    except httpx.HTTPError:
        return False
