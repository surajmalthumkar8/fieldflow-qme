from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..core.database import get_db
from ..core.deps import current_user
from ..models import AppUser
from ..services import email as email_service
from ..services import scheduling

router = APIRouter(prefix="/schedule", tags=["scheduling"])
settings = get_settings()


class SlotsOut(BaseModel):
    slots: list[dict]


class BookIn(BaseModel):
    business_id: str
    business_name: str = "our team"
    start: str  # ISO datetime of the chosen slot
    tz: str | None = None
    name: str = ""
    email: str = ""
    phone: str = ""
    notes: str = ""
    conversation_id: str = ""  # link the booking to the chat thread
    user_id: str = ""          # and to the signed-in customer


class BookOut(BaseModel):
    ok: bool
    appointment_id: str
    start: str
    label: str
    emailed: bool
    ics: str  # downloadable invite (data the client can offer as "Add to calendar")
    meeting_url: str = ""   # joinable video meeting link
    gcal_url: str = ""      # one-click "Add to Google Calendar"


@router.get("/availability", response_model=SlotsOut)
async def availability(
    business_id: str | None = None,
    tz: str | None = None,
    after: str | None = None,  # ISO date (YYYY-MM-DD) or NL ("next week") to start from
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    # Scope to the signed-in user's company (super_admin may pass any).
    bid = user.business_id or business_id if user.role != "super_admin" else (business_id or user.business_id)
    if not bid:
        return SlotsOut(slots=[])
    after_date = scheduling.parse_when(after, tz) if after else None
    return SlotsOut(slots=await scheduling.available_slots(db, bid, tz_name=tz, after=after_date))


@router.get("/timezones")
async def timezones():
    """Supported timezones for the slot picker / registration."""
    return [{"value": k, "label": v} for k, v in scheduling.SUPPORTED_TZ.items()]


@router.post("/book", response_model=BookOut)
async def book(body: BookIn, user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    # Book against the signed-in user's company (prevents anonymous slot-flooding and
    # cross-tenant booking). super_admin may target the body's business_id.
    business_id = body.business_id if user.role == "super_admin" else (user.business_id or body.business_id)
    user_id = body.user_id or (user.id if user.role == "customer" else "")
    try:
        appt = await scheduling.book_slot(
            db, business_id, body.start, body.name, body.email, body.phone, body.notes,
            conversation_id=body.conversation_id, user_id=user_id,
        )
    except scheduling.SlotTaken:
        raise HTTPException(409, "That time was just taken — please pick another.")
    except ValueError:
        raise HTTPException(400, "Invalid slot time.")

    ics = scheduling.make_ics(appt, body.business_name)
    join = scheduling.meeting_url(appt)
    gcal = scheduling.google_calendar_link(appt, body.business_name)
    label = scheduling.label_in_tz(appt.start_at, body.tz)
    emailed = await email_service.send_invite(
        body.email,
        subject=f"Your video call with {body.business_name} — {label}",
        body=(
            f"You're booked for {label}.\n\n"
            f"Join the video meeting: {join}\n"
            f"Add to Google Calendar: {gcal}\n\n"
            "The calendar invite (.ics) is attached — it includes the meeting link."
        ),
        ics=ics,
    )
    return BookOut(
        ok=True,
        appointment_id=appt.id,
        start=appt.start_at.isoformat(),
        label=label,
        emailed=emailed,
        ics=ics,
        meeting_url=join,
        gcal_url=gcal,
    )
