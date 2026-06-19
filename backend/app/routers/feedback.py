"""Customer feedback: capture (from the receptionist), admin/super aggregates, and
a LOCAL-AI summarizer (themes / bugs / feature requests / priorities) on Ollama."""
import asyncio
import json
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.deps import current_user
from ..core.database import get_db
from ..models import AppUser, Feedback
from ..schemas import FeedbackIn
from ..services import llm

router = APIRouter(tags=["feedback"])

CATEGORIES = {"ai_quality", "booking", "agent", "feature_request", "bug", "other"}


@router.post("/feedback")
async def submit_feedback(
    body: FeedbackIn,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Customer leaves feedback (e.g. after booking a call). One per conversation+source+target.
    business_id + user_id come from the token — never trust the body for tenant scope."""
    business_id = user.business_id or body.business_id
    rating = max(0, min(5, int(body.rating or 0)))
    category = body.category if body.category in CATEGORIES else "other"
    target = body.target if body.target in ("ai", "agent", "overall") else "overall"
    # De-dupe per conversation + source + target (so an AI rating and an agent rating
    # on the same conversation are kept as two distinct rows).
    existing = None
    if body.conversation_id:
        existing = (
            await db.execute(
                select(Feedback).where(
                    Feedback.conversation_id == body.conversation_id,
                    Feedback.source == body.source,
                    Feedback.target == target,
                )
            )
        ).scalar_one_or_none()
    if existing:
        existing.rating = rating
        existing.comment = body.comment[:2000]
        existing.category = category
        existing.agent_id = body.agent_id
    else:
        db.add(
            Feedback(
                business_id=business_id,
                conversation_id=body.conversation_id,
                user_id=user.id,
                appointment_id=body.appointment_id,
                rating=rating,
                comment=body.comment[:2000],
                category=category,
                source=body.source,
                target=target,
                agent_id=body.agent_id,
            )
        )
    await db.commit()
    return {"ok": True}


def _scope_for(user: AppUser, business_id: str | None) -> str | None:
    """Company admins are locked to their own company; super_admin may pass a filter."""
    if user.role == "admin":
        return user.business_id
    if user.role == "super_admin":
        return business_id or None
    raise HTTPException(403, "Admins only")


@router.get("/feedback")
async def list_feedback(
    business_id: str | None = None,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Feedback rows + aggregates. admin = own company; super_admin = all (or filtered)."""
    scope = _scope_for(user, business_id)
    q = select(Feedback)
    if scope:
        q = q.where(Feedback.business_id == scope)
    rows = (await db.execute(q.order_by(Feedback.created_at.desc()).limit(500))).scalars().all()

    ratings = [r.rating for r in rows if r.rating]
    by_category: dict[str, int] = defaultdict(int)
    by_rating: dict[int, int] = defaultdict(int)
    by_day: dict[str, list] = defaultdict(list)
    for r in rows:
        by_category[r.category] += 1
        if r.rating:
            by_rating[r.rating] += 1
            if r.created_at:
                by_day[r.created_at.astimezone(timezone.utc).date().isoformat()].append(r.rating)

    trend = [
        {"date": d, "avg": round(sum(v) / len(v), 2), "count": len(v)}
        for d, v in sorted(by_day.items())
    ]
    return {
        "viewerRole": user.role,
        "totals": {
            "count": len(rows),
            "avgRating": round(sum(ratings) / len(ratings), 2) if ratings else 0.0,
            "escalated": sum(1 for r in rows if r.escalated),
        },
        "byCategory": dict(by_category),
        "byRating": {str(k): by_rating.get(k, 0) for k in range(1, 6)},
        "trend": trend,
        "items": [
            {
                "id": r.id,
                "rating": r.rating,
                "comment": r.comment,
                "category": r.category,
                "source": r.source,
                "sentiment": r.sentiment,
                "conversationId": r.conversation_id,
                "escalated": r.escalated,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows[:200]
        ],
    }


@router.post("/feedback/{feedback_id}/escalate")
async def escalate_feedback(
    feedback_id: str,
    note: str = "",
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """A company admin flags a piece of feedback for the platform (super_admin)."""
    if user.role != "admin":
        raise HTTPException(403, "Company admin only")
    fb = (await db.execute(select(Feedback).where(Feedback.id == feedback_id))).scalar_one_or_none()
    if not fb or fb.business_id != user.business_id:
        raise HTTPException(404, "Feedback not found")
    fb.escalated = True
    fb.escalation_note = (note or "")[:1000]
    await db.commit()
    return {"ok": True}


@router.get("/feedback/escalations")
async def escalations(
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Platform (super_admin) inbox of feedback escalated by company admins."""
    if user.role != "super_admin":
        raise HTTPException(403, "Super admin only")
    rows = (
        await db.execute(
            select(Feedback).where(Feedback.escalated.is_(True)).order_by(Feedback.created_at.desc()).limit(200)
        )
    ).scalars().all()
    return {
        "items": [
            {
                "id": r.id,
                "businessId": r.business_id,
                "rating": r.rating,
                "comment": r.comment,
                "category": r.category,
                "note": r.escalation_note,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }


_SUMMARY_SYSTEM = (
    "You are a product analyst. Summarize the customer feedback you are given for an "
    "AI receptionist product. Output ONLY valid JSON (no prose) matching EXACTLY this schema:\n"
    '{"summary": string, '
    '"sentiment_breakdown": {"positive": int, "neutral": int, "negative": int}, '
    '"themes": [{"label": string, "mentions": int, "sentiment": "positive|neutral|negative"}], '
    '"top_feature_requests": [{"request": string, "mentions": int, "rationale": string}], '
    '"bugs": [{"issue": string, "severity": "low|medium|high", "mentions": int}], '
    '"recommendations": [{"action": string, "priority": "P0|P1|P2", "rationale": string}]}\n'
    "Base everything ONLY on the feedback provided. Do not invent feedback. If a section "
    "has nothing, return an empty array (or zeros)."
)

_EMPTY_SUMMARY = {
    "summary": "",
    "sentiment_breakdown": {"positive": 0, "neutral": 0, "negative": 0},
    "themes": [],
    "top_feature_requests": [],
    "bugs": [],
    "recommendations": [],
}


@router.post("/feedback/summary")
async def summarize_feedback(
    business_id: str | None = None,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run the LOCAL AI (Ollama) over recent feedback to extract themes, bugs,
    feature requests and prioritized recommendations."""
    scope = _scope_for(user, business_id)
    q = select(Feedback)
    if scope:
        q = q.where(Feedback.business_id == scope)
    rows = (await db.execute(q.order_by(Feedback.created_at.desc()).limit(50))).scalars().all()
    if not rows:
        return {**_EMPTY_SUMMARY, "summary": "No feedback yet.", "count": 0}

    payload = [
        {
            "rating": r.rating,
            "comment": (r.comment or "")[:280],
            "category": r.category,
            "source": r.source,
        }
        for r in rows
    ]
    try:
        # No retries + a hard wall-clock bound: a single slow/hung generation must
        # never multiply into a multi-minute wait for the user. Fall back gracefully.
        data = await asyncio.wait_for(
            llm.chat_json(
                "summarizer",
                [
                    {"role": "system", "content": _SUMMARY_SYSTEM},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
                temperature=0.2,
                num_predict=600,
                retries=0,
            ),
            timeout=75,
        )
    except (Exception, asyncio.TimeoutError):
        data = {}
    if not isinstance(data, dict) or "summary" not in data:
        # Graceful fallback if the small model returns malformed JSON.
        data = {**_EMPTY_SUMMARY, "summary": "Couldn't summarize automatically — showing raw feedback below."}
    out = {**_EMPTY_SUMMARY, **data}

    # Normalize small-model quirks (e.g. it sometimes echoes the schema literal).
    def _pick(val, allowed, default):
        v = str(val or "").strip().lower()
        for a in allowed:
            if a.lower() == v:
                return a
        return default

    if isinstance(out.get("recommendations"), list):
        for r in out["recommendations"]:
            if isinstance(r, dict):
                r["priority"] = _pick(r.get("priority"), ["P0", "P1", "P2"], "P1")
    if isinstance(out.get("bugs"), list):
        for b in out["bugs"]:
            if isinstance(b, dict):
                b["severity"] = _pick(b.get("severity"), ["low", "medium", "high"], "medium")
    out["count"] = len(rows)
    return out
