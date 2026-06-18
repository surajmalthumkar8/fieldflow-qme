from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..models import ChatConversation

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
async def list_conversations(business_id: str, limit: int = 30, db: AsyncSession = Depends(get_db)):
    """Recent conversations for a business (newest first) with a short preview."""
    rows = (
        await db.execute(
            select(ChatConversation)
            .options(selectinload(ChatConversation.messages))
            .where(ChatConversation.business_id == business_id)
            .order_by(ChatConversation.updated_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    out = []
    for c in rows:
        first_user = next((m.content for m in c.messages if m.role == "user"), "")
        out.append(
            {
                "id": c.id,
                "title": c.title or (first_user[:50] if first_user else "New conversation"),
                "lead_name": c.lead_name,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
                "preview": first_user[:80],
                "message_count": len(c.messages),
            }
        )
    return out


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Full transcript so the client can reload + resume."""
    c = (
        await db.execute(
            select(ChatConversation)
            .options(selectinload(ChatConversation.messages))
            .where(ChatConversation.id == conversation_id)
        )
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Conversation not found")
    return {
        "id": c.id,
        "title": c.title,
        "business_id": c.business_id,
        "messages": [{"role": m.role, "content": m.content} for m in c.messages],
    }
