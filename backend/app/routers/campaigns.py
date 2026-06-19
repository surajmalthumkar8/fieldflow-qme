"""Marketing campaigns / limited-time offers.

- A company **admin** creates, launches, ends, and tracks campaigns (scoped to their
  own business via the token).
- **Customers + agents** see the offers that are live for them (`/campaigns/active`).
- A **customer** can register interest in an offer, which records it and pings the
  company's staff to follow up.
- The AI receptionist advertises live customer-facing offers (see services/campaigns.py
  + routers/chat.py).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.deps import current_user
from ..models import AppUser, Campaign, CampaignInterest
from ..schemas import CampaignIn, CampaignUpdate, InterestIn
from ..services import campaigns as svc
from ..services import email as email_service

router = APIRouter(tags=["campaigns"])

AUDIENCES = {"customers", "agents", "both"}
STATUSES = {"draft", "active", "ended"}


def _require_admin(user: AppUser) -> str:
    """Campaign management is a company-admin feature. Returns the scoped business_id."""
    if user.role != "admin" or not user.business_id:
        raise HTTPException(403, "Company admin only")
    return user.business_id


def _serialize(c: Campaign, interest_count: int | None = None) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "offer": c.offer,
        "audience": c.audience,
        "status": c.status,
        "live": svc.is_live(c),
        "startsAt": svc._aware(c.starts_at).isoformat() if c.starts_at else None,
        "endsAt": svc._aware(c.ends_at).isoformat() if c.ends_at else None,
        "launchedAt": svc._aware(c.launched_at).isoformat() if c.launched_at else None,
        "createdAt": svc._aware(c.created_at).isoformat() if c.created_at else None,
        "interestCount": interest_count,
    }


async def _notify_staff(db: AsyncSession, business_id: str, subject: str, body: str) -> None:
    """Best-effort email to a business's agents + admins (campaign launch / new interest).
    Never raises — notifications must not break the request."""
    if not email_service:  # pragma: no cover
        return
    try:
        from ..core.config import get_settings

        if not get_settings().email_enabled:
            return
        staff = (
            await db.execute(
                select(AppUser).where(
                    AppUser.business_id == business_id,
                    AppUser.role.in_(("agent", "admin")),
                )
            )
        ).scalars().all()
        for u in staff[:25]:  # cap so a launch never fans out unboundedly
            if u.email:
                await email_service.send_email(u.email, subject, body)
    except Exception:
        pass


# ---------------------------------------------------------------- admin: manage

@router.post("/campaigns")
async def create_campaign(
    body: CampaignIn, user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    biz = _require_admin(user)
    audience = body.audience if body.audience in AUDIENCES else "both"
    c = Campaign(
        business_id=biz,
        title=(body.title or "").strip()[:200],
        description=(body.description or "").strip(),
        offer=(body.offer or "").strip()[:200],
        audience=audience,
        status="draft",
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        created_by=user.id,
    )
    db.add(c)
    await db.commit()
    return _serialize(c, interest_count=0)


@router.get("/campaigns")
async def list_campaigns(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """All of the admin's company campaigns (any status), newest first, with interest counts."""
    biz = _require_admin(user)
    rows = (
        await db.execute(
            select(Campaign).where(Campaign.business_id == biz).order_by(Campaign.created_at.desc())
        )
    ).scalars().all()
    out = []
    for c in rows:
        count = len(
            (
                await db.execute(
                    select(CampaignInterest.id).where(CampaignInterest.campaign_id == c.id)
                )
            ).scalars().all()
        )
        out.append(_serialize(c, interest_count=count))
    return {"items": out}


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    body: CampaignUpdate,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit fields and/or change status. Setting status to 'active' launches the campaign
    (stamps launched_at + notifies staff); 'ended' stops it."""
    biz = _require_admin(user)
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c or c.business_id != biz:
        raise HTTPException(404, "Campaign not found")

    if body.title is not None:
        c.title = body.title.strip()[:200]
    if body.description is not None:
        c.description = body.description.strip()
    if body.offer is not None:
        c.offer = body.offer.strip()[:200]
    if body.audience is not None and body.audience in AUDIENCES:
        c.audience = body.audience
    if body.starts_at is not None:
        c.starts_at = body.starts_at
    if body.ends_at is not None:
        c.ends_at = body.ends_at

    launching = False
    if body.status is not None and body.status in STATUSES:
        was = c.status
        c.status = body.status
        if body.status == "active" and was != "active":
            c.launched_at = datetime.now(timezone.utc)
            launching = True
    await db.commit()

    if launching:
        who = "your customers" if c.audience in ("customers", "both") else "your team"
        await _notify_staff(
            db,
            biz,
            f"Campaign live: {c.title}",
            f"A new campaign is now running for {who}:\n\n"
            f"  {c.title}{(' — ' + c.offer) if c.offer else ''}\n\n"
            f"{c.description}\n\nThe AI receptionist will mention it to customers, and "
            f"interested customers will show up for you to follow up.",
        )
    return _serialize(c)


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str, user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    biz = _require_admin(user)
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c or c.business_id != biz:
        raise HTTPException(404, "Campaign not found")
    await db.delete(c)
    await db.commit()
    return {"ok": True}


@router.get("/campaigns/{campaign_id}/interests")
async def list_interests(
    campaign_id: str, user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    """Customers who registered interest in a campaign (admin + agents follow up)."""
    if user.role not in ("admin", "agent") or not user.business_id:
        raise HTTPException(403, "Staff only")
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c or c.business_id != user.business_id:
        raise HTTPException(404, "Campaign not found")
    rows = (
        await db.execute(
            select(CampaignInterest)
            .where(CampaignInterest.campaign_id == campaign_id)
            .order_by(CampaignInterest.created_at.desc())
        )
    ).scalars().all()
    return {
        "items": [
            {
                "id": r.id,
                "userId": r.user_id,
                "userName": r.user_name,
                "userEmail": r.user_email,
                "note": r.note,
                "handled": r.handled,
                "createdAt": svc._aware(r.created_at).isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }


# ------------------------------------------------------- customer / agent: view

@router.get("/campaigns/active")
async def active_campaigns(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Live offers for the signed-in user, filtered to their audience by role."""
    if not user.business_id:
        return {"items": []}
    audience = "customers" if user.role == "customer" else "agents" if user.role == "agent" else None
    rows = await svc.live_campaigns(db, user.business_id, audience=audience)
    return {"items": [_serialize(c) for c in rows]}


@router.post("/campaigns/{campaign_id}/interest")
async def register_interest(
    campaign_id: str,
    body: InterestIn,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """A customer taps 'I'm interested' on a live offer. Records it (once) and pings staff."""
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c or c.business_id != user.business_id:
        raise HTTPException(404, "Campaign not found")
    if not svc.is_live(c):
        raise HTTPException(400, "This offer is no longer running")

    existing = (
        await db.execute(
            select(CampaignInterest).where(
                CampaignInterest.campaign_id == campaign_id, CampaignInterest.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.note = (body.note or existing.note)[:1000]
    else:
        db.add(
            CampaignInterest(
                campaign_id=campaign_id,
                business_id=c.business_id,
                user_id=user.id,
                user_name=user.full_name or "",
                user_email=user.email or "",
                note=(body.note or "")[:1000],
            )
        )
    await db.commit()

    if not existing:
        await _notify_staff(
            db,
            c.business_id,
            f"New interest in '{c.title}'",
            f"{user.full_name or user.email or 'A customer'} is interested in your campaign "
            f"'{c.title}'. Follow up to discuss and book.",
        )
    return {"ok": True}
