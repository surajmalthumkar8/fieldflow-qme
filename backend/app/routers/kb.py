from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..services import metering, rag
from ..core.database import get_db
from ..core.deps import current_user
from ..models import AppUser, KbDocument
from ..schemas import KbDocIn, KbDocOut, KbHit, KbSearchIn

router = APIRouter(prefix="/kb", tags=["knowledge-base"])


def _kb_scope(user: AppUser, requested: str | None) -> str:
    """Tenant scope for KB ops: admin → own company; super_admin → requested; else 403."""
    if user.role == "admin":
        if not user.business_id:
            raise HTTPException(400, "Your account has no company")
        return user.business_id
    if user.role == "super_admin":
        scope = requested or user.business_id
        if not scope:
            raise HTTPException(400, "business_id required")
        return scope
    raise HTTPException(403, "Company admin only")


@router.post("/documents", response_model=KbDocOut)
async def add_document(body: KbDocIn, user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Ingest a knowledge-base document (chunk + embed + store). business_id comes
    from the token, not the request body."""
    business_id = _kb_scope(user, body.business_id)
    doc = KbDocument(business_id=business_id, title=body.title, source=body.source, content=body.content)
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    n = await rag.ingest_document(db, doc)
    mb = len(body.content.encode("utf-8")) / 1_000_000
    await metering.record(business_id, "rag_ingest", mb, meta=f"manual:{doc.id}")
    return KbDocOut(id=doc.id, business_id=doc.business_id, title=doc.title, chunks=n)


@router.get("/documents")
async def list_documents(business_id: str | None = None, user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    scope = _kb_scope(user, business_id)
    rows = (
        await db.execute(select(KbDocument).where(KbDocument.business_id == scope))
    ).scalars().all()
    return [{"id": d.id, "title": d.title, "source": d.source} for d in rows]


@router.post("/search", response_model=list[KbHit])
async def search(body: KbSearchIn, user: AppUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    scope = _kb_scope(user, body.business_id)
    hits = await rag.search(db, scope, body.query, body.top_k)
    return [KbHit(**h) for h in hits]
