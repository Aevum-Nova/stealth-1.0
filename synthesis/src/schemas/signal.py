from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SignalSource(StrEnum):
    SLACK = "slack"
    GOOGLE_FORMS = "google_forms"
    ZENDESK = "zendesk"
    SERVICENOW = "servicenow"
    FIGMA = "figma"
    GRANOLA = "granola"
    INTERCOM = "intercom"
    DIRECT_UPLOAD = "direct_upload"
    API = "api"


class SignalDataType(StrEnum):
    TEXT = "text"
    AUDIO = "audio"
    IMAGE = "image"


class SignalStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Sentiment(StrEnum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class Urgency(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SignalEntity(BaseModel):
    type: str
    value: str
    confidence: float = Field(ge=0.0, le=1.0)


class SignalSourceMetadata(BaseModel):
    connector_id: str | None = None
    external_id: str | None = None
    channel_name: str | None = None
    author_name: str | None = None
    author_email: str | None = None
    customer_id: str | None = None
    customer_company: str | None = None
    thread_id: str | None = None
    url: str | None = None

    model_config = ConfigDict(extra="allow")


class SignalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: SignalStatus
    source: SignalSource
    source_data_type: SignalDataType
    raw_artifact_r2_key: str
    raw_artifact_mime_type: str
    raw_artifact_size_bytes: int
    transcript: str | None = None
    extracted_text: str | None = None
    original_text: str | None = None
    structured_summary: str | None = None
    entities: list[SignalEntity] = Field(default_factory=list)
    sentiment: Sentiment | None = None
    urgency: Urgency | None = None
    source_metadata: dict = Field(default_factory=dict)
    synthesized: bool
    organization_id: UUID
    source_created_at: datetime | None = None
    processing_started_at: datetime | None = None
    processing_completed_at: datetime | None = None
    processing_error: str | None = None
    created_at: datetime
    updated_at: datetime


class IngestTextItem(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)
    metadata: dict = Field(default_factory=dict)


class IngestTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)
    source: SignalSource = SignalSource.API
    metadata: dict = Field(default_factory=dict)


class IngestTextBatchRequest(BaseModel):
    items: list[IngestTextItem] = Field(min_length=1, max_length=100)
    source: SignalSource = SignalSource.API


class SignalSearchResult(BaseModel):
    signal: SignalRead
    score: float
