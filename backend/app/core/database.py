"""Async SQLAlchemy engine/session + schema bootstrap.

This service OWNS its own tables (auth + knowledge base) in the same `fieldflow`
Postgres database that Prisma uses for the app tables. We never touch Prisma's
tables here; Prisma never touches ours. On startup we ensure the pgvector
extension and our tables exist (idempotent), so there's no separate migration step.
"""
from collections.abc import AsyncGenerator

from sqlalchemy import MetaData, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings

settings = get_settings()

# This service's tables live in their OWN schema so Prisma (which manages the
# `public` schema) never tries to drop them. Prisma + FastAPI share one DB safely.
SCHEMA = "techaegis"

# Keep a small pool of warm connections so requests don't pay TCP+auth setup on
# every call (that cold-connect was the ~5s first-hit latency on idle endpoints).
engine = create_async_engine(
    settings.async_database_url,
    future=True,
    echo=False,
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,   # transparently drop dead connections instead of erroring
    pool_recycle=1800,    # recycle every 30 min (avoids stale server-side timeouts)
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    metadata = MetaData(schema=SCHEMA)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def warm_pool(n: int = 3) -> None:
    """Open a few connections up front so the first real requests reuse warm ones
    instead of each paying connection setup (the idle first-hit latency)."""
    import asyncio

    async def _ping() -> None:
        try:
            async with SessionLocal() as s:
                await s.execute(text("SELECT 1"))
        except Exception:
            pass

    await asyncio.gather(*[_ping() for _ in range(n)])


async def init_db() -> None:
    """Ensure pgvector + this service's tables exist. Safe to run repeatedly."""
    # Import models so they register on Base.metadata before create_all.
    from .. import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
        await conn.run_sync(Base.metadata.create_all)
        # Approximate-NN index for KB chunk search (cosine).
        await conn.execute(
            text(
                f"CREATE INDEX IF NOT EXISTS kb_chunk_embedding_idx "
                f"ON {SCHEMA}.kb_chunk USING hnsw (embedding vector_cosine_ops)"
            )
        )
        # Forward-migrations for columns added to existing tables.
        await conn.execute(
            text(f"ALTER TABLE {SCHEMA}.app_user ADD COLUMN IF NOT EXISTS company_name varchar NOT NULL DEFAULT ''")
        )
        await conn.execute(
            text(
                f"ALTER TABLE {SCHEMA}.app_user ADD COLUMN IF NOT EXISTS timezone varchar "
                f"NOT NULL DEFAULT 'America/New_York'"
            )
        )
        await conn.execute(
            text(f"ALTER TABLE {SCHEMA}.chat_conversation ADD COLUMN IF NOT EXISTS user_id varchar")
        )
        await conn.execute(
            text(f"ALTER TABLE {SCHEMA}.app_user ADD COLUMN IF NOT EXISTS profile varchar NOT NULL DEFAULT '{{}}'")
        )
        # Lead scoring + assignment columns on conversations.
        for col, ddl in [
            ("grade", "varchar NOT NULL DEFAULT ''"),
            ("score", "integer NOT NULL DEFAULT 0"),
            ("intent_score", "integer NOT NULL DEFAULT 0"),
            ("budget_estimate", "double precision NOT NULL DEFAULT 0"),
            ("opportunity", "double precision NOT NULL DEFAULT 0"),
            ("rationale", "varchar NOT NULL DEFAULT ''"),
            ("assigned_agent_id", "varchar"),
            ("assigned_agent_name", "varchar NOT NULL DEFAULT ''"),
        ]:
            await conn.execute(
                text(f"ALTER TABLE {SCHEMA}.chat_conversation ADD COLUMN IF NOT EXISTS {col} {ddl}")
            )
        # Link appointments back to the chat thread / customer.
        for col in ("conversation_id", "user_id"):
            await conn.execute(
                text(f"ALTER TABLE {SCHEMA}.appointment ADD COLUMN IF NOT EXISTS {col} varchar NOT NULL DEFAULT ''")
            )
        # When a lead was assigned to an agent (for the time-to-assign SLA).
        await conn.execute(
            text(f"ALTER TABLE {SCHEMA}.chat_conversation ADD COLUMN IF NOT EXISTS assigned_at timestamptz")
        )
        # Feedback split: who/what is being rated (AI vs the human agent).
        await conn.execute(
            text(f"ALTER TABLE {SCHEMA}.feedback ADD COLUMN IF NOT EXISTS target varchar NOT NULL DEFAULT 'overall'")
        )
        await conn.execute(
            text(f"ALTER TABLE {SCHEMA}.feedback ADD COLUMN IF NOT EXISTS agent_id varchar NOT NULL DEFAULT ''")
        )
        # Cached per-customer AI insight (so the agent's "Generate" doesn't re-hit Ollama).
        await conn.execute(
            text(f"ALTER TABLE {SCHEMA}.chat_conversation ADD COLUMN IF NOT EXISTS insight_json text NOT NULL DEFAULT ''")
        )
        await conn.execute(
            text(f"ALTER TABLE {SCHEMA}.chat_conversation ADD COLUMN IF NOT EXISTS insight_at timestamptz")
        )
        # Stale-unread email notification marker on agent messages.
        await conn.execute(
            text(f"ALTER TABLE {SCHEMA}.agent_message ADD COLUMN IF NOT EXISTS notified_at timestamptz")
        )
