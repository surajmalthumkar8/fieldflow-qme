"""Billing: turn metered usage_events into a monthly bill using the editable
pricing.yaml. /billing/me = a company admin's own bill; /admin/billing = the
platform (super_admin) revenue view across all companies."""
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.deps import current_user
from ..models import AppUser, UsageEvent
from ..services import metering, pricing

router = APIRouter(tags=["billing"])

_PLAN = "starter"  # Business has no plan column yet → everyone is starter for now.
_METRICS = ["ai_message", "tokens_prompt", "tokens_output", "voice_min", "rag_ingest"]


async def _usage_for(db: AsyncSession, business_id: str | None, period: str) -> dict:
    """Sum quantities by event_type for a business (or all) in a period."""
    q = (
        select(UsageEvent.business_id, UsageEvent.event_type, func.sum(UsageEvent.quantity))
        .where(UsageEvent.period_key == period)
        .group_by(UsageEvent.business_id, UsageEvent.event_type)
    )
    if business_id:
        q = q.where(UsageEvent.business_id == business_id)
    rows = (await db.execute(q)).all()
    by_biz: dict[str, dict] = defaultdict(lambda: defaultdict(float))
    for bid, etype, total in rows:
        by_biz[bid][etype] += float(total or 0)
    return by_biz


def _bill(usage: dict, currency: str) -> dict:
    """Compute line items + total for one company's usage map."""
    items = []
    rounding = int(pricing.currency_meta(currency).get("rounding", 2))
    fee = pricing.platform_fee(_PLAN, currency)
    items.append({"label": "Platform fee", "qty": 1, "unit": "month", "unitCost": fee, "amount": round(fee, rounding)})
    total = fee

    def add(label, used, free, etype, unit, qty_div=1):
        nonlocal total
        billable = max(0.0, used - free)
        rate, divisor = pricing.unit_rate(_PLAN, etype, currency)
        amount = (billable / divisor) * rate
        items.append({
            "label": label, "qty": round(billable / qty_div, 2), "unit": unit,
            "unitCost": rate, "amount": round(amount, rounding),
        })
        total += amount

    add("AI messages", usage.get("ai_message", 0), pricing.free_tier(_PLAN, "ai_message"), "ai_message", "msg")

    # Tokens share one free bucket; split the billable overage by prompt/output ratio.
    ptok, otok = usage.get("tokens_prompt", 0), usage.get("tokens_output", 0)
    tot = ptok + otok
    free_tok = pricing.free_tier(_PLAN, "tokens_prompt")
    billable_tok = max(0.0, tot - free_tok)
    if tot > 0 and billable_tok > 0:
        p_share, o_share = billable_tok * (ptok / tot), billable_tok * (otok / tot)
        rate_p, _ = pricing.unit_rate(_PLAN, "tokens_prompt", currency)
        rate_o, _ = pricing.unit_rate(_PLAN, "tokens_output", currency)
        amt_p, amt_o = (p_share / 1000) * rate_p, (o_share / 1000) * rate_o
        items.append({"label": "Tokens (prompt)", "qty": round(p_share / 1000, 1), "unit": "1k", "unitCost": rate_p, "amount": round(amt_p, rounding)})
        items.append({"label": "Tokens (output)", "qty": round(o_share / 1000, 1), "unit": "1k", "unitCost": rate_o, "amount": round(amt_o, rounding)})
        total += amt_p + amt_o

    add("Voice minutes", usage.get("voice_min", 0), pricing.free_tier(_PLAN, "voice_min"), "voice_min", "min")
    add("RAG ingest", usage.get("rag_ingest", 0), pricing.free_tier(_PLAN, "rag_ingest"), "rag_ingest", "MB")
    return {"lineItems": items, "total": round(total, rounding)}


def _usage_block(usage: dict) -> dict:
    def b(used, free):
        return {"used": round(used, 2), "free": free, "billable": round(max(0.0, used - free), 2)}
    return {
        "aiMessages": b(usage.get("ai_message", 0), pricing.free_tier(_PLAN, "ai_message")),
        "tokens": b(usage.get("tokens_prompt", 0) + usage.get("tokens_output", 0), pricing.free_tier(_PLAN, "tokens_prompt")),
        "voiceMinutes": b(usage.get("voice_min", 0), pricing.free_tier(_PLAN, "voice_min")),
        "ragMb": b(usage.get("rag_ingest", 0), pricing.free_tier(_PLAN, "rag_ingest")),
    }


@router.get("/billing/me")
async def my_billing(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """A company's current-period bill. admin/agent of the company; customers 403."""
    if user.role == "customer":
        raise HTTPException(403, "Not available")
    if not user.business_id:
        raise HTTPException(400, "No company")
    period = metering.period_key()
    currency = pricing.default_currency()
    by_biz = await _usage_for(db, user.business_id, period)
    usage = by_biz.get(user.business_id, {})
    bill = _bill(usage, currency)
    return {
        "businessId": user.business_id,
        "period": period,
        "currency": currency,
        "symbol": pricing.currency_meta(currency).get("symbol", "$"),
        "plan": _PLAN,
        "usage": _usage_block(usage),
        "lineItems": bill["lineItems"],
        "total": bill["total"],
        "headline": pricing.headline(),
        "status": "open",
    }


@router.get("/admin/billing")
async def admin_billing(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Platform revenue (super_admin): per-company bills + totals + a revenue trend.
    This is OUR billing revenue — separate from (and unlike) company pipeline $."""
    if user.role != "super_admin":
        raise HTTPException(403, "Super admin only")
    currency = pricing.default_currency()
    symbol = pricing.currency_meta(currency).get("symbol", "$")
    period = metering.period_key()

    # Per-company current-period bills.
    by_biz = await _usage_for(db, None, period)
    companies, total_rev, platform_rev = [], 0.0, 0.0
    fee = pricing.platform_fee(_PLAN, currency)
    for bid, usage in by_biz.items():
        bill = _bill(usage, currency)
        companies.append({
            "businessId": bid,
            "usage": {
                "aiMessages": int(usage.get("ai_message", 0)),
                "tokens": int(usage.get("tokens_prompt", 0) + usage.get("tokens_output", 0)),
                "voiceMinutes": round(usage.get("voice_min", 0), 1),
                "ragMb": round(usage.get("rag_ingest", 0), 2),
            },
            "bill": bill["total"],
            "status": "open",
        })
        total_rev += bill["total"]
        platform_rev += fee
    companies.sort(key=lambda c: c["bill"], reverse=True)

    # Revenue trend across all periods present in usage data.
    rows = (
        await db.execute(
            select(UsageEvent.period_key, UsageEvent.business_id, UsageEvent.event_type, func.sum(UsageEvent.quantity))
            .group_by(UsageEvent.period_key, UsageEvent.business_id, UsageEvent.event_type)
        )
    ).all()
    per_period: dict[str, dict] = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    for pk, bid, etype, total in rows:
        per_period[pk][bid][etype] += float(total or 0)
    trend = []
    for pk in sorted(per_period):
        rev = sum(_bill(u, currency)["total"] for u in per_period[pk].values())
        trend.append({"period": pk, "revenue": round(rev, 2)})

    return {
        "period": period,
        "currency": currency,
        "symbol": symbol,
        "summary": {
            "totalRevenue": round(total_rev, 2),
            "mrr": round(total_rev, 2),
            "activeCompanies": len(by_biz),
            "platformFeeRevenue": round(platform_rev, 2),
            "usageRevenue": round(total_rev - platform_rev, 2),
        },
        "companies": companies,
        "trend": trend,
    }


@router.get("/billing/me/daily")
async def my_billing_daily(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Daily usage-cost breakdown (current period) for the Cost Analyzer charts."""
    if user.role == "customer":
        raise HTTPException(403, "Not available")
    if not user.business_id:
        raise HTTPException(400, "No company")
    period = metering.period_key()
    rows = (
        await db.execute(
            select(UsageEvent.created_at, UsageEvent.event_type, UsageEvent.quantity, UsageEvent.unit_cost)
            .where(UsageEvent.business_id == user.business_id, UsageEvent.period_key == period)
        )
    ).all()
    by_day: dict[str, dict] = defaultdict(lambda: defaultdict(float))
    for created, etype, qty, unit_cost in rows:
        if not created:
            continue
        day = created.date().isoformat()
        divisor = 1000 if etype.startswith("tokens") else 1
        by_day[day][etype] += float(qty or 0) * float(unit_cost or 0) / divisor
    trend = [
        {"date": d, "aiCost": round(v.get("ai_message", 0), 4),
         "tokenCost": round(v.get("tokens_prompt", 0) + v.get("tokens_output", 0), 4),
         "ragCost": round(v.get("rag_ingest", 0), 4),
         "voiceCost": round(v.get("voice_min", 0), 4)}
        for d, v in sorted(by_day.items())
    ]
    return {"period": period, "trend": trend}
