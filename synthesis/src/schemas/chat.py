from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel


class ChatQueryRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class ChatConversationRead(BaseModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageRead(BaseModel):
    id: UUID
    conversation_id: UUID
    role: Literal["user", "assistant"]
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StreamEvent(BaseModel):
    type: Literal["token", "tool_call", "tool_result", "status", "done"]
    name: str | None = None
    content: str = ""
    input: dict[str, Any] | None = None
    tool_use_id: str | None = None


class ChatQueryResponse(BaseModel):
    conversation_id: str
    message_id: str
