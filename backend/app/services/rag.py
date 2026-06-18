"""Per-business knowledge base: chunk, embed (Ollama), store + retrieve (pgvector).

Ingestion is intentionally simple (paragraph/character chunking). It's pluggable:
when real client data arrives, add loaders that produce KbDocument rows and call
`ingest_document`. Retrieval is cosine similarity over kb_chunk.embedding.
"""
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from . import llm
from ..models import KbChunk, KbDocument

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


def chunk_text(content: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    content = content.strip()
    if not content:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(content):
        end = start + size
        chunks.append(content[start:end].strip())
        start = end - overlap
    return [c for c in chunks if c]


async def ingest_document(db: AsyncSession, doc: KbDocument) -> int:
    """Embed and store chunks for an already-added KbDocument. Returns chunk count."""
    pieces = chunk_text(doc.content)
    for i, piece in enumerate(pieces):
        vector = await llm.embed(piece)
        db.add(
            KbChunk(
                document_id=doc.id,
                business_id=doc.business_id,
                chunk_index=i,
                content=piece,
                embedding=vector,
            )
        )
    await db.commit()
    return len(pieces)


async def search(db: AsyncSession, business_id: str, query: str, top_k: int = 4) -> list[dict]:
    """Cosine-similarity retrieval scoped to one business."""
    qvec = await llm.embed(query)
    # pgvector cosine distance operator <=> ; similarity = 1 - distance.
    stmt = (
        select(
            KbChunk.content,
            KbDocument.title,
            (1 - KbChunk.embedding.cosine_distance(qvec)).label("score"),
        )
        .join(KbDocument, KbChunk.document_id == KbDocument.id)
        .where(KbChunk.business_id == business_id)
        .order_by(KbChunk.embedding.cosine_distance(qvec))
        .limit(top_k)
    )
    rows = (await db.execute(stmt)).all()
    return [{"content": c, "title": t or "", "score": float(s)} for c, t, s in rows]


async def context_for(db: AsyncSession, business_id: str, query: str, top_k: int = 4) -> str:
    """Build a compact context block for grounding the receptionist reply."""
    if not query.strip():
        return ""
    hits = await search(db, business_id, query, top_k)
    return "\n---\n".join(h["content"] for h in hits if h["score"] > 0.2)
