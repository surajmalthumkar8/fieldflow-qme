"""Shared FastAPI dependencies (auth)."""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from ..models import AppSession, AppUser
from .security import decode_token

bearer = HTTPBearer(auto_error=True)


async def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    jti = payload.get("jti")
    sub = payload.get("sub")
    session = (await db.execute(select(AppSession).where(AppSession.jti == jti))).scalar_one_or_none()
    if not session or session.revoked_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session revoked")
    if session.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    user = (await db.execute(select(AppUser).where(AppUser.id == sub))).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user
