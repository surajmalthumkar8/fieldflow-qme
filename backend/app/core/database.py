"""Async SQLAlchemy engine/session + schema bootstrap.

This service OWNS its own tables (auth + knowledge base) in the same `fieldflow`
Postgres database that Prisma uses for the app tables. We never touch Prisma's
tables here; Prisma never touches ours. On startup we ensure the pgvector
extension and our tables exist (idempotent), so there's no separate migration step.
"""
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings

settings = get_settings()

engine = create_async_engine(settings.async_database_url, future=True, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """Ensure pgvector + this service's tables exist. Safe to run repeatedly."""
    # Import models so they register on Base.metadata before create_all.
    from .. import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # Approximate-NN index for KB chunk search (cosine).
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS kb_chunk_embedding_idx "
                "ON kb_chunk USING hnsw (embedding vector_cosine_ops)"
            )
        )
