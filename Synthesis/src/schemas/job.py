from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class IngestionJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    connector_id: UUID | None = None
    status: str
    total_items: int
    processed_items: int
    failed_items: int
    signal_ids: list[str] = Field(default_factory=list)
    trigger_synthesis: bool
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class SynthesisRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    status: str
    signal_count: int
    cluster_count: int
    feature_request_count: int
    feature_request_ids: list[str] = Field(default_factory=list)
    model: str | None = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class BatchUploadAcceptedItem(BaseModel):
    filename: str
    signal_id: str


class BatchUploadRejectedItem(BaseModel):
    filename: str
    reason: str


class BatchUploadResponse(BaseModel):
    job_id: str
    total_files: int
    accepted: int
    rejected: int
    rejected_reasons: list[BatchUploadRejectedItem]
