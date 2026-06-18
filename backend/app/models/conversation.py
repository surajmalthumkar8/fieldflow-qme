"""Persisted receptionist conversations so a visitor/agent can reload and resume.
Lives in the `techages` schema (no FK to Prisma's Business — business_id is a string)."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import SCHEMA, Base
from .auth import new_id


class ChatConversation(Base):
    __tablename__ = "chat_conversation"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    business_id: Mapped[str] = mapped_column(String, index=True)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)  # owning user
    title: Mapped[str] = mapped_column(String, default="New conversation")
    lead_name: Mapped[str] = mapped_column(String, default="")
    lead_email: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.created_at"
    )


class ChatMessage(Base):
    __tablename__ = "chat_message"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey(f"{SCHEMA}.chat_conversation.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String)  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped[ChatConversation] = relationship(back_populates="messages")
