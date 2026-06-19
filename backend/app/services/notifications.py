"""Background: email a recipient when a message sits unread too long. Customer↔agent
messages only. SMS is intentionally not implemented (no phone capture for agents;
would need Twilio) — email is enough for now."""
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from ..core.config import get_settings
from ..core.database import SessionLocal
from ..models import AgentMessage, AgentThread, AppUser
from . import email as email_service

settings = get_settings()

STALE_MINUTES = 15        # email after a message is unread this long
POLL_SECONDS = 300        # how often the loop runs


async def notify_stale_messages() -> int:
    """Find messages unread for > STALE_MINUTES (and not yet emailed) and notify the
    other party once. Returns how many notifications were sent."""
    if not settings.email_enabled:
        return 0
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=STALE_MINUTES)
    sent = 0
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(AgentMessage, AgentThread)
                .join(AgentThread, AgentMessage.thread_id == AgentThread.id)
                .where(
                    AgentMessage.read_at.is_(None),
                    AgentMessage.notified_at.is_(None),
                    AgentMessage.created_at < cutoff,
                )
                .limit(50)
            )
        ).all()
        for msg, thread in rows:
            recipient_id = thread.customer_user_id if msg.sender == "agent" else thread.agent_id
            recipient = (
                await db.execute(select(AppUser).where(AppUser.id == recipient_id))
            ).scalar_one_or_none()
            msg.notified_at = datetime.now(timezone.utc)  # mark regardless, so we don't loop
            if recipient and recipient.email:
                who = "your agent" if msg.sender == "agent" else "a customer"
                subject = f"You have an unread message from {who}"
                body = (
                    f"Hi {recipient.full_name or 'there'},\n\n"
                    f"You have an unread message waiting on Techaegis AI:\n\n"
                    f'  "{(msg.content or "")[:200]}"\n\n'
                    f"Sign in to reply: {settings.app_url.rstrip('/')}\n"
                )
                if await email_service.send_email(recipient.email, subject, body):
                    sent += 1
        await db.commit()
    return sent


async def run_loop() -> None:
    """Periodic notifier. Started from the app lifespan; best-effort, never crashes."""
    while True:
        try:
            await asyncio.sleep(POLL_SECONDS)
            await notify_stale_messages()
        except asyncio.CancelledError:
            break
        except Exception:
            pass
