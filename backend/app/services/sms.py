"""Outbound SMS via Twilio.

Disabled until creds are set (`settings.sms_enabled`) — callers can always call
`send_sms` and it returns None when SMS is off, so campaign/reactivation code never
has to special-case the unconfigured state.

Twilio's SDK is synchronous; we run the blocking call in a thread so it never blocks
the FastAPI event loop. A STOP footer is appended automatically for compliance.
"""
import asyncio
from functools import lru_cache

from ..core.config import get_settings

settings = get_settings()

STOP_FOOTER = "\nReply STOP to opt out."


@lru_cache(maxsize=1)
def _client():
    """Lazily build the Twilio client (only imported/constructed when SMS is on)."""
    from twilio.rest import Client  # imported lazily so the dep is optional at runtime

    return Client(settings.twilio_account_sid, settings.twilio_auth_token)


def _send_blocking(to: str, body: str) -> str | None:
    kwargs: dict = {"to": to, "body": body}
    # Prefer a Messaging Service (A2P 10DLC number pool); else a single from-number.
    if settings.twilio_messaging_service_sid:
        kwargs["messaging_service_sid"] = settings.twilio_messaging_service_sid
    else:
        kwargs["from_"] = settings.twilio_from_number
    msg = _client().messages.create(**kwargs)
    return msg.sid


async def send_sms(to: str, body: str, append_stop: bool = True) -> str | None:
    """Send one SMS. Returns the Twilio message SID, or None if SMS is disabled or
    the send failed (best-effort — never raises into the caller)."""
    if not settings.sms_enabled or not to or not body:
        return None
    text = body + (STOP_FOOTER if append_stop and "STOP" not in body.upper() else "")
    try:
        return await asyncio.to_thread(_send_blocking, to, text)
    except Exception:
        return None


async def send_test(to: str, body: str) -> tuple[str | None, str | None]:
    """Like send_sms but surfaces the Twilio error (for the admin test endpoint).
    Returns (message_sid, error_message)."""
    if not settings.sms_enabled:
        return None, "SMS is not configured."
    text = body + (STOP_FOOTER if "STOP" not in body.upper() else "")
    try:
        return await asyncio.to_thread(_send_blocking, to, text), None
    except Exception as e:
        return None, str(e)[:300]
