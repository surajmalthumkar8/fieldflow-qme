"""Record billable usage events. Emits are fire-and-forget off the hot path so the
customer's chat reply is never blocked. Each event snapshots the resolved unit cost
so a later pricing change can't rewrite a past period."""
import asyncio
from datetime import datetime, timezone

from ..core.database import SessionLocal
from ..models import UsageEvent
from . import pricing


def period_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def record(
    business_id: str,
    event_type: str,
    quantity: float,
    meta: str = "",
    plan_code: str = "starter",
    currency: str | None = None,
) -> None:
    if not business_id or quantity is None or quantity <= 0:
        return
    cur = currency or pricing.default_currency()
    rate, _div = pricing.unit_rate(plan_code, event_type, cur)
    try:
        async with SessionLocal() as db:
            db.add(
                UsageEvent(
                    business_id=business_id,
                    event_type=event_type,
                    quantity=float(quantity),
                    unit_cost=rate,
                    currency=cur,
                    plan_code=plan_code,
                    period_key=period_key(),
                    meta=(meta or "")[:200],
                )
            )
            await db.commit()
    except Exception:
        pass  # metering must never break the request


def fire(business_id: str, event_type: str, quantity: float, meta: str = "") -> None:
    """Fire-and-forget (used in hot paths like /chat)."""
    if not business_id or not quantity:
        return
    try:
        asyncio.create_task(record(business_id, event_type, quantity, meta))
    except RuntimeError:
        pass  # no running loop (e.g. sync context) — skip
