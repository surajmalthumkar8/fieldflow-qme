"""Agent ↔ customer direct messaging — a human thread that sits alongside (but
separate from) the AI receptionist transcript. Kept in its own tables so the AI
chat path (chat_message: user|assistant) is never polluted by human 'agent' rows."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import SCHEMA, Base
from .auth import new_id


class AgentThread(Base):
    """One human thread per (conversation, agent). 'iteration' models a closeable
    round of back-and-forth; closing a round is what prompts agent feedback."""
    __tablename__ = "agent_thread"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(String, index=True)  # shared context anchor
    business_id: Mapped[str] = mapped_column(String, index=True)
    agent_id: Mapped[str] = mapped_column(String, index=True)
    customer_user_id: Mapped[str] = mapped_column(String, default="", index=True)
    status: Mapped[str] = mapped_column(String, default="OPEN")  # OPEN | CLOSED
    iteration: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    messages: Mapped[list["AgentMessage"]] = relationship(
        back_populates="thread", cascade="all, delete-orphan", order_by="AgentMessage.created_at"
    )


class QuestionTemplate(Base):
    """A company's custom quick-question an agent can tap to send (on top of the
    built-in real-estate defaults). Managed by the company admin."""
    __tablename__ = "question_template"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    business_id: Mapped[str] = mapped_column(String, index=True)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgentMessage(Base):
    __tablename__ = "agent_message"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    thread_id: Mapped[str] = mapped_column(
        ForeignKey(f"{SCHEMA}.agent_thread.id", ondelete="CASCADE"), index=True
    )
    iteration: Mapped[int] = mapped_column(Integer, default=1)
    sender: Mapped[str] = mapped_column(String)  # 'agent' | 'customer'
    sender_id: Mapped[str] = mapped_column(String, default="")
    kind: Mapped[str] = mapped_column(String, default="text")  # 'text' | 'question'
    content: Mapped[str] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # stale-unread email sent
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    thread: Mapped[AgentThread] = relationship(back_populates="messages")
