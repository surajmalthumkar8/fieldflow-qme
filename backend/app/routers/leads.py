from fastapi import APIRouter

from .. import llm
from ..prompts import QUALIFY_SYSTEM, SUMMARIZE_SYSTEM
from ..schemas import QualifyIn, QualifyOut, SummarizeOut

router = APIRouter(tags=["ai"])


def _transcript(history) -> str:
    lines = []
    for t in history:
        who = "Visitor" if t.role == "user" else "Ava"
        lines.append(f"{who}: {t.content}")
    return "\n".join(lines)


def _clamp(v, lo, hi, default=0):
    try:
        return max(lo, min(hi, int(float(v))))
    except (TypeError, ValueError):
        return default


def _num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


@router.post("/qualify", response_model=QualifyOut)
async def qualify(body: QualifyIn):
    """Score a conversation: grade + lead/intent scores + budget + opportunity."""
    messages = [
        {"role": "system", "content": QUALIFY_SYSTEM},
        {"role": "user", "content": "Transcript:\n" + _transcript(body.history)},
    ]
    try:
        data = await llm.chat_json("qualifier", messages, temperature=0.2)
    except Exception:
        data = {}  # degrade to an unscored COLD lead rather than failing the request
    grade = str(data.get("leadGrade", "COLD")).upper()
    if grade not in ("HOT", "WARM", "COLD"):
        grade = "COLD"
    sentiment = data.get("sentiment")
    if sentiment not in ("positive", "neutral", "negative"):
        sentiment = "neutral"
    return QualifyOut(
        leadGrade=grade,
        leadScore=_clamp(data.get("leadScore"), 0, 100),
        intentScore=_clamp(data.get("intentScore"), 0, 100),
        budgetEstimate=_num(data.get("budgetEstimate")),
        opportunitySize=_num(data.get("opportunitySize")),
        sentiment=sentiment,
        rationale=str(data.get("rationale", "")),
        captured=data.get("captured") or {},
    )


@router.post("/summarize", response_model=SummarizeOut)
async def summarize(body: QualifyIn):
    messages = [
        {"role": "system", "content": SUMMARIZE_SYSTEM},
        {"role": "user", "content": "Transcript:\n" + _transcript(body.history)},
    ]
    try:
        data = await llm.chat_json("summarizer", messages, temperature=0.3)
    except Exception:
        data = {}
    facts = data.get("keyFacts") or []
    if not isinstance(facts, list):
        facts = [str(facts)]
    return SummarizeOut(
        summary=str(data.get("summary", "")),
        nextStep=str(data.get("nextStep", "")),
        keyFacts=[str(f) for f in facts][:5],
    )
