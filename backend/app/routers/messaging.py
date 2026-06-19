"""Agent ↔ customer messaging. The assigned agent and the owning customer share one
human thread per conversation, separate from the AI transcript. Scoped so an agent
can only message their OWN assigned customers, and a customer only their own thread."""
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.deps import current_user
from ..models import AgentMessage, AgentThread, AppUser, ChatConversation, QuestionTemplate

router = APIRouter(prefix="/messaging", tags=["messaging"])

# Predefined real-estate questions an agent can fire off with one tap.
QUESTION_LIBRARY = [
    "What's your target budget range?",
    "Which neighborhoods or areas are you focused on?",
    "Are you pre-approved for financing? With whom?",
    "What's your ideal move-in timeline?",
    "Are you looking to buy, sell, or both?",
    "How many bedrooms / what property type do you need?",
    "Are you currently working with another agent?",
    "What's the best day and time for a quick 15-minute call?",
]


async def _load_convo(db: AsyncSession, conversation_id: str) -> ChatConversation:
    convo = (
        await db.execute(select(ChatConversation).where(ChatConversation.id == conversation_id))
    ).scalar_one_or_none()
    if not convo:
        raise HTTPException(404, "Conversation not found")
    return convo


def _check_access(convo: ChatConversation, user: AppUser) -> str:
    """Return the sender role ('agent'|'customer') if allowed, else 403."""
    if user.role == "customer":
        if convo.user_id == user.id:
            return "customer"
    elif user.role == "agent":
        if convo.assigned_agent_id == user.id:
            return "agent"
    elif user.role in ("admin", "super_admin"):
        # Admins may read (not a normal sender), scoped to their company.
        if user.role == "super_admin" or convo.business_id == user.business_id:
            return "agent"
    raise HTTPException(403, "You don't have access to this conversation")


def _thread_out(thread: AgentThread | None, viewer_role: str) -> dict:
    if not thread:
        return {"thread": None, "messages": []}
    return {
        "thread": {
            "id": thread.id,
            "status": thread.status,
            "iteration": thread.iteration,
            "agentId": thread.agent_id,
        },
        "messages": [
            {
                "id": m.id,
                "sender": m.sender,
                "kind": m.kind,
                "content": m.content,
                "mine": m.sender == viewer_role,
                "createdAt": m.created_at.isoformat() if m.created_at else None,
            }
            for m in thread.messages
        ],
    }


@router.get("/thread/{conversation_id}")
async def get_thread(
    conversation_id: str,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """The human thread for a conversation (agent or customer view)."""
    convo = await _load_convo(db, conversation_id)
    role = _check_access(convo, user)
    thread = (
        await db.execute(
            select(AgentThread)
            .where(AgentThread.conversation_id == conversation_id)
            .options(selectinload(AgentThread.messages))
        )
    ).scalar_one_or_none()
    # Mark the OTHER party's messages as read (read receipts / clears the unread badge).
    if thread:
        now = datetime.now(timezone.utc)
        changed = False
        for m in thread.messages:
            if m.sender != role and m.read_at is None:
                m.read_at = now
                changed = True
        if changed:
            await db.commit()
    return _thread_out(thread, role)


@router.post("/thread/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    content: str = Body("", embed=True),
    kind: str = Body("text", embed=True),
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message. The agent (assigned) starts the thread; the customer replies."""
    convo = await _load_convo(db, conversation_id)
    role = _check_access(convo, user)
    if role != "agent" and user.role == "customer":
        role = "customer"
    text = (content or "").strip()
    if not text:
        raise HTTPException(400, "Message is empty")

    thread = (
        await db.execute(select(AgentThread).where(AgentThread.conversation_id == conversation_id))
    ).scalar_one_or_none()
    if not thread:
        # The thread opens once an agent is ASSIGNED — either the agent reaches out,
        # or the customer messages their assigned agent first.
        if user.role == "agent" and convo.assigned_agent_id == user.id:
            agent_id = user.id
        elif user.role == "customer" and convo.user_id == user.id and convo.assigned_agent_id:
            agent_id = convo.assigned_agent_id
        else:
            raise HTTPException(400, "No agent is assigned to this conversation yet")
        thread = AgentThread(
            conversation_id=conversation_id,
            business_id=convo.business_id,
            agent_id=agent_id,
            customer_user_id=convo.user_id or "",
        )
        db.add(thread)
        await db.flush()
    # A new message on a CLOSED round reopens the next iteration.
    if thread.status == "CLOSED":
        thread.status = "OPEN"
        thread.iteration += 1

    sender = "customer" if user.role == "customer" else "agent"
    db.add(
        AgentMessage(
            thread_id=thread.id,
            iteration=thread.iteration,
            sender=sender,
            sender_id=user.id,
            kind="question" if kind == "question" else "text",
            content=text[:4000],
        )
    )
    await db.commit()
    return {"ok": True}


@router.get("/my-thread")
async def my_thread(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """The signed-in CUSTOMER's agent thread — found by who they are, not by the
    current chat session (an agent may have messaged on a different conversation of
    theirs). Returns the conversation id to drive the 'Your agent' panel."""
    if user.role != "customer":
        raise HTTPException(403, "Customers only")
    thread = (
        await db.execute(
            select(AgentThread)
            .where(AgentThread.customer_user_id == user.id)
            .order_by(AgentThread.updated_at.desc())
            .options(selectinload(AgentThread.messages))
            .limit(1)
        )
    ).scalar_one_or_none()
    if thread:
        convo = (
            await db.execute(select(ChatConversation).where(ChatConversation.id == thread.conversation_id))
        ).scalar_one_or_none()
        return {
            "conversationId": thread.conversation_id,
            "hasAgent": True,
            "agentName": convo.assigned_agent_name if convo else "",
            **_thread_out(thread, "customer"),
        }
    # No thread yet — but if an agent has been ASSIGNED to one of their chats, hand
    # back that conversation so the customer can start the conversation themselves.
    assigned = (
        await db.execute(
            select(ChatConversation)
            .where(ChatConversation.user_id == user.id, ChatConversation.assigned_agent_id.isnot(None))
            .order_by(ChatConversation.updated_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return {
        "conversationId": assigned.id if assigned else None,
        "hasAgent": bool(assigned),
        "agentName": assigned.assigned_agent_name if assigned else "",
        **_thread_out(None, "customer"),
    }


@router.get("/unread")
async def unread_count(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """How many messages are waiting (unread) for the current user — drives the bell."""
    if user.role == "customer":
        # Unread agent messages in the customer's own thread(s).
        q = (
            select(func.count())
            .select_from(AgentMessage)
            .join(AgentThread, AgentMessage.thread_id == AgentThread.id)
            .where(
                AgentThread.customer_user_id == user.id,
                AgentMessage.sender == "agent",
                AgentMessage.read_at.is_(None),
            )
        )
    elif user.role == "agent":
        # Unread customer messages in threads this agent owns.
        q = (
            select(func.count())
            .select_from(AgentMessage)
            .join(AgentThread, AgentMessage.thread_id == AgentThread.id)
            .where(
                AgentThread.agent_id == user.id,
                AgentMessage.sender == "customer",
                AgentMessage.read_at.is_(None),
            )
        )
    else:
        return {"unread": 0}
    n = (await db.execute(q)).scalar() or 0
    return {"unread": int(n)}


@router.get("/question-library")
async def question_library(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Tap-to-send qualifying questions: built-in defaults + the company's custom ones."""
    if user.role not in ("agent", "admin", "super_admin"):
        raise HTTPException(403, "Agents only")
    custom = []
    if user.business_id:
        rows = (
            await db.execute(
                select(QuestionTemplate.text).where(QuestionTemplate.business_id == user.business_id)
                .order_by(QuestionTemplate.created_at.desc())
            )
        ).scalars().all()
        custom = list(rows)
    return {"questions": custom + QUESTION_LIBRARY}


@router.get("/question-templates")
async def list_templates(user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """A company's custom questions (admin manages)."""
    if user.role != "admin" or not user.business_id:
        raise HTTPException(403, "Company admin only")
    rows = (
        await db.execute(
            select(QuestionTemplate).where(QuestionTemplate.business_id == user.business_id)
            .order_by(QuestionTemplate.created_at.desc())
        )
    ).scalars().all()
    return [{"id": t.id, "text": t.text} for t in rows]


@router.post("/question-templates")
async def add_template(
    text: str = Body(..., embed=True),
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "admin" or not user.business_id:
        raise HTTPException(403, "Company admin only")
    t = (text or "").strip()
    if not t:
        raise HTTPException(400, "Question is empty")
    qt = QuestionTemplate(business_id=user.business_id, text=t[:300])
    db.add(qt)
    await db.commit()
    return {"id": qt.id, "text": qt.text}


@router.delete("/question-templates/{template_id}")
async def delete_template(
    template_id: str,
    user: AppUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "admin" or not user.business_id:
        raise HTTPException(403, "Company admin only")
    t = (await db.execute(select(QuestionTemplate).where(QuestionTemplate.id == template_id))).scalar_one_or_none()
    if not t or t.business_id != user.business_id:
        raise HTTPException(404, "Not found")
    await db.delete(t)
    await db.commit()
    return {"ok": True}
