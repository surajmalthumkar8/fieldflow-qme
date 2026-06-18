"""Central configuration for the Techages AI receptionist service.

One place that knows: which local Ollama model each receptionist role uses, how to
reach Ollama and Postgres, and the auth/JWT settings. Values come from the
environment (the repo-root `.env` is loaded), with sensible local-dev defaults.
"""
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
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
    # Customer-facing conversation: small + FAST so replies feel instant and human.
    # Reliable JSON for its size; quality is grounded by the prompt + RAG, not raw size.
    "receptionist": "qwen2.5:3b",
    # Background analysis can be heavier/slower (runs after the reply is shown).
    "qualifier": "qwen3.5:9b",        # structured lead scoring (JSON / reasoning)
    "classifier": "phi3:3.8b",        # fast intent / grade booleans
    "summarizer": "qwen3.5:9b",       # faithful structured summaries
    "embedding": "nomic-embed-text",  # 768-dim RAG embeddings
}
DEFAULT_MODEL = "qwen2.5:3b"
EMBEDDING_DIM = 768  # nomic-embed-text


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

    # --- Auth / JWT ---
    jwt_secret: str = "dev-insecure-change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 12  # 12h sessions

    # --- Voice ---
    # "auto" -> Kokoro if installed, else macOS `say`. Or force "kokoro"/"say".
    tts_provider: str = "auto"
    tts_voice: str = "af_heart"   # Kokoro US female voice id
    say_voice: str = "Samantha"   # macOS fallback US female voice

    # --- CORS (Next.js dev) ---
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

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
    return ROLE_MODELS.get(role, DEFAULT_MODEL)
