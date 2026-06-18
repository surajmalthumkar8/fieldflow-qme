from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..core.database import get_db
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


class BookOut(BaseModel):
    ok: bool
    appointment_id: str
    start: str
    label: str
    emailed: bool
    ics: str  # downloadable invite (data the client can offer as "Add to calendar")


@router.get("/availability", response_model=SlotsOut)
async def availability(business_id: str, tz: str | None = None, db: AsyncSession = Depends(get_db)):
    return SlotsOut(slots=await scheduling.available_slots(db, business_id, tz_name=tz))


@router.get("/timezones")
async def timezones():
    """Supported timezones for the slot picker / registration."""
    return [{"value": k, "label": v} for k, v in scheduling.SUPPORTED_TZ.items()]


@router.post("/book", response_model=BookOut)
async def book(body: BookIn, db: AsyncSession = Depends(get_db)):
    try:
        appt = await scheduling.book_slot(
            db, body.business_id, body.start, body.name, body.email, body.phone, body.notes
        )
    except scheduling.SlotTaken:
        raise HTTPException(409, "That time was just taken — please pick another.")
    except ValueError:
        raise HTTPException(400, "Invalid slot time.")

    ics = scheduling.make_ics(appt, body.business_name)
    emailed = await email_service.send_invite(
        body.email,
        subject=f"Your call with {body.business_name}",
        body=f"You're booked for {appt.start_at.isoformat()}. The calendar invite is attached.",
        ics=ics,
    )
    label = scheduling.label_in_tz(appt.start_at, body.tz)
    return BookOut(
        ok=True,
        appointment_id=appt.id,
        start=appt.start_at.isoformat(),
        label=label,
        emailed=emailed,
        ics=ics,
    )
