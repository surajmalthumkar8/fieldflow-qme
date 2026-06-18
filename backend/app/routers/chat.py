from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

import asyncio

from sqlalchemy import select

from ..services import llm, rag
from ..core.database import SessionLocal, get_db
from ..models import ChatConversation, ChatMessage
from ..prompts import loader
from ..schemas import ChatAction, ChatIn, ChatOut

router = APIRouter(tags=["ai"])

# Keep only the most recent turns in the prompt (a sliding/compact window).
MAX_HISTORY_TURNS = 12


def _clampi(v) -> int:
    try:
        return max(0, min(100, int(float(v))))
    except (TypeError, ValueError):
        return 0


def _numf(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


async def _score_lead(conversation_id: str, transcript: str, profile: str) -> None:
    """Background: qualify the conversation and store the lead grade/score on it
    so the agent's leads view is always up to date (auto-score after each turn)."""
    try:
        user = "Transcript:\n" + transcript + (f"\n\nKnown customer profile: {profile}" if profile else "")
        data = await llm.chat_json(
            "qualifier",
            [{"role": "system", "content": loader.qualify_system()}, {"role": "user", "content": user}],
            temperature=0.2,
        )
        grade = str(data.get("leadGrade", "COLD")).upper()
        if grade not in ("HOT", "WARM", "COLD"):
            grade = "COLD"
        async with SessionLocal() as db:
            convo = (
                await db.execute(select(ChatConversation).where(ChatConversation.id == conversation_id))
            ).scalar_one_or_none()
            if not convo:
                return
            convo.grade = grade
            convo.score = _clampi(data.get("leadScore"))
            convo.intent_score = _clampi(data.get("intentScore"))
            convo.budget_estimate = _numf(data.get("budgetEstimate"))
            convo.opportunity = _numf(data.get("opportunitySize"))
            convo.rationale = str(data.get("rationale", ""))[:500]
            cap = data.get("captured") or {}
            if isinstance(cap, dict):
                if cap.get("name"):
                    convo.lead_name = str(cap["name"])[:120]
                if cap.get("email"):
                    convo.lead_email = str(cap["email"])[:200]
            await db.commit()
    except Exception:
        pass  # scoring is best-effort, never affects the chat


async def _persist(db, body: ChatIn, reply: str, captured: dict) -> str | None:
    """Save this turn (user + assistant) to a persisted conversation; return its id."""
    try:
        convo = None
        if body.conversation_id:
            convo = (
                await db.execute(
                    select(ChatConversation).where(ChatConversation.id == body.conversation_id)
                )
            ).scalar_one_or_none()
        if convo is None:
            title = (body.message or "New conversation")[:50]
            convo = ChatConversation(business_id=body.business_id, user_id=body.user_id, title=title)
            db.add(convo)
            await db.flush()
        if body.message:
            db.add(ChatMessage(conversation_id=convo.id, role="user", content=body.message))
        db.add(ChatMessage(conversation_id=convo.id, role="assistant", content=reply))
        # Keep lead name/email fresh as we capture them.
        if captured.get("name"):
            convo.lead_name = captured["name"]
        if captured.get("email"):
            convo.lead_email = captured["email"]
        await db.commit()
        return convo.id
    except Exception:
        await db.rollback()
        return body.conversation_id


@router.post("/chat", response_model=ChatOut)
async def chat(body: ChatIn, db: AsyncSession = Depends(get_db)):
    """One receptionist turn. RAG-grounds the reply on the business's knowledge
    base (if any) and returns the structured JSON envelope."""
    context = ""
    if body.use_kb and body.message.strip():
        try:
            context = await rag.context_for(db, body.business_id, body.message)
        except Exception:
            context = ""  # KB optional — never block the reply

    system = loader.receptionist_system_prompt(
        body.business_name,
        body.service_area,
        context,
        customer_name=body.customer_name,
        customer_email=body.customer_email,
        customer_profile=body.customer_profile,
    )
    messages = [{"role": "system", "content": system}]
    # Compact context window: only keep the last N turns so the model stays fast
    # and isn't overloaded (the receptionist only needs recent context to qualify).
    for t in body.history[-MAX_HISTORY_TURNS:]:
        role = "assistant" if t.role == "assistant" else "user"
        messages.append({"role": role, "content": t.content})
    # Opening turn: empty message -> let the model greet.
    messages.append({"role": "user", "content": body.message or "(The visitor just opened the chat. Greet them.)"})

    try:
        data = await llm.chat_json("receptionist", messages, temperature=0.5)
    except Exception:
        # Never let a transient model error break the conversation — degrade gracefully.
        greeting = (
            f"Hi! I'm {loader.persona_name()} with {body.business_name}. I'm an AI assistant and can "
            "connect you to a human anytime. Are you looking to buy, sell, rent, or invest?"
        )
        fallback_reply = greeting if not body.message else "Thanks — let me get an agent to follow up with you shortly. What's the best way to reach you?"
        conv_id = await _persist(db, body, fallback_reply, {})
        return ChatOut(
            reply=fallback_reply,
            qualified=False,
            sentiment="neutral",
            action=ChatAction(type="none"),
            engine="fallback",
            conversation_id=conv_id,
        )
    # Small models vary the JSON shape — be defensive. `action` may come back as a
    # bare string ("none") or be missing; `captured` may not be a dict.
    action = data.get("action")
    if isinstance(action, str):
        action = {"type": action}
    elif not isinstance(action, dict):
        action = {}
    valid_actions = {"schedule", "route_to_agent", "capture_contact", "raise_ticket", "none"}
    atype = action.get("type") if action.get("type") in valid_actions else "none"
    notes = action.get("notes")
    if not isinstance(notes, str):
        notes = None

    sentiment = data.get("sentiment")
    if sentiment not in ("positive", "neutral", "negative"):
        sentiment = "neutral"

    captured = data.get("captured")
    if not isinstance(captured, dict):
        captured = {}

    reply = str(data.get("reply") or "Sorry, could you say that again?")
    clean_captured = {k: str(v) for k, v in captured.items() if v is not None}
    conv_id = await _persist(db, body, reply, clean_captured)
    # Auto-score the lead in the background (never blocks the reply).
    if conv_id and (body.message or body.history):
        lines = [("Visitor" if t.role == "user" else "Elara") + ": " + t.content for t in body.history]
        if body.message:
            lines.append("Visitor: " + body.message)
        lines.append("Elara: " + reply)
        asyncio.create_task(_score_lead(conv_id, "\n".join(lines), body.customer_profile))
    return ChatOut(
        reply=reply,
        qualified=bool(data.get("qualified")),
        sentiment=sentiment,
        action=ChatAction(type=atype, notes=notes),
        captured=clean_captured,
        engine="ollama",
        conversation_id=conv_id,
    )
