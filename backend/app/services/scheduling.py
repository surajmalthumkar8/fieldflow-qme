"""Agent-call scheduling: real availability, conflict-safe booking, .ics invites.

Availability = business-hours slots for the next N days MINUS already-booked ones.
Booking is atomic (DB unique constraint), so concurrent users can't grab the same
slot. The .ics is a standard calendar invite Gmail/Outlook both understand.
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..models import Appointment

settings = get_settings()


class SlotTaken(Exception):
    """Raised when a slot was booked by someone else first."""


# Timezones we support (IANA name -> label). New York (US Eastern) + India.
SUPPORTED_TZ = {
    "America/New_York": "New York (US Eastern)",
    "Asia/Kolkata": "India (IST)",
}


def tz_for(name: str | None) -> ZoneInfo:
    """Resolve a timezone name to a ZoneInfo, falling back to the configured default."""
    if name and name in SUPPORTED_TZ:
        return ZoneInfo(name)
    return ZoneInfo(settings.schedule_timezone)


def label_in_tz(dt: datetime, tz_name: str | None) -> str:
    # e.g. "Wed, Jun 24 · 2:00 PM"
    return dt.astimezone(tz_for(tz_name)).strftime("%a, %b %-d · %-I:%M %p")


async def available_slots(
    db: AsyncSession, business_id: str, limit: int = 8, tz_name: str | None = None
) -> list[dict]:
    """Return up to `limit` upcoming free slots as {start (ISO/UTC), label}, with
    business hours interpreted in the requested timezone."""
    tz = tz_for(tz_name)
    now = datetime.now(tz)
    horizon = now + timedelta(days=settings.schedule_days_ahead)

    # Slots already booked in the window (compare in UTC).
    rows = (
        await db.execute(
            select(Appointment.start_at).where(
                Appointment.business_id == business_id,
                Appointment.status == "BOOKED",
                Appointment.start_at >= now.astimezone(timezone.utc),
            )
        )
    ).scalars().all()
    taken = {r.astimezone(timezone.utc).replace(microsecond=0) for r in rows}

    out: list[dict] = []
    day = now.date()
    step = timedelta(minutes=settings.schedule_slot_minutes)
    while day <= horizon.date() and len(out) < limit:
        weekday = day.weekday()  # 0=Mon
        if not (settings.schedule_workdays_only and weekday >= 5):
            t = datetime(day.year, day.month, day.day, settings.schedule_open_hour, 0, tzinfo=tz)
            end_of_day = datetime(day.year, day.month, day.day, settings.schedule_close_hour, 0, tzinfo=tz)
            while t < end_of_day and len(out) < limit:
                if t > now + timedelta(minutes=30):  # small lead-time buffer
                    key = t.astimezone(timezone.utc).replace(microsecond=0)
                    if key not in taken:
                        out.append({"start": key.isoformat(), "label": t.strftime("%a, %b %-d · %-I:%M %p")})
                t += step
        day += timedelta(days=1)
    return out


async def book_slot(
    db: AsyncSession,
    business_id: str,
    start_iso: str,
    name: str = "",
    email: str = "",
    phone: str = "",
    notes: str = "",
) -> Appointment:
    """Atomically book a slot. Raises SlotTaken if someone beat us to it."""
    start = datetime.fromisoformat(start_iso)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    end = start + timedelta(minutes=settings.schedule_slot_minutes)

    appt = Appointment(
        business_id=business_id,
        start_at=start,
        end_at=end,
        lead_name=name,
        lead_email=email,
        lead_phone=phone,
        notes=notes,
    )
    db.add(appt)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise SlotTaken()
    await db.refresh(appt)
    return appt


def _ics_dt(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def make_ics(appt: Appointment, business_name: str, organizer_email: str = "") -> str:
    """Build a standard iCalendar invite (Gmail/Outlook compatible)."""
    organizer = organizer_email or settings.smtp_from or settings.smtp_user or "no-reply@techages.ai"
    summary = f"Call with {business_name}"
    desc = f"Your call with a {business_name} agent. Lead: {appt.lead_name} {appt.lead_phone}".strip()
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Techages AI//Receptionist//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{appt.id}@techages.ai",
        f"DTSTAMP:{_ics_dt(datetime.now(timezone.utc))}",
        f"DTSTART:{_ics_dt(appt.start_at)}",
        f"DTEND:{_ics_dt(appt.end_at)}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{desc}",
        f"ORGANIZER:mailto:{organizer}",
    ]
    if appt.lead_email:
        lines.append(f"ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:{appt.lead_email}")
    lines += ["STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR"]
    return "\r\n".join(lines)
