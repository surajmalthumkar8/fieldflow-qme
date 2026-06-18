from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..services import rag
from ..core.database import get_db
from ..core.deps import current_user
from ..models import AppUser, KbDocument
from ..schemas import KbDocIn, KbDocOut, KbHit, KbSearchIn

router = APIRouter(prefix="/kb", tags=["knowledge-base"])


@router.post("/documents", response_model=KbDocOut, dependencies=[Depends(current_user)])
async def add_document(body: KbDocIn, db: AsyncSession = Depends(get_db)):
    """Ingest a knowledge-base document for a business (chunk + embed + store)."""
    doc = KbDocument(
        business_id=body.business_id,
        title=body.title,
        source=body.source,
        content=body.content,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    n = await rag.ingest_document(db, doc)
    return KbDocOut(id=doc.id, business_id=doc.business_id, title=doc.title, chunks=n)


@router.get("/documents", dependencies=[Depends(current_user)])
async def list_documents(business_id: str, db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(select(KbDocument).where(KbDocument.business_id == business_id))
    ).scalars().all()
    return [{"id": d.id, "title": d.title, "source": d.source} for d in rows]


@router.post("/search", response_model=list[KbHit])
async def search(body: KbSearchIn, db: AsyncSession = Depends(get_db)):
    hits = await rag.search(db, body.business_id, body.query, body.top_k)
    return [KbHit(**h) for h in hits]
