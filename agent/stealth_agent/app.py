"""FastAPI application for the agent service."""

from __future__ import annotations

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from stealth_agent.config import settings
from stealth_agent.routes.chat import router as chat_router
from stealth_agent.routes.github_webhooks import router as github_webhooks_router
from stealth_agent.routes.indexing import router as indexing_router
from stealth_agent.routes.orchestration import router as orchestration_router

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)

app = FastAPI(title="Stealth Agent Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(github_webhooks_router)
app.include_router(indexing_router)
app.include_router(orchestration_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
