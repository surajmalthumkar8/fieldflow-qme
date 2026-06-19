"""Pricing config loader. Reads backend/app/config/pricing.yaml live (re-reads when
the file changes) so rates can be retuned without a code change or restart. Billing
applies these rates; usage events snapshot the resolved unit cost at emit time."""
from pathlib import Path

import yaml

_PATH = Path(__file__).resolve().parents[1] / "config" / "pricing.yaml"
_cache: dict = {}
_mtime: float = 0.0

# Maps a usage event_type -> (rate_key, per_unit_divisor) within a plan's rates.
METRIC_RATE = {
    "ai_message": ("ai_message", 1),
    "tokens_prompt": ("tokens_per_1k_prompt", 1000),
    "tokens_output": ("tokens_per_1k_output", 1000),
    "voice_min": ("voice_per_minute", 1),
    "rag_ingest": ("rag_per_mb", 1),
}
# event_type -> free-tier bucket key.
METRIC_FREE = {
    "ai_message": "ai_messages",
    "tokens_prompt": "tokens",
    "tokens_output": "tokens",
    "voice_min": "voice_minutes",
    "rag_ingest": "rag_mb",
}


def _load() -> dict:
    global _cache, _mtime
    try:
        m = _PATH.stat().st_mtime
        if not _cache or m != _mtime:
            _cache = yaml.safe_load(_PATH.read_text()) or {}
            _mtime = m
    except FileNotFoundError:
        _cache = {}
    return _cache


def default_currency() -> str:
    return _load().get("default_currency", "USD")


def plan(plan_code: str = "starter") -> dict:
    plans = _load().get("plans", {})
    return plans.get(plan_code) or plans.get("starter") or {}


def headline() -> dict:
    return _load().get("headline", {})


def currency_meta(currency: str) -> dict:
    return _load().get("currencies", {}).get(currency, {"symbol": "$", "rounding": 2})


def platform_fee(plan_code: str, currency: str) -> float:
    return float((plan(plan_code).get("platform_fee_month", {}) or {}).get(currency, 0.0))


def free_tier(plan_code: str, event_type: str) -> float:
    key = METRIC_FREE.get(event_type)
    return float((plan(plan_code).get("free_tier", {}) or {}).get(key, 0.0)) if key else 0.0


def unit_rate(plan_code: str, event_type: str, currency: str) -> tuple[float, int]:
    """Return (rate_per_unit, divisor) for an event type. divisor=1000 for token
    metrics (priced per 1k). rate is in the requested currency."""
    rate_key, divisor = METRIC_RATE.get(event_type, (None, 1))
    if not rate_key:
        return 0.0, 1
    rate = (plan(plan_code).get("rates", {}) or {}).get(rate_key, {}) or {}
    return float(rate.get(currency, 0.0)), divisor
