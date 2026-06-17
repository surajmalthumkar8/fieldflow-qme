"""SQLAlchemy models owned by this service (auth + RAG knowledge base).

Table names are prefixed (app_*, kb_*) to avoid any collision with Prisma's
camelCase app tables in the same database.
"""
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .config import EMBEDDING_DIM
from .db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class AppUser(Base):
    """An operator/agent login. `business_id` scopes them to one tenant
    (mirrors Prisma's Business.id cuid)."""
    __tablename__ = "app_user"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    full_name: Mapped[str] = mapped_column(String, default="")
    role: Mapped[str] = mapped_column(String, default="agent")  # admin | agent
    business_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions: Mapped[list["AppSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class AppSession(Base):
    """A persisted login session (refresh/jti tracking + revocation)."""
    __tablename__ = "app_session"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_user.id", ondelete="CASCADE"), index=True)
    jti: Mapped[str] = mapped_column(String, unique=True, index=True, default=_uuid)
    user_agent: Mapped[str] = mapped_column(String, default="")
    ip: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[AppUser] = relationship(back_populates="sessions")


class KbDocument(Base):
    """A source document in a business's knowledge base (listing sheet, FAQ,
    policy, neighborhood guide, etc.). Ingestion is pluggable/deferred."""
    __tablename__ = "kb_document"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    business_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String, default="")
    source: Mapped[str] = mapped_column(String, default="")  # url | upload | manual
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chunks: Mapped[list["KbChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class KbChunk(Base):
    """An embedded chunk of a KbDocument for vector retrieval."""
    __tablename__ = "kb_chunk"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(
        ForeignKey("kb_document.id", ondelete="CASCADE"), index=True
    )
    business_id: Mapped[str] = mapped_column(String, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))

    document: Mapped[KbDocument] = relationship(back_populates="chunks")
