"""Central configuration for the Techaegis AI receptionist service.

One place that knows: which local Ollama model each receptionist role uses, how to
reach Ollama and Postgres, and the auth/JWT settings. Values come from the
environment (the repo-root `.env` is loaded), with sensible local-dev defaults.
"""
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load the repo-root .env (shared with the Next.js app) if present, then a
# backend-local .env (overrides) if the operator wants service-specific values.
# app/core/config.py -> parents: [0]=core [1]=app [2]=backend [3]=repo root
REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env", override=True)


# Which local Ollama model each receptionist role runs on. These are all already
# pulled locally (see docs/research_findings.md for the rationale).
ROLE_MODELS = {
    # ONE small fast model for everything, so Ollama keeps a single resident model
    # (a model swap or a context-size change costs a ~40s reload). qwen2.5:1.5b is
    # ~2x faster than the 3b warm (~2-3s vs ~5-6s) with coherent JSON — the lead
    # grading that used to need a bigger model is now an instant heuristic, so the
    # receptionist can use the smaller, snappier model.
    "receptionist": "qwen2.5:1.5b",  # conversation (hot path — keep it fast)
    "qualifier": "qwen2.5:1.5b",     # /qualify endpoint (on-demand only)
    "classifier": "qwen2.5:1.5b",
    "summarizer": "qwen2.5:1.5b",    # conversation summaries
    "embedding": "nomic-embed-text",  # 768-dim RAG embeddings
}
DEFAULT_MODEL = "qwen2.5:1.5b"
EMBEDDING_DIM = 768  # nomic-embed-text

# Two model TIERS, by job:
#  - FAST  → the customer-facing receptionist (and quick classifies). Protect this
#            experience: keep it small + snappy, never let it wait behind heavy work.
#  - REASONING → back-office analysis the customer never waits on (feedback summary,
#            agent insights, qualification). May be a heavier "thinking" model.
# model_for() maps roles to a tier; the actual model names come from Settings so you
# can swap a thinking model in via env without code changes.
_REASONING_ROLES = {"summarizer", "qualifier", "insight"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", case_sensitive=False)

    # --- Database (async). Derived from DATABASE_URL but forced to asyncpg. ---
    database_url: str = "postgresql://shivanarayandey@localhost:5432/fieldflow"

    # --- Ollama ---
    ollama_host: str = "http://localhost:11434"
    ollama_timeout: float = 300.0  # generous: first call cold-loads a multi-GB model
    # Keep models resident so we don't pay the ~40s cold-load on every turn.
    ollama_keep_alive: str = "30m"
    prewarm: bool = True  # load the receptionist model at startup

    # --- Model tiers (see _REASONING_ROLES above) ---
    # Default both to the same fast model so a single Ollama instance never has to
    # swap/evict (a swap would slow the very next customer chat). In PRODUCTION set
    # reasoning_model to a thinking model AND reasoning_host to a SEPARATE Ollama
    # instance (its own GPU box) so the two tiers never contend for the one slot.
    fast_model: str = DEFAULT_MODEL
    reasoning_model: str = DEFAULT_MODEL
    reasoning_host: str = ""  # blank → use ollama_host; set to a 2nd Ollama in prod

    # --- Auth / JWT ---
    jwt_secret: str = "dev-insecure-change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 12  # 12h sessions

    # --- Voice ---
    # "auto" -> Kokoro if installed, else macOS `say`. Or force "kokoro"/"say".
    tts_provider: str = "auto"
    tts_voice: str = "af_heart"   # Kokoro US female voice id
    say_voice: str = "Samantha"   # macOS fallback US female voice

    # --- Scheduling (agent call booking) ---
    schedule_timezone: str = "America/New_York"  # default; per-user tz overrides
    schedule_open_hour: int = 9        # business hours start (local)
    schedule_close_hour: int = 17      # business hours end (local)
    schedule_slot_minutes: int = 30    # slot length
    schedule_days_ahead: int = 10      # how far out to offer slots
    schedule_workdays_only: bool = True  # Mon–Fri only

    # --- Outbound email for calendar invites (.ics). Leave blank to skip sending;
    #     the invite is still bookable + downloadable. Gmail: use an App Password. ---
    smtp_host: str = ""
    smtp_port: int = 587
    # Accept either SMTP_USER or SMTP_USERNAME.
    smtp_user: str = Field("", validation_alias=AliasChoices("smtp_user", "smtp_username"))
    smtp_password: str = ""
    smtp_from: str = ""  # defaults to smtp_user

    # --- Outbound SMS (Twilio). Leave blank to disable; campaigns/reactivation then
    #     skip texting gracefully. Provide TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN and
    #     either a TWILIO_MESSAGING_SERVICE_SID (preferred for A2P 10DLC) or a
    #     TWILIO_FROM_NUMBER (E.164, e.g. +15555550111). ---
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""              # E.164 sender, e.g. +15555550111
    twilio_messaging_service_sid: str = ""    # preferred: a Messaging Service (10DLC pool)

    # --- Public app URL (for links in outbound email, e.g. password-set links) ---
    app_url: str = "http://localhost:3000"
    reset_token_hours: int = 48  # how long an invite / password-reset link is valid

    # --- CORS (Next.js dev) ---
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def sms_enabled(self) -> bool:
        """SMS is sendable once we have creds AND a sender (number or messaging service)."""
        return bool(
            self.twilio_account_sid
            and self.twilio_auth_token
            and (self.twilio_from_number or self.twilio_messaging_service_sid)
        )

    @property
    def async_database_url(self) -> str:
        """Force the SQLAlchemy asyncpg driver and strip Prisma-style query args."""
        url = self.database_url
        # Prisma uses ?schema=public; asyncpg doesn't understand it.
        url = url.split("?")[0]
        if url.startswith("postgresql+asyncpg://"):
            return url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def model_for(role: str) -> str:
    """Map a role to its model via the tier config (env-overridable)."""
    s = get_settings()
    if role == "embedding":
        return "nomic-embed-text"
    if role in _REASONING_ROLES:
        return s.reasoning_model
    return s.fast_model  # receptionist, classifier, anything else → fast


def host_for(role: str) -> str:
    """Which Ollama instance serves a role. Reasoning roles can run on a separate
    instance (reasoning_host) so heavy analysis never blocks the customer model."""
    s = get_settings()
    if role in _REASONING_ROLES and s.reasoning_host:
        return s.reasoning_host
    return s.ollama_host
