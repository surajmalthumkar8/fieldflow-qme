"""Pydantic request/response models for the API."""
from pydantic import BaseModel, EmailStr, Field


# ---- Auth ----
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = ""
    company_name: str = ""
    timezone: str = "America/New_York"
    business_id: str | None = None
    role: str = "agent"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: str
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    company_name: str = ""
    timezone: str = "America/New_York"
    profile: dict = {}
    role: str
    business_id: str | None = None


# ---- Chat / receptionist ----
class Turn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatIn(BaseModel):
    business_id: str
    business_name: str = "our team"
    service_area: str = ""
    history: list[Turn] = []
    message: str = ""
    use_kb: bool = True
    conversation_id: str | None = None  # omit to start a new persisted conversation
    # Signed-in customer (injected by the proxy from the auth cookie, not the browser).
    user_id: str | None = None
    customer_name: str = ""
    customer_email: str = ""
    customer_profile: str = ""  # short summary of the customer's saved preferences


class ChatAction(BaseModel):
    type: str = "none"
    notes: str | None = None


class ChatOut(BaseModel):
    reply: str
    qualified: bool = False
    sentiment: str = "neutral"
    action: ChatAction = ChatAction()
    captured: dict = {}
    engine: str = "ollama"
    conversation_id: str | None = None


# ---- Lead qualification / summary ----
class QualifyIn(BaseModel):
    history: list[Turn]


class QualifyOut(BaseModel):
    leadGrade: str
    leadScore: int
    intentScore: int
    budgetEstimate: float
    opportunitySize: float
    sentiment: str
    rationale: str = ""
    captured: dict = {}


class SummarizeOut(BaseModel):
    summary: str
    nextStep: str = ""
    keyFacts: list[str] = []


# ---- Knowledge base ----
class KbDocIn(BaseModel):
    business_id: str
    title: str = ""
    source: str = "manual"
    content: str


class KbDocOut(BaseModel):
    id: str
    business_id: str
    title: str
    chunks: int


class KbSearchIn(BaseModel):
    business_id: str
    query: str
    top_k: int = 4


class KbHit(BaseModel):
    content: str
    title: str
    score: float


# ---- Voice ----
class VoiceIn(BaseModel):
    text: str
    voice: str | None = None
