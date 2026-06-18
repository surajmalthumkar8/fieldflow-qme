"""Techages AI — FastAPI AI/voice microservice.

Endpoints:
  GET  /health
  POST /auth/register | /auth/login | GET /auth/me | POST /auth/logout
  POST /chat                receptionist turn (RAG-grounded)
  POST /qualify             lead scoring (grade + scores + budget + opportunity)
  POST /summarize           conversation summary for sales
  POST /kb/documents        ingest KB doc (auth)  | GET /kb/documents | POST /kb/search
  GET  /voice/status | POST /voice    female TTS (Kokoro / macOS say)
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .core.database import init_db
from .routers import agent, auth, chat, conversations, health, kb, leads, scheduling, voice
from .services import llm

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Pre-load the conversation + analysis models so the first customer turn is
    # snappy (no 40s cold-load). Runs in the background; startup isn't blocked.
    if settings.prewarm:
        asyncio.create_task(llm.prewarm(["receptionist", "qualifier"]))
    yield


app = FastAPI(title="Techages AI Receptionist API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-TTS-Provider"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(agent.router)
app.include_router(leads.router)
app.include_router(kb.router)
app.include_router(scheduling.router)
app.include_router(voice.router)


@app.get("/")
async def root():
    return {"service": "techages-ai-receptionist", "docs": "/docs", "health": "/health"}
