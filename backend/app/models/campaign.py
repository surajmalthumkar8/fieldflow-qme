"""Marketing campaigns / limited-time offers a company admin runs. The AI receptionist
advertises active ones, agents + customers are notified, and customers can register
interest (which routes them to an agent). Lives in the `techaegis` schema (business_id
is a string, no FK to Prisma's Business)."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import SCHEMA, Base
from .auth import new_id


class Campaign(Base):
    __tablename__ = "campaign"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    business_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    offer: Mapped[str] = mapped_column(String, default="")  # short headline, e.g. "15% off listing fee"
    audience: Mapped[str] = mapped_column(String, default="both")  # customers | agents | both
    status: Mapped[str] = mapped_column(String, default="draft", index=True)  # draft | active | ended
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # limited-period window
    created_by: Mapped[str] = mapped_column(String, default="")
    launched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    interests: Mapped[list["CampaignInterest"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan", order_by="CampaignInterest.created_at.desc()"
    )


class CampaignInterest(Base):
    __tablename__ = "campaign_interest"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    campaign_id: Mapped[str] = mapped_column(
        ForeignKey(f"{SCHEMA}.campaign.id", ondelete="CASCADE"), index=True
    )
    business_id: Mapped[str] = mapped_column(String, index=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    user_name: Mapped[str] = mapped_column(String, default="")
    user_email: Mapped[str] = mapped_column(String, default="")
    note: Mapped[str] = mapped_column(Text, default="")
    handled: Mapped[bool] = mapped_column(Boolean, default=False)  # an agent has followed up
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    campaign: Mapped[Campaign] = relationship(back_populates="interests")
