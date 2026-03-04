"""Pydantic request/response schemas for the agent API."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Generic wrappers (mirrors synthesis pattern)
# ---------------------------------------------------------------------------


class ApiResponse(BaseModel):
    data: Any


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


class ChatMessageIn(BaseModel):
    message: str


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime


class ConversationOut(BaseModel):
    id: str
    feature_request_id: str
    messages: list[ChatMessageOut]
    created_at: datetime


# ---------------------------------------------------------------------------
# Jobs / Orchestration
# ---------------------------------------------------------------------------


class TriggerRequest(BaseModel):
    dry_run: bool = True


class JobOut(BaseModel):
    id: str
    feature_request_id: str
    status: str
    result: dict | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
