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


class SearchReplace(BaseModel):
    search: str
    replace: str


class ProposedChange(BaseModel):
    file_path: str
    content: str = ""
    reason: str = ""
    search_replace: list[SearchReplace] | None = None


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    proposed_changes: list[ProposedChange] | None = None
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
    pass


class ApplyChangesRequest(BaseModel):
    proposed_changes: list[ProposedChange]


class ApplyChangesOut(BaseModel):
    commit_sha: str
    pull_request_url: str


class JobOut(BaseModel):
    id: str
    feature_request_id: str
    status: str
    result: dict | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Indexing
# ---------------------------------------------------------------------------


class IndexStatusOut(BaseModel):
    connector_id: str
    status: str
    total_files: int = 0
    indexed_files: int = 0
    commit_sha: str | None = None
    error: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
