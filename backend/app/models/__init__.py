"""SQLAlchemy models. Importing this package registers all tables on Base.metadata."""
from .auth import AppSession, AppUser, PasswordReset
from .billing import UsageEvent, UsagePeriod
from .campaign import Campaign, CampaignInterest
from .conversation import ChatConversation, ChatMessage
from .feedback import Feedback
from .knowledge import KbChunk, KbDocument
from .messaging import AgentMessage, AgentThread, QuestionTemplate
from .scheduling import Appointment

__all__ = [
    "AppUser",
    "AppSession",
    "PasswordReset",
    "Feedback",
    "AgentThread",
    "AgentMessage",
    "QuestionTemplate",
    "UsageEvent",
    "UsagePeriod",
    "Campaign",
    "CampaignInterest",
    "KbDocument",
    "KbChunk",
    "Appointment",
    "ChatConversation",
    "ChatMessage",
]
