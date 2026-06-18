"""Send a calendar invite (.ics) by email over SMTP.

Optional: if SMTP isn't configured the booking still succeeds and the .ics is
returned for download — emailing is just the automated convenience layer.
For Gmail, use an App Password (not your normal password).
"""
import asyncio
import smtplib
from email.message import EmailMessage

from ..core.config import get_settings

settings = get_settings()


def _send_sync(to_email: str, subject: str, body: str, ics: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to_email
    msg.set_content(body)
    # Attach the invite as a calendar part so Gmail/Outlook show "Add to calendar".
    msg.add_attachment(
        ics.encode("utf-8"),
        maintype="text",
        subtype="calendar",
        filename="invite.ics",
        params={"method": "REQUEST", "name": "invite.ics"},
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)


async def send_invite(to_email: str, subject: str, body: str, ics: str) -> bool:
    """Returns True if the invite email was sent, False if SMTP isn't configured
    or the send failed (the caller still has a valid booking + downloadable .ics)."""
    if not (settings.email_enabled and to_email):
        return False
    try:
        await asyncio.to_thread(_send_sync, to_email, subject, body, ics)
        return True
    except Exception:
        return False
