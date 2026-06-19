"""Agent-call scheduling: real availability, conflict-safe booking, .ics invites.

Availability = business-hours slots for the next N days MINUS already-booked ones.
Booking is atomic (DB unique constraint), so concurrent users can't grab the same
slot. The .ics is a standard calendar invite Gmail/Outlook both understand.
"""
import re
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from dateutil import parser as date_parser
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..models import Appointment

settings = get_settings()

_WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
    "mon": 0, "tue": 1, "tues": 1, "wed": 2, "thu": 3, "thur": 3,
    "thurs": 3, "fri": 4, "sat": 5, "sun": 6,
}


_MONTH_RE = (
    r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b"
)
_DATE_SIGNAL = re.compile(
    _MONTH_RE                       # a month name ("June", "Jun")
    + r"|\b\d{1,2}(st|nd|rd|th)\b"  # an ordinal day ("23rd")
    + r"|\b\d{1,2}[/-]\d{1,2}\b"    # a numeric date ("06/23")
    + r"|\b\d{4}-\d{2}-\d{2}\b",    # an ISO date
    re.I,
)


def parse_when(text: str | None, tz_name: str | None = None) -> date | None:
    """Best-effort: pull a requested *date* out of a natural-language scheduling
    request ("next week", "on the 23rd", "23rd June 2026", "next Monday").
    Returns the date to START showing slots from, or None if nothing was found.
    Deterministic — we never trust the small model to do date math."""
    if not text:
        return None
    s = text.lower().strip()
    today = datetime.now(tz_for(tz_name)).date()

    # An explicit calendar date wins over relative phrases ("next week on the 23rd"
    # -> the 23rd). Only fuzzy-parse when there's a real date signal, so stray
    # numbers ("600k", "3 bed") never get misread as a date.
    if _DATE_SIGNAL.search(s):
        cleaned = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", s)
        try:
            dt = date_parser.parse(
                cleaned, fuzzy=True, default=datetime(today.year, today.month, today.day)
            )
            parsed = dt.date()
            if parsed < today:  # a bare day/month in the past -> next year
                parsed = parsed.replace(year=parsed.year + 1)
            return parsed
        except (ValueError, OverflowError):
            pass

    # Relative phrases.
    if "day after tomorrow" in s:
        return today + timedelta(days=2)
    if "tomorrow" in s:
        return today + timedelta(days=1)
    if re.search(r"\btoday\b", s):
        return today
    m = re.search(r"in\s+(\d+)\s+(day|days|week|weeks)", s)
    if m:
        n = int(m.group(1))
        return today + timedelta(days=n * (7 if "week" in m.group(2) else 1))
    if "next week" in s:  # Monday of next week
        return today + timedelta(days=(7 - today.weekday()))
    if "this week" in s:
        return today
    # "next monday" / "on monday" -> the nearest upcoming Monday.
    m = re.search(r"\b(next\s+)?(" + "|".join(_WEEKDAYS) + r")\b", s)
    if m:
        target = _WEEKDAYS[m.group(2)]
        delta = (target - today.weekday()) % 7 or 7
        return today + timedelta(days=delta)
    return None


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
    db: AsyncSession,
    business_id: str,
    limit: int = 8,
    tz_name: str | None = None,
    after: date | None = None,
    business_tz: str | None = None,
) -> list[dict]:
    """Return up to `limit` upcoming free slots as {start (ISO/UTC), label}.

    Business hours (9–5) are defined in the *business's* timezone (`business_tz`);
    the `label` is rendered in the *viewer's* timezone (`tz_name`) so toggling
    NY/IST re-labels the SAME real slots instead of inventing new ones. If `after`
    is given, only offer slots on/after that date."""
    tz = tz_for(business_tz)        # where business hours live
    view_tz = tz_for(tz_name)       # how we display the time to this visitor
    now = datetime.now(tz)
    # Window starts at the requested date (never in the past), else now.
    start_day = max(after, now.date()) if after else now.date()
    horizon = datetime.combine(start_day, datetime.min.time(), tzinfo=tz) + timedelta(
        days=settings.schedule_days_ahead
    )

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
    day = start_day
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
                        label = t.astimezone(view_tz).strftime("%a, %b %-d · %-I:%M %p")
                        out.append({"start": key.isoformat(), "label": label})
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
    conversation_id: str = "",
    user_id: str = "",
) -> Appointment:
    """Atomically book a slot. Raises SlotTaken if someone beat us to it."""
    start = datetime.fromisoformat(start_iso)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    end = start + timedelta(minutes=settings.schedule_slot_minutes)

    appt = Appointment(
        business_id=business_id,
        conversation_id=conversation_id or "",
        user_id=user_id or "",
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


def meeting_url(appt: Appointment) -> str:
    """A real, joinable video-meeting link for the call. Uses Jitsi (no account, no
    API keys — works instantly, local-first friendly). A native Google Meet/Teams
    link needs that provider's OAuth API — a future integration."""
    return f"https://meet.jit.si/techaegis-{appt.id}"


def google_calendar_link(appt: Appointment, business_name: str) -> str:
    """A one-click 'Add to Google Calendar' link (no API needed)."""
    from urllib.parse import urlencode

    join = meeting_url(appt)
    params = {
        "action": "TEMPLATE",
        "text": f"Call with {business_name}",
        "dates": f"{_ics_dt(appt.start_at)}/{_ics_dt(appt.end_at)}",
        "details": f"Your call with a {business_name} agent.\nJoin the video call: {join}",
        "location": join,
    }
    return "https://calendar.google.com/calendar/render?" + urlencode(params)


def make_ics(appt: Appointment, business_name: str, organizer_email: str = "") -> str:
    """Build a standard iCalendar invite (Gmail/Outlook compatible) with a video link."""
    organizer = organizer_email or settings.smtp_from or settings.smtp_user or "no-reply@techaegis.ai"
    join = meeting_url(appt)
    summary = f"Call with {business_name}"
    desc = (
        f"Your call with a {business_name} agent. Join the video meeting: {join}"
        + (f" | Lead: {appt.lead_name} {appt.lead_phone}".rstrip() if appt.lead_name else "")
    )
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Techaegis AI//Receptionist//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{appt.id}@techaegis.ai",
        f"DTSTAMP:{_ics_dt(datetime.now(timezone.utc))}",
        f"DTSTART:{_ics_dt(appt.start_at)}",
        f"DTEND:{_ics_dt(appt.end_at)}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{desc}",
        f"LOCATION:{join}",
        f"URL:{join}",
        f"X-GOOGLE-CONFERENCE:{join}",
        f"ORGANIZER:mailto:{organizer}",
    ]
    if appt.lead_email:
        lines.append(f"ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:{appt.lead_email}")
    lines += ["STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR"]
    return "\r\n".join(lines)
