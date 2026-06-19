"""Customer feedback on the AI receptionist + the experience. Powers the admin and
super-admin feedback views and the local-AI summarizer (themes/bugs/priorities)."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .auth import new_id


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    business_id: Mapped[str] = mapped_column(String, index=True)
    conversation_id: Mapped[str] = mapped_column(String, default="", index=True)
    user_id: Mapped[str] = mapped_column(String, default="", index=True)
    appointment_id: Mapped[str] = mapped_column(String, default="")
    rating: Mapped[int] = mapped_column(Integer, default=0)  # 1-5
    comment: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String, default="other")  # ai_quality|booking|agent|feature_request|bug|other
    source: Mapped[str] = mapped_column(String, default="post_booking")  # post_booking|chat_end|iteration_close|manual
    target: Mapped[str] = mapped_column(String, default="overall")  # ai | agent | overall
    agent_id: Mapped[str] = mapped_column(String, default="")  # set when target='agent'
    sentiment: Mapped[str] = mapped_column(String, default="")  # filled by summarizer batch
    escalated: Mapped[bool] = mapped_column(Boolean, default=False)
    escalation_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
