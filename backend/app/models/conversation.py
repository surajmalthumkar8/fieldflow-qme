"""Persisted receptionist conversations so a visitor/agent can reload and resume.
Lives in the `techaegis` schema (no FK to Prisma's Business — business_id is a string)."""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
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
    # Lead scoring (auto-filled after each turn) + agent assignment.
    grade: Mapped[str] = mapped_column(String, default="")  # HOT | WARM | COLD | ""
    score: Mapped[int] = mapped_column(Integer, default=0)
    intent_score: Mapped[int] = mapped_column(Integer, default=0)
    budget_estimate: Mapped[float] = mapped_column(Float, default=0)
    opportunity: Mapped[float] = mapped_column(Float, default=0)
    rationale: Mapped[str] = mapped_column(String, default="")
    assigned_agent_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    assigned_agent_name: Mapped[str] = mapped_column(String, default="")
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # for time-to-assign SLA
    insight_json: Mapped[str] = mapped_column(Text, default="")  # cached agent AI insight
    insight_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
