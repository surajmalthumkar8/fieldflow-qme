import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..core.database import get_db
from ..core.deps import current_user
from ..models import AppSession, AppUser, PasswordReset
from ..schemas import ForgotIn, InviteIn, LoginIn, RegisterIn, ResetIn, TokenOut, UserOut
from ..core.security import create_access_token, hash_password, verify_password
from ..services import email as email_service

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


async def _issue_reset(db: AsyncSession, user: AppUser, purpose: str) -> str:
    """Create a single-use token for the user and return the full set-password link."""
    token = secrets.token_urlsafe(32)
    db.add(
        PasswordReset(
            user_id=user.id,
            token=token,
            purpose=purpose,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.reset_token_hours),
        )
    )
    return f"{settings.app_url.rstrip('/')}/reset-password?token={token}"


async def _send_invite_email(user: AppUser, link: str, purpose: str) -> bool:
    is_invite = purpose == "invite"
    subject = (
        f"You've been added as an admin for {user.company_name or 'your company'}"
        if is_invite
        else "Reset your password"
    )
    intro = (
        f"Hi {user.full_name or 'there'}, you've been set up as an admin"
        f"{(' for ' + user.company_name) if user.company_name else ''} on Techaegis AI."
        if is_invite
        else f"Hi {user.full_name or 'there'}, we received a request to reset your password."
    )
    body = (
        f"{intro}\n\nSet your password using this secure link (valid {settings.reset_token_hours}h):\n"
        f"{link}\n\nYour sign-in email is: {user.email}\n\n"
        "If you didn't expect this, you can ignore this email."
    )
    html = (
        f"<p>{intro}</p>"
        f"<p>Set your password using this secure link (valid {settings.reset_token_hours}h):</p>"
        f'<p><a href="{link}" style="background:#2563eb;color:#fff;padding:10px 18px;'
        f'border-radius:8px;text-decoration:none;display:inline-block">Set my password</a></p>'
        f'<p style="color:#555;font-size:13px">Or paste this link: {link}</p>'
        f"<p>Your sign-in email is: <b>{user.email}</b></p>"
        '<p style="color:#888;font-size:12px">If you didn\'t expect this, you can ignore this email.</p>'
    )
    return await email_service.send_email(user.email, subject, body, html)


def _user_out(u: AppUser) -> UserOut:
    try:
        profile = json.loads(u.profile) if u.profile else {}
    except (ValueError, TypeError):
        profile = {}
    return UserOut(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        company_name=u.company_name,
        timezone=u.timezone,
        profile=profile if isinstance(profile, dict) else {},
        role=u.role,
        business_id=u.business_id,
    )


async def _issue_token(db: AsyncSession, user: AppUser, request: Request) -> TokenOut:
    jti = uuid.uuid4().hex
    session = AppSession(
        user_id=user.id,
        jti=jti,
        user_agent=request.headers.get("user-agent", "")[:255],
        ip=(request.client.host if request.client else ""),
        expires_at=datetime.now(timezone.utc),  # replaced below
    )
    token, expires_at = create_access_token(sub=user.id, jti=jti, extra={"role": user.role})
    session.expires_at = expires_at
    db.add(session)
    await db.commit()
    return TokenOut(access_token=token, expires_at=expires_at.isoformat(), user=_user_out(user))


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterIn, request: Request, db: AsyncSession = Depends(get_db)):
    exists = (await db.execute(select(AppUser).where(AppUser.email == body.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    tz = body.timezone if body.timezone in ("America/New_York", "Asia/Kolkata") else "America/New_York"
    user = AppUser(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        company_name=body.company_name,
        timezone=tz,
        # PUBLIC self-registration may ONLY create a customer. admin/agent/super_admin
        # accounts are created exclusively through the auth-gated invite flow — never
        # let an anonymous caller mint a privileged role.
        role="customer",
        business_id=body.business_id,
    )
    db.add(user)
    await db.commit()
    return await _issue_token(db, user, request)


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, request: Request, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(AppUser).where(AppUser.email == body.email))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return await _issue_token(db, user, request)


@router.get("/me", response_model=UserOut)
async def me(user: AppUser = Depends(current_user)):
    return _user_out(user)


@router.patch("/profile", response_model=UserOut)
async def update_profile(
    patch: dict = Body(...),
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Merge the given fields into the customer's profile (helps the AI assist them).
    Also accepts full_name to update the display name."""
    try:
        current = json.loads(user.profile) if user.profile else {}
    except (ValueError, TypeError):
        current = {}
    if not isinstance(current, dict):
        current = {}
    for k, v in (patch or {}).items():
        if k == "full_name" and isinstance(v, str):
            user.full_name = v[:120]
        else:
            current[str(k)] = "" if v is None else str(v)[:500]
    user.profile = json.dumps(current)
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_user(
    body: InviteIn,
    actor: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a teammate with a one-time set-password link (no shared passwords):
      - super_admin invites a company ADMIN (any company).
      - a company admin invites an AGENT (their OWN company only).
    The account is created with a random temp password; the link lets them set theirs."""
    if actor.role == "super_admin":
        role = body.role if body.role in ("admin", "agent") else "admin"
        business_id = body.business_id
        company_name = body.company_name
        tz = body.timezone if body.timezone in ("America/New_York", "Asia/Kolkata") else "America/New_York"
    elif actor.role == "admin":
        # Admins can only add agents to their own company.
        role = "agent"
        business_id = actor.business_id
        company_name = actor.company_name
        tz = actor.timezone
        if not business_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your admin account has no company")
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")

    exists = (await db.execute(select(AppUser).where(AppUser.email == body.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "That email is already registered")
    user = AppUser(
        email=body.email,
        password_hash=hash_password(secrets.token_urlsafe(16)),  # unguessable until they set one
        full_name=body.full_name,
        company_name=company_name,
        timezone=tz,
        role=role,
        business_id=business_id,
    )
    db.add(user)
    await db.flush()
    link = await _issue_reset(db, user, "invite")
    await db.commit()
    emailed = await _send_invite_email(user, link, "invite")
    # In dev (no SMTP) we return the link so the flow is still testable.
    return {
        "ok": True,
        "user_id": user.id,
        "email": user.email,
        "emailed": emailed,
        "reset_link": None if emailed else link,
    }


@router.post("/invite/{user_id}/resend")
async def resend_invite(
    user_id: str,
    actor: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-issue and re-send the set-password link. super_admin can resend to anyone;
    a company admin can resend only to agents in their own company."""
    if actor.role not in ("super_admin", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")
    user = (await db.execute(select(AppUser).where(AppUser.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if actor.role == "admin" and not (user.role == "agent" and user.business_id == actor.business_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only manage agents in your own company")
    link = await _issue_reset(db, user, "invite")
    await db.commit()
    emailed = await _send_invite_email(user, link, "invite")
    return {"ok": True, "emailed": emailed, "reset_link": None if emailed else link}


@router.post("/password/forgot")
async def forgot_password(body: ForgotIn, db: AsyncSession = Depends(get_db)):
    """Public: email a reset link if the account exists. Always returns ok (we never
    reveal whether an email is registered)."""
    user = (await db.execute(select(AppUser).where(AppUser.email == body.email))).scalar_one_or_none()
    if user:
        link = await _issue_reset(db, user, "reset")
        await db.commit()
        await _send_invite_email(user, link, "reset")
    return {"ok": True}


@router.get("/password/token/{token}")
async def validate_reset_token(token: str, db: AsyncSession = Depends(get_db)):
    """Public: is this set-password link still valid? Returns the email to show."""
    pr = (await db.execute(select(PasswordReset).where(PasswordReset.token == token))).scalar_one_or_none()
    if not pr or pr.used_at is not None or pr.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return {"valid": False}
    user = (await db.execute(select(AppUser).where(AppUser.id == pr.user_id))).scalar_one_or_none()
    return {"valid": bool(user), "email": user.email if user else "", "purpose": pr.purpose}


@router.post("/password/reset")
async def reset_password(body: ResetIn, db: AsyncSession = Depends(get_db)):
    """Public: set a new password using a valid one-time token. Revokes old sessions."""
    pr = (await db.execute(select(PasswordReset).where(PasswordReset.token == body.token))).scalar_one_or_none()
    if not pr or pr.used_at is not None or pr.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link is invalid or has expired.")
    user = (await db.execute(select(AppUser).where(AppUser.id == pr.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    user.password_hash = hash_password(body.password)
    pr.used_at = datetime.now(timezone.utc)
    # Revoke any active sessions for safety.
    for s in (await db.execute(select(AppSession).where(AppSession.user_id == user.id))).scalars().all():
        if s.revoked_at is None:
            s.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "email": user.email}


@router.post("/logout")
async def logout(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Revoke all active sessions for the user."""
    sessions = (await db.execute(select(AppSession).where(AppSession.user_id == user.id))).scalars().all()
    now = datetime.now(timezone.utc)
    for s in sessions:
        if s.revoked_at is None:
            s.revoked_at = now
    await db.commit()
    return {"revoked": len(sessions)}
