"""SMS utilities — status + a guarded test-send so an admin can verify Twilio is wired
up before campaigns/reactivation rely on it."""
from fastapi import APIRouter, Depends, HTTPException

from ..core.config import get_settings
from ..core.deps import current_user
from ..models import AppUser
from ..schemas import SmsTestIn
from ..services import sms

router = APIRouter(tags=["sms"])


@router.get("/sms/status")
async def sms_status(user: AppUser = Depends(current_user)):
    """Is SMS configured, and what's the sender? Admin/super only."""
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admins only")
    s = get_settings()
    return {
        "enabled": s.sms_enabled,
        "usingMessagingService": bool(s.twilio_messaging_service_sid),
        "sender": s.twilio_messaging_service_sid or s.twilio_from_number or None,
    }


@router.post("/sms/test")
async def sms_test(body: SmsTestIn, user: AppUser = Depends(current_user)):
    """Send a real test SMS to verify the Twilio wiring. Admin/super only. On a trial
    account the destination must be a Twilio-verified number."""
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admins only")
    if not get_settings().sms_enabled:
        raise HTTPException(400, "SMS is not configured — set the Twilio env vars.")
    if not body.to:
        raise HTTPException(400, "Provide a destination number in E.164 form, e.g. +15555550123.")
    sid, error = await sms.send_test(
        body.to,
        body.body or "Test from your AI receptionist — SMS is working.",
    )
    if error:
        raise HTTPException(502, f"Twilio error: {error}")
    return {"ok": True, "sid": sid}
