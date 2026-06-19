"""Usage metering for billing. Every billable event (AI message, tokens, voice
minute, RAG ingest) is recorded with a snapshot of the unit cost at emit time, so a
later pricing change never rewrites a past period. `usage_period` caches monthly
rollups so billing reads never scan raw events."""
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .auth import new_id


class UsageEvent(Base):
    __tablename__ = "usage_event"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    business_id: Mapped[str] = mapped_column(String, index=True)
    event_type: Mapped[str] = mapped_column(String, index=True)  # ai_message|tokens_prompt|tokens_output|voice_min|rag_ingest
    quantity: Mapped[float] = mapped_column(Float, default=0)     # messages, tokens, minutes, MB
    unit_cost: Mapped[float] = mapped_column(Float, default=0)    # snapshot of resolved rate
    currency: Mapped[str] = mapped_column(String, default="USD")
    plan_code: Mapped[str] = mapped_column(String, default="starter")
    period_key: Mapped[str] = mapped_column(String, index=True)   # YYYY-MM
    meta: Mapped[str] = mapped_column(String, default="")          # small json (conversation/doc/source)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UsagePeriod(Base):
    """Monthly rollup per company (cache). Recomputed lazily from usage_event."""
    __tablename__ = "usage_period"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    business_id: Mapped[str] = mapped_column(String, index=True)
    period_key: Mapped[str] = mapped_column(String, index=True)
    ai_messages: Mapped[int] = mapped_column(Integer, default=0)
    tokens_prompt: Mapped[int] = mapped_column(Integer, default=0)
    tokens_output: Mapped[int] = mapped_column(Integer, default=0)
    voice_minutes: Mapped[float] = mapped_column(Float, default=0)
    rag_mb: Mapped[float] = mapped_column(Float, default=0)
    computed_cost: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String, default="USD")
    status: Mapped[str] = mapped_column(String, default="open")  # open | invoiced
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
