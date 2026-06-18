"""Per-business knowledge-base models for RAG (kb_* tables + pgvector column)."""
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.config import EMBEDDING_DIM
from ..core.database import SCHEMA, Base
from .auth import new_id


class KbDocument(Base):
    """A source document in a business's knowledge base (listing sheet, FAQ,
    policy, neighborhood guide, etc.). Ingestion is pluggable/deferred."""
    __tablename__ = "kb_document"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    business_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String, default="")
    source: Mapped[str] = mapped_column(String, default="")  # url | upload | manual
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chunks: Mapped[list["KbChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class KbChunk(Base):
    """An embedded chunk of a KbDocument for vector retrieval."""
    __tablename__ = "kb_chunk"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    document_id: Mapped[str] = mapped_column(
        ForeignKey(f"{SCHEMA}.kb_document.id", ondelete="CASCADE"), index=True
    )
    business_id: Mapped[str] = mapped_column(String, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))

    document: Mapped[KbDocument] = relationship(back_populates="chunks")
