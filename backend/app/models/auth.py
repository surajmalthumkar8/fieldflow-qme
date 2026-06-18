"""Auth models owned by this service (table names prefixed app_* to avoid
collisions with Prisma's app tables in the same database)."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import SCHEMA, Base


def new_id() -> str:
    return uuid.uuid4().hex


class AppUser(Base):
    """An operator/agent login. `business_id` scopes them to one tenant."""
    __tablename__ = "app_user"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    full_name: Mapped[str] = mapped_column(String, default="")
    company_name: Mapped[str] = mapped_column(String, default="")
    timezone: Mapped[str] = mapped_column(String, default="America/New_York")
    profile: Mapped[str] = mapped_column(String, default="{}")  # JSON: customer profile fields
    role: Mapped[str] = mapped_column(String, default="agent")  # admin | agent | customer
    business_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions: Mapped[list["AppSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class AppSession(Base):
    """A persisted login session (jti tracking + revocation)."""
    __tablename__ = "app_session"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.app_user.id", ondelete="CASCADE"), index=True)
    jti: Mapped[str] = mapped_column(String, unique=True, index=True, default=new_id)
    user_agent: Mapped[str] = mapped_column(String, default="")
    ip: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[AppUser] = relationship(back_populates="sessions")
