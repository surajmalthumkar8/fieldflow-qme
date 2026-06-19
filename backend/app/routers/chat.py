from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from ..services import campaigns as campaigns_svc
from ..services import llm, metering, rag, scheduling
from ..core.database import get_db
from ..core.deps import current_user
from ..models import AppUser, ChatConversation, ChatMessage
from ..prompts import loader
from ..schemas import ChatAction, ChatIn, ChatOut

router = APIRouter(tags=["ai"])

# Keep only the most recent turns in the prompt (a sliding/compact window).
MAX_HISTORY_TURNS = 12


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
        # For a signed-in customer we already know who they are — stamp it so the
        # agent's leads view always has a name/email (the AI is told not to re-ask).
        if body.customer_name and not convo.lead_name:
            convo.lead_name = body.customer_name
        if body.customer_email and not convo.lead_email:
            convo.lead_email = body.customer_email
        # Keep lead name/email fresh as we capture them (overrides the defaults above).
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
async def chat(body: ChatIn, user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """One receptionist turn. RAG-grounds the reply on the business's knowledge
    base (if any) and returns the structured JSON envelope. Auth-gated + scoped so
    usage is metered to the caller's own company (no cross-tenant bill inflation)."""
    # Scope to the signed-in user's company (super_admin may pass any business_id).
    if user.role != "super_admin" and user.business_id:
        body.business_id = user.business_id
    if not body.business_id:
        raise HTTPException(400, "No company")
    context = ""
    if body.use_kb and body.message.strip():
        try:
            context = await rag.context_for(db, body.business_id, body.message)
        except Exception:
            context = ""  # KB optional — never block the reply

    # Active offers the receptionist may advertise to customers (best-effort).
    campaign_block = ""
    try:
        live = await campaigns_svc.live_campaigns(db, body.business_id, audience="customers")
        campaign_block = campaigns_svc.format_for_prompt(live)
    except Exception:
        campaign_block = ""

    system = loader.receptionist_system_prompt(
        body.business_name,
        body.service_area,
        context,
        customer_name=body.customer_name,
        customer_email=body.customer_email,
        customer_profile=body.customer_profile,
        active_campaigns=campaign_block,
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
        # num_ctx is intentionally NOT overridden — it must match every other call
        # (scoring, prewarm) so Ollama keeps ONE resident model and never reloads.
        # Cap output tight: receptionist replies are 1–2 sentences. A small cap keeps
        # generation ~1-2s (latency scales with output length on a local model).
        data = await llm.chat_json("receptionist", messages, temperature=0.5, num_predict=140)
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

    # If the visitor is being offered scheduling, deterministically pull the date
    # they asked for ("next week", "on the 23rd") so the slot picker starts there —
    # we never trust the small model to do date math.
    after = None
    if atype == "schedule":
        when = scheduling.parse_when(body.message)
        if when is None:  # fall back to the most recent user turn
            for t in reversed(body.history):
                if t.role == "user":
                    when = scheduling.parse_when(t.content)
                    if when:
                        break
        if when:
            after = when.isoformat()

    sentiment = data.get("sentiment")
    if sentiment not in ("positive", "neutral", "negative"):
        sentiment = "neutral"

    captured = data.get("captured")
    if not isinstance(captured, dict):
        captured = {}

    # Meter this AI turn for billing (fire-and-forget; never blocks the reply).
    metering.fire(body.business_id, "ai_message", 1, meta=body.conversation_id or "")
    _ptok, _otok = llm.last_usage()
    if _ptok:
        metering.fire(body.business_id, "tokens_prompt", _ptok)
    if _otok:
        metering.fire(body.business_id, "tokens_output", _otok)

    reply = str(data.get("reply") or "Sorry, could you say that again?")
    # When we're about to show the slot picker, never let the model's reply invent a
    # specific time (small models do this) — it would contradict the real slots. Use
    # a clean, deterministic line; the inline picker shows the actual availability.
    if atype == "schedule":
        reply = "Absolutely — here are some open times below. Pick whichever works and I'll send you the calendar invite."
    clean_captured = {k: str(v) for k, v in captured.items() if v is not None}
    conv_id = await _persist(db, body, reply, clean_captured)
    # NOTE: lead scoring is deliberately NOT done here. Ollama runs one generation
    # at a time (-np 1), so any background LLM call queues AHEAD of the visitor's
    # next message and makes the chat feel slower the more they talk. Scoring now
    # happens lazily when an agent opens the leads dashboard (see routers/agent.py).
    return ChatOut(
        reply=reply,
        qualified=bool(data.get("qualified")),
        sentiment=sentiment,
        action=ChatAction(type=atype, notes=notes, after=after),
        captured=clean_captured,
        engine="ollama",
        conversation_id=conv_id,
    )
