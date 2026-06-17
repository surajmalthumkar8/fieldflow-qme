from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from .. import llm, rag
from ..db import get_db
from ..prompts import PERSONA_NAME, receptionist_system_prompt
from ..schemas import ChatAction, ChatIn, ChatOut

router = APIRouter(tags=["ai"])


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

    system = receptionist_system_prompt(body.business_name, body.service_area, context)
    messages = [{"role": "system", "content": system}]
    for t in body.history:
        role = "assistant" if t.role == "assistant" else "user"
        messages.append({"role": role, "content": t.content})
    # Opening turn: empty message -> let the model greet.
    messages.append({"role": "user", "content": body.message or "(The visitor just opened the chat. Greet them.)"})

    try:
        data = await llm.chat_json("receptionist", messages, temperature=0.5)
    except Exception:
        # Never let a transient model error break the conversation — degrade gracefully.
        greeting = (
            f"Hi! I'm {PERSONA_NAME} with {body.business_name}. I'm an AI assistant and can "
            "connect you to a human anytime. Are you looking to buy, sell, rent, or invest?"
        )
        return ChatOut(
            reply=greeting if not body.message else "Thanks — let me get an agent to follow up with you shortly. What's the best way to reach you?",
            qualified=False,
            sentiment="neutral",
            action=ChatAction(type="none"),
            engine="fallback",
        )
    action = data.get("action") or {}
    valid_actions = {"schedule", "route_to_agent", "capture_contact", "none"}
    atype = action.get("type") if action.get("type") in valid_actions else "none"
    sentiment = data.get("sentiment")
    if sentiment not in ("positive", "neutral", "negative"):
        sentiment = "neutral"

    return ChatOut(
        reply=str(data.get("reply") or "Sorry, could you say that again?"),
        qualified=bool(data.get("qualified")),
        sentiment=sentiment,
        action=ChatAction(type=atype, notes=action.get("notes")),
        captured=data.get("captured") or {},
        engine="ollama",
    )
