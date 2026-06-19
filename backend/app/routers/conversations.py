from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.deps import current_user
from ..models import AppUser, ChatConversation

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
async def list_conversations(
    business_id: str | None = None,
    limit: int = 30,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recent conversations (newest first). A customer sees only THEIR OWN; agents/
    admins see their company; super_admin may pass any business_id. Scope from token."""
    q = (
        select(ChatConversation)
        .options(selectinload(ChatConversation.messages))
        .order_by(ChatConversation.updated_at.desc())
        .limit(limit)
    )
    if user.role == "customer":
        q = q.where(ChatConversation.user_id == user.id)
    elif user.role in ("agent", "admin"):
        if not user.business_id:
            return []
        q = q.where(ChatConversation.business_id == user.business_id)
    else:  # super_admin
        if business_id:
            q = q.where(ChatConversation.business_id == business_id)
    rows = (await db.execute(q)).scalars().all()
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
async def get_conversation(
    conversation_id: str,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full transcript so the client can reload + resume. The owning customer, or an
    agent/admin in the same company, or super_admin."""
    c = (
        await db.execute(
            select(ChatConversation)
            .options(selectinload(ChatConversation.messages))
            .where(ChatConversation.id == conversation_id)
        )
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Conversation not found")
    allowed = (
        user.role == "super_admin"
        or (user.role == "customer" and c.user_id == user.id)
        or (user.role in ("agent", "admin") and c.business_id == user.business_id)
    )
    if not allowed:
        raise HTTPException(403, "No access to this conversation")
    return {
        "id": c.id,
        "title": c.title,
        "business_id": c.business_id,
        "messages": [{"role": m.role, "content": m.content} for m in c.messages],
    }
