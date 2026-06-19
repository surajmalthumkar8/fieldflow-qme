"""Admin endpoints. Two tiers:
  - super_admin (the platform — us): manages companies + assigns each an admin,
    sees everything across all companies.
  - admin (a company owner): manages ONLY their own company's agents and sees ONLY
    their own company's performance/revenue. Cannot touch other companies.
Companies live in Prisma (managed by the Next.js side); users/agents live here."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import json

from ..core.database import get_db
from ..core.deps import current_user
from ..models import AppUser, Appointment, ChatConversation, ChatMessage
from .agent import _grade

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user: AppUser) -> None:
    """super_admin OR a company admin."""
    if user.role not in ("super_admin", "admin"):
        raise HTTPException(403, "Admin only")


def _require_super(user: AppUser) -> None:
    if user.role != "super_admin":
        raise HTTPException(403, "Super admin only")


def _dedupe_customers(convos: list[ChatConversation]) -> list[ChatConversation]:
    """Collapse a list of conversations to ONE canonical conversation per customer
    (same rule as the leads view) so analytics count CUSTOMERS, not chat sessions.
    Prefers an assigned conversation; else the most recently active one."""
    groups: dict[str, list[ChatConversation]] = {}
    for c in convos:
        key = c.user_id or (c.lead_email.lower() if c.lead_email else f"conv:{c.id}")
        groups.setdefault(key, []).append(c)
    out: list[ChatConversation] = []
    for convs in groups.values():
        assigned = next((c for c in convs if c.assigned_agent_id), None)
        latest = max(convs, key=lambda c: c.updated_at or c.created_at)
        out.append(assigned or latest)
    return out


@router.get("/users")
async def list_users(
    role: str | None = None,
    business_id: str | None = None,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    q = select(AppUser)
    if role:
        q = q.where(AppUser.role == role)
    # A company admin only ever sees their OWN company's users.
    scope = user.business_id if user.role == "admin" else business_id
    if scope:
        q = q.where(AppUser.business_id == scope)
    rows = (await db.execute(q.order_by(AppUser.created_at.desc()).limit(300))).scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "business_id": u.business_id,
            "company_name": u.company_name,
        }
        for u in rows
    ]


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a user. A company admin may only remove agents in their OWN company;
    a super_admin may remove admins + agents (but never a super_admin)."""
    _require_admin(user)
    target = (await db.execute(select(AppUser).where(AppUser.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")
    if target.role == "super_admin":
        raise HTTPException(400, "Cannot remove a super admin account")
    if user.role == "admin":
        if target.role != "agent" or target.business_id != user.business_id:
            raise HTTPException(403, "You can only remove agents in your own company")
    await db.delete(target)
    await db.commit()
    return {"ok": True}


@router.get("/performance")
async def performance(
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Per-agent + per-company performance + revenue. A company admin sees ONLY
    their own company. super_admin is intentionally BLOCKED — company revenue is
    sensitive and never surfaced to the platform (they get /admin/insights instead)."""
    if user.role != "admin":
        raise HTTPException(403, "Company admin only")
    scope = user.business_id  # always scoped to the admin's own company

    agent_q = select(AppUser).where(AppUser.role == "agent")
    convo_q = select(ChatConversation)
    appt_q = select(Appointment).where(Appointment.status == "BOOKED")
    if scope:
        agent_q = agent_q.where(AppUser.business_id == scope)
        convo_q = convo_q.where(ChatConversation.business_id == scope)
        appt_q = appt_q.where(Appointment.business_id == scope)

    agents = (await db.execute(agent_q)).scalars().all()
    convos = _dedupe_customers((await db.execute(convo_q)).scalars().all())  # one row per customer
    appts = (await db.execute(appt_q)).scalars().all()
    booked_convo_ids = {a.conversation_id for a in appts if a.conversation_id}
    booked_user_ids = {a.user_id for a in appts if a.user_id}

    # Customer profiles (for the heuristic grade) — same logic as the leads view.
    cust_ids = {c.user_id for c in convos if c.user_id}
    profiles: dict[str, dict] = {}
    if cust_ids:
        for u in (await db.execute(select(AppUser).where(AppUser.id.in_(cust_ids)))).scalars().all():
            try:
                profiles[u.id] = json.loads(u.profile) if u.profile else {}
            except (ValueError, TypeError):
                profiles[u.id] = {}

    # Aggregate per assigned agent.
    by_agent: dict[str, dict] = {}
    for a in agents:
        by_agent[a.id] = {
            "agentId": a.id,
            "agentName": a.full_name or a.email,
            "email": a.email,
            "companyName": a.company_name,
            "businessId": a.business_id,
            "leads": 0,
            "hot": 0,
            "warm": 0,
            "booked": 0,
            "pipeline": 0.0,
        }
    # Unassigned leads still belong to this company (the admin is scoped to it).
    unassigned = {"agentId": "", "agentName": "Unassigned", "leads": 0, "hot": 0,
                  "warm": 0, "booked": 0, "pipeline": 0.0,
                  "companyName": user.company_name or "Your company", "businessId": scope or ""}

    for c in convos:
        bucket = by_agent.get(c.assigned_agent_id) if c.assigned_agent_id else None
        if bucket is None:
            bucket = unassigned
        booked = c.id in booked_convo_ids or (bool(c.user_id) and c.user_id in booked_user_ids)
        signals = sum(1 for v in (c.lead_name, c.lead_email) if v)
        grade, _score, budget = _grade(
            profiles.get(c.user_id or "", {}), booked=booked,
            has_email=bool(c.lead_email), intent_signals=signals,
        )
        bucket["leads"] += 1
        if grade == "HOT":
            bucket["hot"] += 1
        elif grade == "WARM":
            bucket["warm"] += 1
        if booked:
            bucket["booked"] += 1
        bucket["pipeline"] += budget

    rows = list(by_agent.values())
    if unassigned["leads"]:
        rows.append(unassigned)
    for r in rows:
        r["conversion"] = round(r["booked"] / r["leads"], 2) if r["leads"] else 0.0

    # Roll up per company.
    by_company: dict[str, dict] = {}
    for r in rows:
        key = r["companyName"] or "—"
        comp = by_company.setdefault(
            key, {"companyName": key, "agents": 0, "leads": 0, "booked": 0, "pipeline": 0.0}
        )
        if r["agentId"]:
            comp["agents"] += 1
        comp["leads"] += r["leads"]
        comp["booked"] += r["booked"]
        comp["pipeline"] += r["pipeline"]

    totals = {
        "agents": len(agents),
        "leads": sum(r["leads"] for r in rows),
        "booked": sum(r["booked"] for r in rows),
        "pipeline": sum(r["pipeline"] for r in rows),
    }
    return {
        "agents": sorted(rows, key=lambda r: r["booked"], reverse=True),
        "companies": sorted(by_company.values(), key=lambda r: r["pipeline"], reverse=True),
        "totals": totals,
    }


@router.get("/insights")
async def insights(
    days: int = 14,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """PLATFORM (super_admin) analytics — how our AI product is performing across all
    companies. Deliberately NON-financial: volumes, adoption, AI engagement and
    conversion. The sensitive revenue/pipeline numbers live only in each company
    admin's own performance view, never here."""
    _require_super(user)
    days = max(7, min(days, 90))
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days - 1)

    convos = (
        await db.execute(
            select(ChatConversation.business_id, ChatConversation.created_at, ChatConversation.id)
        )
    ).all()
    appts = (
        await db.execute(
            select(Appointment.business_id, Appointment.created_at).where(
                Appointment.status == "BOOKED"
            )
        )
    ).all()

    # Message volumes (one grouped count, not a full fetch).
    msg_rows = (
        await db.execute(select(ChatMessage.role, func.count()).group_by(ChatMessage.role))
    ).all()
    msg_by_role = {r: int(n) for r, n in msg_rows}
    total_messages = sum(msg_by_role.values())
    ai_messages = msg_by_role.get("assistant", 0)

    total_convos = len(convos)
    total_bookings = len(appts)
    active_business_ids = {c.business_id for c in convos if c.business_id}

    agents = (await db.execute(select(func.count()).select_from(AppUser).where(AppUser.role == "agent"))).scalar() or 0
    customers = (await db.execute(select(func.count()).select_from(AppUser).where(AppUser.role == "customer"))).scalar() or 0

    # Daily trend (conversations + AI-booked calls) over the window.
    def _d(dt: datetime) -> str:
        return dt.astimezone(timezone.utc).date().isoformat()

    conv_by_day: dict[str, int] = defaultdict(int)
    book_by_day: dict[str, int] = defaultdict(int)
    for c in convos:
        if c.created_at and c.created_at >= since:
            conv_by_day[_d(c.created_at)] += 1
    for a in appts:
        if a.created_at and a.created_at >= since:
            book_by_day[_d(a.created_at)] += 1
    trend = []
    for i in range(days):
        day = (since + timedelta(days=i)).date().isoformat()
        trend.append({"date": day, "conversations": conv_by_day.get(day, 0), "bookings": book_by_day.get(day, 0)})

    # Adoption per company (activity counts only — NO revenue).
    conv_by_biz: dict[str, int] = defaultdict(int)
    book_by_biz: dict[str, int] = defaultdict(int)
    last_active: dict[str, str] = {}
    for c in convos:
        if not c.business_id:
            continue
        conv_by_biz[c.business_id] += 1
        if c.created_at:
            iso = c.created_at.astimezone(timezone.utc).isoformat()
            if c.business_id not in last_active or iso > last_active[c.business_id]:
                last_active[c.business_id] = iso
    for a in appts:
        if a.business_id:
            book_by_biz[a.business_id] += 1
    by_company = [
        {
            "businessId": bid,
            "conversations": conv_by_biz[bid],
            "bookings": book_by_biz.get(bid, 0),
            "lastActive": last_active.get(bid),
        }
        for bid in conv_by_biz
    ]
    by_company.sort(key=lambda r: r["conversations"], reverse=True)

    conversion = round(total_bookings / total_convos, 3) if total_convos else 0.0
    avg_msgs = round(total_messages / total_convos, 1) if total_convos else 0.0

    return {
        "totals": {
            "activeCompanies": len(active_business_ids),
            "conversations": total_convos,
            "bookings": total_bookings,
            "messages": total_messages,
            "aiMessages": ai_messages,
            "avgMessagesPerConversation": avg_msgs,
            "conversionRate": conversion,
            "agents": int(agents),
            "customers": int(customers),
        },
        "trend": trend,
        "byCompany": by_company,
        "windowDays": days,
    }


@router.get("/overview")
async def overview(
    days: int = 14,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Company-admin dashboard: KPIs + AI-effectiveness funnel + revenue estimate,
    scoped to the admin's OWN company. (super_admin uses /admin/insights instead.)"""
    if user.role != "admin":
        raise HTTPException(403, "Company admin only")
    scope = user.business_id
    days = max(7, min(days, 90))
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days - 1)

    convos = _dedupe_customers(
        (await db.execute(select(ChatConversation).where(ChatConversation.business_id == scope))).scalars().all()
    )  # one row per customer, so Overview counts customers not chat sessions
    appts = (
        await db.execute(
            select(Appointment).where(
                Appointment.business_id == scope, Appointment.status == "BOOKED"
            )
        )
    ).scalars().all()
    convo_ids = [c.id for c in convos]

    # Per-conversation message counts (user turns drive engagement / drop-off).
    user_msgs: dict[str, int] = defaultdict(int)
    total_msgs: dict[str, int] = defaultdict(int)
    if convo_ids:
        rows = (
            await db.execute(
                select(ChatMessage.conversation_id, ChatMessage.role, func.count())
                .where(ChatMessage.conversation_id.in_(convo_ids))
                .group_by(ChatMessage.conversation_id, ChatMessage.role)
            )
        ).all()
        for cid, role, n in rows:
            total_msgs[cid] += int(n)
            if role == "user":
                user_msgs[cid] += int(n)

    # Customer profiles for the heuristic grade.
    cust_ids = {c.user_id for c in convos if c.user_id}
    profiles: dict[str, dict] = {}
    if cust_ids:
        for u in (await db.execute(select(AppUser).where(AppUser.id.in_(cust_ids)))).scalars().all():
            try:
                profiles[u.id] = json.loads(u.profile) if u.profile else {}
            except (ValueError, TypeError):
                profiles[u.id] = {}

    by_convo = {a.conversation_id for a in appts if a.conversation_id}
    by_user = {a.user_id for a in appts if a.user_id}
    by_email = {a.lead_email for a in appts if a.lead_email}

    grade_mix = {"HOT": 0, "WARM": 0, "COLD": 0}
    pipeline = 0.0
    booked_count = engaged = qualified = dropoff = hot = 0
    msgs_to_book_total = msgs_to_book_n = 0
    agents_set: set[str] = set()

    for c in convos:
        booked = c.id in by_convo or (c.user_id and c.user_id in by_user) or (c.lead_email in by_email)
        signals = sum(1 for v in (c.lead_name, c.lead_email) if v)
        grade, _s, budget = _grade(profiles.get(c.user_id or "", {}), booked=bool(booked), has_email=bool(c.lead_email), intent_signals=signals)
        grade_mix[grade] = grade_mix.get(grade, 0) + 1
        pipeline += budget
        if grade == "HOT":
            hot += 1
        if grade in ("HOT", "WARM"):
            qualified += 1
        if user_msgs.get(c.id, 0) >= 2:
            engaged += 1
        if user_msgs.get(c.id, 0) <= 1:
            dropoff += 1
        if booked:
            booked_count += 1
            msgs_to_book_total += total_msgs.get(c.id, 0)
            msgs_to_book_n += 1
        if c.assigned_agent_id:
            agents_set.add(c.assigned_agent_id)

    total = len(convos)

    def _rate(n: int) -> float:
        return round(n / total, 3) if total else 0.0

    # Daily trend.
    def _d(dt: datetime) -> str:
        return dt.astimezone(timezone.utc).date().isoformat()

    conv_by_day: dict[str, int] = defaultdict(int)
    book_by_day: dict[str, int] = defaultdict(int)
    for c in convos:
        if c.created_at and c.created_at >= since:
            conv_by_day[_d(c.created_at)] += 1
    for a in appts:
        if a.created_at and a.created_at >= since:
            book_by_day[_d(a.created_at)] += 1
    trend = [
        {
            "date": (since + timedelta(days=i)).date().isoformat(),
            "conversations": conv_by_day.get((since + timedelta(days=i)).date().isoformat(), 0),
            "bookings": book_by_day.get((since + timedelta(days=i)).date().isoformat(), 0),
        }
        for i in range(days)
    ]

    return {
        "totals": {
            "conversations": total,
            "bookings": booked_count,
            "bookingRate": _rate(booked_count),
            "hotLeads": hot,
            "pipeline": pipeline,
            "activeAgents": len(agents_set),
            "qualificationRate": _rate(qualified),
            "dropOffRate": _rate(dropoff),
            "avgMessagesToBook": round(msgs_to_book_total / msgs_to_book_n, 1) if msgs_to_book_n else 0.0,
        },
        "gradeMix": grade_mix,
        "funnel": {"conversations": total, "engaged": engaged, "qualified": qualified, "booked": booked_count},
        "trend": trend,
        "windowDays": days,
    }


# SLA thresholds (seconds / hours) — real-estate inbound leads decay fast.
_FIRST_RESPONSE_WARN = 5
_FIRST_RESPONSE_BREACH = 15
_UNASSIGNED_HOT_BREACH_HOURS = 4
_STALE_HOURS = 48


@router.get("/sla")
async def sla(
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Response-time + follow-up SLAs for a company admin: how fast the AI replies,
    how fast HOT leads get picked up, and which leads are slipping. Own company only."""
    if user.role != "admin":
        raise HTTPException(403, "Company admin only")
    scope = user.business_id
    now = datetime.now(timezone.utc)

    convos = _dedupe_customers(
        (await db.execute(select(ChatConversation).where(ChatConversation.business_id == scope))).scalars().all()
    )  # per-customer, so unassigned-hot / aging match the leads view
    convo_ids = [c.id for c in convos]
    appts = (
        await db.execute(
            select(Appointment).where(Appointment.business_id == scope, Appointment.status == "BOOKED")
        )
    ).scalars().all()
    booked_convo_ids = {a.conversation_id for a in appts if a.conversation_id}
    booked_user_ids = {a.user_id for a in appts if a.user_id}

    # First user-msg and first assistant-msg time per conversation → first response.
    first_user: dict[str, datetime] = {}
    first_ai: dict[str, datetime] = {}
    if convo_ids:
        rows = (
            await db.execute(
                select(ChatMessage.conversation_id, ChatMessage.role, ChatMessage.created_at)
                .where(ChatMessage.conversation_id.in_(convo_ids))
                .order_by(ChatMessage.created_at.asc())
            )
        ).all()
        for cid, role, ts in rows:
            if not ts:
                continue
            if role == "user" and cid not in first_user:
                first_user[cid] = ts
            elif role == "assistant" and cid not in first_ai:
                first_ai[cid] = ts

    response_secs: list[float] = []
    breaches = 0
    for cid, ut in first_user.items():
        at = first_ai.get(cid)
        if at and at >= ut:
            secs = (at - ut).total_seconds()
            response_secs.append(secs)
            if secs > _FIRST_RESPONSE_BREACH:
                breaches += 1
    avg_first_response = round(sum(response_secs) / len(response_secs), 1) if response_secs else 0.0
    breach_rate = round(breaches / len(response_secs), 3) if response_secs else 0.0

    # Profiles for grading.
    cust_ids = {c.user_id for c in convos if c.user_id}
    profiles: dict[str, dict] = {}
    if cust_ids:
        for u in (await db.execute(select(AppUser).where(AppUser.id.in_(cust_ids)))).scalars().all():
            try:
                profiles[u.id] = json.loads(u.profile) if u.profile else {}
            except (ValueError, TypeError):
                profiles[u.id] = {}

    def _age_hours(dt: datetime | None) -> float:
        return round((now - dt).total_seconds() / 3600, 1) if dt else 0.0

    unassigned_hot = []
    booked_unassigned = 0
    stale = 0
    assign_hours: list[float] = []
    for c in convos:
        booked = c.id in booked_convo_ids or (c.user_id and c.user_id in booked_user_ids)
        signals = sum(1 for v in (c.lead_name, c.lead_email) if v)
        grade, _s, _b = _grade(profiles.get(c.user_id or "", {}), booked=bool(booked), has_email=bool(c.lead_email), intent_signals=signals)
        if c.assigned_at and c.created_at:
            assign_hours.append((c.assigned_at - c.created_at).total_seconds() / 3600)
        if grade == "HOT" and not c.assigned_agent_id:
            age = _age_hours(c.created_at)
            unassigned_hot.append({
                "id": c.id,
                "name": c.lead_name or "Visitor",
                "ageHours": age,
                "breach": age > _UNASSIGNED_HOT_BREACH_HOURS,
            })
        if booked and not c.assigned_agent_id:
            booked_unassigned += 1
        if grade in ("HOT", "WARM") and c.updated_at and _age_hours(c.updated_at) > _STALE_HOURS:
            stale += 1

    unassigned_hot.sort(key=lambda r: r["ageHours"], reverse=True)
    return {
        "avgFirstResponseSec": avg_first_response,
        "firstResponseBreachRate": breach_rate,
        "avgTimeToAssignHours": round(sum(assign_hours) / len(assign_hours), 1) if assign_hours else None,
        "unassignedHotCount": len(unassigned_hot),
        "unassignedHot": unassigned_hot[:10],
        "bookedUnassigned": booked_unassigned,
        "staleLeads": stale,
        "thresholds": {
            "firstResponseWarnSec": _FIRST_RESPONSE_WARN,
            "firstResponseBreachSec": _FIRST_RESPONSE_BREACH,
            "unassignedHotBreachHours": _UNASSIGNED_HOT_BREACH_HOURS,
            "staleHours": _STALE_HOURS,
        },
    }
