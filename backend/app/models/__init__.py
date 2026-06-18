"""SQLAlchemy models. Importing this package registers all tables on Base.metadata."""
from .auth import AppSession, AppUser
from .conversation import ChatConversation, ChatMessage
from .knowledge import KbChunk, KbDocument
from .scheduling import Appointment

__all__ = [
    "AppUser",
    "AppSession",
    "KbDocument",
    "KbChunk",
    "Appointment",
    "ChatConversation",
    "ChatMessage",
]
