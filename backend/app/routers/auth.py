import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.deps import current_user
from ..models import AppSession, AppUser
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut
from ..core.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(u: AppUser) -> UserOut:
    return UserOut(id=u.id, email=u.email, full_name=u.full_name, role=u.role, business_id=u.business_id)


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
    user = AppUser(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role if body.role in ("admin", "agent") else "agent",
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
