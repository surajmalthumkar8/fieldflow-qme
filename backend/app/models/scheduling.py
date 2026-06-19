"""Agent-call appointments. The UNIQUE constraint on (business_id, start_at) is
what makes concurrent double-booking impossible: two users racing for the same
slot — exactly one INSERT wins, the other gets an IntegrityError and re-picks."""
from datetime import datetime

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .auth import new_id


class Appointment(Base):
    __tablename__ = "appointment"
    __table_args__ = (UniqueConstraint("business_id", "start_at", name="uq_business_slot"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    business_id: Mapped[str] = mapped_column(String, index=True)
    # Link the booking back to the chat thread / signed-in customer so the agent's
    # leads dashboard reflects it reliably (email alone is unreliable for known users).
    conversation_id: Mapped[str] = mapped_column(String, default="", index=True)
    user_id: Mapped[str] = mapped_column(String, default="", index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    lead_name: Mapped[str] = mapped_column(String, default="")
    lead_email: Mapped[str] = mapped_column(String, default="")
    lead_phone: Mapped[str] = mapped_column(String, default="")
    notes: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="BOOKED")  # BOOKED | CANCELLED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
