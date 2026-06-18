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
SCHEMA = "techages"

engine = create_async_engine(settings.async_database_url, future=True, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    metadata = MetaData(schema=SCHEMA)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


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
