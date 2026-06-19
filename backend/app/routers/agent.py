"""Agent-facing endpoints: the company's customers (deduped to one row per
customer), self-assignment, a per-customer AI insight (RAG-grounded, reasoning
tier), and the agent's own performance scorecard."""
import asyncio
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.deps import current_user
from ..models import (
    AgentMessage,
    AgentThread,
    AppUser,
    Appointment,
    ChatConversation,
    ChatMessage,
    Feedback,
)
from ..services import llm, rag

router = APIRouter(prefix="/agent", tags=["agent"])


def _grade(profile: dict, booked: bool, has_email: bool, intent_signals: int) -> tuple[str, int, float]:
    """Instant, heuristic lead grade (no LLM — Ollama's single slot is reserved for
    the live customer chat). Real-estate buying signals → HOT/WARM/COLD + a score
    and an estimated deal size. Good enough for the dashboard; fast and free."""
    p = profile or {}
    score = 0
    if booked:
        score += 45  # booked a call = strongest intent
    if p.get("budget"):
        score += 18
    if p.get("timeline"):
        score += 15
    if (p.get("intent") or "").lower() in ("buy", "buying", "sell", "selling", "invest", "investing"):
        score += 12
    if p.get("location"):
        score += 6
    if has_email:
        score += 6
    score += min(intent_signals, 3) * 3  # engagement / captured fields
    score = min(score, 100)
    grade = "HOT" if score >= 55 else "WARM" if score >= 28 else "COLD"

    # Rough deal size from a stated budget. Honor explicit units only — "650k"→650000,
    # "1.2m"→1.2M, "$650,000"→650000. A bare number is taken literally (no surprise
    # ×1000), so "$1200" stays $1200 and never balloons to $1.2M.
    budget = 0.0
    raw = str(p.get("budget") or "")
    digits = "".join(ch for ch in raw if ch.isdigit() or ch == ".")
    try:
        val = float(digits) if digits else 0.0
        low = raw.lower()
        if "m" in low:
            val *= 1_000_000
        elif "k" in low:
            val *= 1000
        budget = val
    except ValueError:
        budget = 0.0
    return grade, score, budget


@router.get("/leads")
async def leads(
    business_id: str | None = None,
    assigned_agent_id: str | None = None,  # filter to one agent's customers
    unassigned: bool = False,              # filter to the unclaimed lead pool
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """The company's leads, DEDUPED to ONE row per CUSTOMER (not per conversation).
    A returning customer who chats again is the same lead — we merge their threads,
    carry their assignment across, and show how many times they've reached out, so
    the same person never appears twice in the list. Optional filters: a single
    agent's customers, or the unassigned pool."""
    # Auth + tenant scope: agents/admins see ONLY their own company; super_admin may
    # pass any business_id. Scope comes from the token, never a caller-supplied param.
    if user.role in ("agent", "admin"):
        business_id = user.business_id
    elif user.role == "super_admin":
        business_id = business_id or user.business_id
    else:
        raise HTTPException(403, "Agents only")
    if not business_id:
        return []
    # Fetch ALL conversations; dedup happens in Python (assignment can live on any of
    # a customer's threads, so we can't filter at the SQL level).
    convos = (
        await db.execute(
            select(ChatConversation)
            .where(ChatConversation.business_id == business_id)
            .order_by(ChatConversation.updated_at.desc())
            .limit(500)
        )
    ).scalars().all()

    # Group conversations by CUSTOMER: signed-in user_id first, else email, else the
    # conversation id (a truly anonymous one-off can't be deduped).
    def _key(c: ChatConversation) -> str:
        return c.user_id or (c.lead_email.lower() if c.lead_email else f"conv:{c.id}")

    groups: dict[str, list[ChatConversation]] = {}
    for c in convos:
        groups.setdefault(_key(c), []).append(c)

    user_ids = {c.user_id for c in convos if c.user_id}
    profiles: dict[str, dict] = {}
    if user_ids:
        for u in (await db.execute(select(AppUser).where(AppUser.id.in_(user_ids)))).scalars().all():
            try:
                profiles[u.id] = json.loads(u.profile) if u.profile else {}
            except (ValueError, TypeError):
                profiles[u.id] = {}
    appts = (
        await db.execute(
            select(Appointment).where(
                Appointment.business_id == business_id, Appointment.status == "BOOKED"
            )
        )
    ).scalars().all()
    by_convo = {a.conversation_id: a for a in appts if a.conversation_id}
    by_user = {a.user_id: a for a in appts if a.user_id}
    by_email = {a.lead_email: a for a in appts if a.lead_email}

    out = []
    for convs in groups.values():
        latest = max(convs, key=lambda c: c.updated_at or c.created_at)
        # Assignment can be on ANY of the customer's threads — once claimed, stay claimed.
        assigned = next((c for c in convs if c.assigned_agent_id), None)
        canonical = assigned or latest  # message/act on this thread
        # Booking belongs to the customer — match across all their threads.
        appt = (
            next((by_convo[c.id] for c in convs if c.id in by_convo), None)
            or (by_user.get(canonical.user_id) if canonical.user_id else None)
            or (by_email.get(canonical.lead_email) if canonical.lead_email else None)
        )
        profile = profiles.get(canonical.user_id or "", {})
        signals = sum(1 for k in ("name", "email") if getattr(canonical, f"lead_{k}", None))
        grade, score, budget = _grade(profile, booked=appt is not None, has_email=bool(canonical.lead_email), intent_signals=signals)
        out.append(
            {
                "id": canonical.id,
                "name": canonical.lead_name or "Visitor",
                "email": canonical.lead_email,
                "grade": grade,
                "score": score,
                "intentScore": score,
                "budgetEstimate": budget,
                "opportunity": budget,
                "rationale": canonical.rationale or "",
                "profile": profile,
                "bookedAt": appt.start_at.isoformat() if appt else None,
                "assignedAgentId": assigned.assigned_agent_id if assigned else None,
                "assignedAgentName": assigned.assigned_agent_name if assigned else "",
                "reachedOutCount": len(convs),
                "lastActiveAt": (latest.updated_at or latest.created_at).isoformat() if (latest.updated_at or latest.created_at) else None,
                "updatedAt": (latest.updated_at or latest.created_at).isoformat() if (latest.updated_at or latest.created_at) else None,
            }
        )

    # Customer-level filters (post-dedup) + newest-active first.
    if assigned_agent_id:
        out = [l for l in out if l["assignedAgentId"] == assigned_agent_id]
    elif unassigned:
        out = [l for l in out if not l["assignedAgentId"]]
    out.sort(key=lambda l: l["lastActiveAt"] or "", reverse=True)
    return out


@router.post("/leads/{conversation_id}/assign")
async def assign(
    conversation_id: str,
    agent_id: str = Body(..., embed=True),
    agent_name: str = Body("", embed=True),
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """An agent claims a lead/call ('I'll take this'); an admin assigns a chosen agent."""
    if user.role not in ("agent", "admin", "super_admin"):
        raise HTTPException(403, "Agents only")
    c = (
        await db.execute(select(ChatConversation).where(ChatConversation.id == conversation_id))
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Lead not found")
    # Same-company only (super_admin may act anywhere).
    if user.role != "super_admin" and c.business_id != user.business_id:
        raise HTTPException(403, "Outside your company")
    # An agent can only self-assign; an admin/super may target a chosen agent.
    if user.role == "agent":
        agent_id, agent_name = user.id, (user.full_name or user.email)
    # Stamp the first assignment time (for the time-to-assign SLA); keep it stable
    # across re-assignments so the metric reflects "how fast did someone pick it up".
    if agent_id and c.assigned_at is None:
        c.assigned_at = datetime.now(timezone.utc)
    elif not agent_id:
        c.assigned_at = None  # unassigned again
    c.assigned_agent_id = agent_id or None
    c.assigned_agent_name = agent_name
    await db.commit()
    return {"ok": True, "assignedAgentName": agent_name}


# --- AI insight (RAG-grounded, reasoning tier) ------------------------------------

_INSIGHT_SYSTEM = (
    "You are an assistant to a real-estate AGENT. Using the customer's profile, their "
    "conversation with the AI receptionist, and the company knowledge provided, output "
    "ONLY valid JSON matching EXACTLY this schema:\n"
    '{"wants": string, "grade_rationale": string, "suggested_next_step": string, '
    '"questions_to_ask": [string], "relevant_company_facts": [string], "risk_flags": [string]}\n'
    "Ground company facts ONLY in the knowledge provided (empty list if none). Be concise "
    "and concrete. Do not invent anything not supported by the inputs."
)
_EMPTY_INSIGHT = {
    "wants": "",
    "grade_rationale": "",
    "suggested_next_step": "",
    "questions_to_ask": [],
    "relevant_company_facts": [],
    "risk_flags": [],
}


@router.post("/insight")
async def insight(
    conversation_id: str = Body(..., embed=True),
    refresh: bool = Body(False, embed=True),       # force regenerate
    cached_only: bool = Body(False, embed=True),   # return cache without ever calling the LLM
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """On-demand, RAG-grounded brief for an agent about one customer. Runs on the
    REASONING tier (off the customer hot path) with a hard time bound. Cached on the
    conversation so repeat opens are instant and don't re-hit Ollama."""
    convo = (
        await db.execute(select(ChatConversation).where(ChatConversation.id == conversation_id))
    ).scalar_one_or_none()
    if not convo:
        raise HTTPException(404, "Conversation not found")
    # Access check FIRST (before any cache branch) — the assigned agent, or an
    # admin/super in the same company. Never serve cached insight to others.
    if user.role == "agent":
        if convo.assigned_agent_id != user.id:
            raise HTTPException(403, "Not your assigned customer")
    elif user.role == "admin":
        if convo.business_id != user.business_id:
            raise HTTPException(403, "Outside your company")
    elif user.role != "super_admin":
        raise HTTPException(403, "Agents only")
    # Serve cache: page-load (cached_only) always; normal calls if fresh (<24h) unless refresh.
    if convo.insight_json and not refresh:
        fresh = convo.insight_at and (datetime.now(timezone.utc) - convo.insight_at) < timedelta(hours=24)
        if cached_only or fresh:
            try:
                return {**_EMPTY_INSIGHT, **json.loads(convo.insight_json), "cached": True}
            except (ValueError, TypeError):
                pass
    if cached_only:
        return {**_EMPTY_INSIGHT, "cached": False}

    profile = {}
    if convo.user_id:
        u = (await db.execute(select(AppUser).where(AppUser.id == convo.user_id))).scalar_one_or_none()
        if u and u.profile:
            try:
                profile = json.loads(u.profile)
            except (ValueError, TypeError):
                profile = {}

    msgs = (
        await db.execute(
            select(ChatMessage.role, ChatMessage.content)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(12)
        )
    ).all()
    transcript = "\n".join(f"{r}: {c}" for r, c in reversed(msgs))[:2500]

    query = " ".join(str(profile.get(k, "")) for k in ("intent", "budget", "location", "propertyType")).strip()
    try:
        kb = await rag.context_for(db, convo.business_id, query or (convo.lead_name or ""))
    except Exception:
        kb = ""

    user_payload = (
        f"CUSTOMER PROFILE: {json.dumps(profile)}\n\n"
        f"CONVERSATION:\n{transcript or '(no messages yet)'}\n\n"
        f"COMPANY KNOWLEDGE:\n{kb or '(none)'}"
    )
    try:
        data = await asyncio.wait_for(
            llm.chat_json(
                "insight",
                [{"role": "system", "content": _INSIGHT_SYSTEM}, {"role": "user", "content": user_payload}],
                temperature=0.3,
                num_predict=400,
                retries=0,
            ),
            timeout=75,
        )
    except (Exception, asyncio.TimeoutError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    out = {**_EMPTY_INSIGHT, **data}
    # Clamp list lengths + coerce to lists.
    for k in ("questions_to_ask", "relevant_company_facts", "risk_flags"):
        v = out.get(k)
        out[k] = [str(x) for x in v][:5] if isinstance(v, list) else []
    # Cache on the conversation so repeat opens are instant.
    try:
        convo.insight_json = json.dumps(out)
        convo.insight_at = datetime.now(timezone.utc)
        await db.commit()
    except Exception:
        await db.rollback()
    out["cached"] = False
    return out


# --- Agent scorecard (own SLAs / effort / rating) ---------------------------------

@router.get("/me/scorecard")
async def scorecard(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """The agent's OWN performance: customers carried, response/contact SLAs, booked
    calls, conversion, aging leads, effort, and average customer rating of them."""
    if user.role != "agent":
        raise HTTPException(403, "Agents only")
    me, biz = user.id, user.business_id
    now = datetime.now(timezone.utc)

    convos = (
        await db.execute(
            select(ChatConversation).where(
                ChatConversation.business_id == biz, ChatConversation.assigned_agent_id == me
            )
        )
    ).scalars().all()
    carried = len(convos)
    convo_ids = [c.id for c in convos]

    appts = (
        await db.execute(
            select(Appointment).where(Appointment.business_id == biz, Appointment.status == "BOOKED")
        )
    ).scalars().all()
    by_convo = {a.conversation_id for a in appts if a.conversation_id}
    by_user = {a.user_id for a in appts if a.user_id}
    booked = sum(
        1 for c in convos if c.id in by_convo or (c.user_id and c.user_id in by_user)
    )

    # My agent threads + messages → first-contact, response time, effort, stale.
    threads = (
        await db.execute(
            select(AgentThread)
            .where(AgentThread.agent_id == me)
            .options(selectinload(AgentThread.messages))
        )
    ).scalars().all()
    assigned_at = {c.id: c.assigned_at for c in convos}
    first_contact_hrs: list[float] = []
    response_hrs: list[float] = []
    messages_sent = 0
    last_agent_msg: dict[str, datetime] = {}
    msgs_by_day: dict[str, int] = defaultdict(int)
    for t in threads:
        ordered = sorted(t.messages, key=lambda m: m.created_at or now)
        first_agent = next((m for m in ordered if m.sender == "agent"), None)
        a_at = assigned_at.get(t.conversation_id)
        if first_agent and a_at and first_agent.created_at:
            first_contact_hrs.append(max(0.0, (first_agent.created_at - a_at).total_seconds() / 3600))
        prev_customer: datetime | None = None
        for m in ordered:
            if m.sender == "customer":
                prev_customer = m.created_at
            elif m.sender == "agent":
                messages_sent += 1
                if m.created_at:
                    msgs_by_day[m.created_at.astimezone(timezone.utc).date().isoformat()] += 1
                    last_agent_msg[t.conversation_id] = m.created_at
                if prev_customer and m.created_at and m.created_at >= prev_customer:
                    response_hrs.append((m.created_at - prev_customer).total_seconds() / 3600)
                    prev_customer = None

    # Stale = assigned customer with no agent contact in >24h (or never contacted).
    stale = 0
    for c in convos:
        last = last_agent_msg.get(c.id) or c.assigned_at
        if last and (now - last) > timedelta(hours=24):
            stale += 1

    rating_rows = (
        await db.execute(
            select(Feedback.rating).where(
                Feedback.target == "agent", Feedback.agent_id == me, Feedback.rating > 0
            )
        )
    ).scalars().all()
    avg_rating = round(sum(rating_rows) / len(rating_rows), 2) if rating_rows else None

    def _avg(xs: list[float]) -> float | None:
        return round(sum(xs) / len(xs), 1) if xs else None

    trend = [
        {"date": (now - timedelta(days=13 - i)).date().isoformat(),
         "messages": msgs_by_day.get((now - timedelta(days=13 - i)).date().isoformat(), 0)}
        for i in range(14)
    ]
    return {
        "carried": carried,
        "booked": booked,
        "conversion": round(booked / carried, 3) if carried else 0.0,
        "avgFirstContactHours": _avg(first_contact_hrs),
        "avgResponseHours": _avg(response_hrs),
        "messagesSent": messages_sent,
        "staleCount": stale,
        "avgRating": avg_rating,
        "ratingCount": len(rating_rows),
        "trend": trend,
    }
