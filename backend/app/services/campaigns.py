"""Active-campaign helpers shared by the campaigns router and the AI receptionist.

`live_campaigns` is the single source of truth for "what offers are running right now"
for a business — used both to show customers/agents their active offers and to tell the
receptionist what it may advertise."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Campaign


def _aware(dt: datetime | None) -> datetime | None:
    """Normalize a DB datetime to tz-aware UTC (asyncpg may hand back naive values)."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def is_live(c: Campaign, now: datetime | None = None) -> bool:
    """A campaign is live when it's active AND inside its (optional) start/end window."""
    now = now or datetime.now(timezone.utc)
    if c.status != "active":
        return False
    starts = _aware(c.starts_at)
    ends = _aware(c.ends_at)
    if starts and starts > now:
        return False
    if ends and ends < now:
        return False
    return True


async def live_campaigns(
    db: AsyncSession, business_id: str, audience: str | None = None
) -> list[Campaign]:
    """All currently-running campaigns for a business, newest first. `audience`
    ('customers' | 'agents') filters to offers meant for that group (or 'both')."""
    rows = (
        await db.execute(
            select(Campaign)
            .where(Campaign.business_id == business_id, Campaign.status == "active")
            .order_by(Campaign.launched_at.desc().nullslast(), Campaign.created_at.desc())
        )
    ).scalars().all()
    live = [c for c in rows if is_live(c)]
    if audience:
        live = [c for c in live if c.audience in (audience, "both")]
    return live


def format_for_prompt(rows: list[Campaign]) -> str:
    """Render live campaigns as a compact bullet list for the receptionist prompt."""
    if not rows:
        return ""
    lines = []
    for c in rows:
        bit = f"- {c.title}"
        if c.offer:
            bit += f" — {c.offer}"
        ends = _aware(c.ends_at)
        if ends:
            bit += f" (ends {ends.date().isoformat()})"
        if c.description:
            bit += f": {c.description[:160]}"
        lines.append(bit)
    return "\n".join(lines)
