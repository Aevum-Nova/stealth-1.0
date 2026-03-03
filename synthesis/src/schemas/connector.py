from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ConnectorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    type: str
    name: str
    enabled: bool
    auto_synthesize: bool
    config: dict = Field(default_factory=dict)
    credentials: dict = Field(default_factory=dict)
    last_sync_at: datetime | None = None
    last_sync_error: str | None = None
    created_at: datetime
    updated_at: datetime


class ConnectorCreate(BaseModel):
    type: str
    name: str
    enabled: bool = True
    auto_synthesize: bool = True
    config: dict = Field(default_factory=dict)
    credentials: dict = Field(default_factory=dict)


class ConnectorUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    auto_synthesize: bool | None = None
    config: dict | None = None
    credentials: dict | None = None
