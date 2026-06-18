"""Agent-facing leads view: the company's customers with their AI-captured score,
profile, scheduled call, and self-assignment."""
import json

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..models import AppUser, Appointment, ChatConversation

router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/leads")
async def leads(business_id: str, db: AsyncSession = Depends(get_db)):
    """All leads (conversations) for a company, newest first, with score + profile
    + whether a call is booked + who's assigned."""
    convos = (
        await db.execute(
            select(ChatConversation)
            .where(ChatConversation.business_id == business_id)
            .order_by(ChatConversation.updated_at.desc())
            .limit(200)
        )
    ).scalars().all()

    # Batch-load the customers' profiles + booked appointments.
    user_ids = {c.user_id for c in convos if c.user_id}
    profiles: dict[str, dict] = {}
    if user_ids:
        users = (await db.execute(select(AppUser).where(AppUser.id.in_(user_ids)))).scalars().all()
        for u in users:
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
    booked_by_email: dict[str, Appointment] = {a.lead_email: a for a in appts if a.lead_email}

    out = []
    for c in convos:
        appt = booked_by_email.get(c.lead_email) if c.lead_email else None
        out.append(
            {
                "id": c.id,
                "name": c.lead_name or "Visitor",
                "email": c.lead_email,
                "grade": c.grade or "—",
                "score": c.score,
                "intentScore": c.intent_score,
                "budgetEstimate": c.budget_estimate,
                "opportunity": c.opportunity,
                "rationale": c.rationale,
                "profile": profiles.get(c.user_id or "", {}),
                "bookedAt": appt.start_at.isoformat() if appt else None,
                "assignedAgentId": c.assigned_agent_id,
                "assignedAgentName": c.assigned_agent_name,
                "updatedAt": c.updated_at.isoformat() if c.updated_at else None,
            }
        )
    return out


@router.post("/leads/{conversation_id}/assign")
async def assign(
    conversation_id: str,
    agent_id: str = Body(..., embed=True),
    agent_name: str = Body("", embed=True),
    db: AsyncSession = Depends(get_db),
):
    """An agent claims a lead/call ('I'll take this')."""
    c = (
        await db.execute(select(ChatConversation).where(ChatConversation.id == conversation_id))
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Lead not found")
    c.assigned_agent_id = agent_id
    c.assigned_agent_name = agent_name
    await db.commit()
    return {"ok": True, "assignedAgentName": agent_name}
