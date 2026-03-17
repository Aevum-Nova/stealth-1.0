from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TriggerBufferConfig(BaseModel):
    time_threshold_minutes: int = 60
    count_threshold: int = 10
    min_buffer_minutes: int = 5


class TriggerMatchConfig(BaseModel):
    confidence_threshold: float = 0.7


class TriggerCreate(BaseModel):
    connector_id: UUID
    natural_language_description: str = Field(min_length=8, max_length=4000)
    scope: dict = Field(default_factory=dict)
    buffer_config: TriggerBufferConfig = Field(default_factory=TriggerBufferConfig)
    match_config: TriggerMatchConfig = Field(default_factory=TriggerMatchConfig)
    status: str = Field(default="active")


class TriggerUpdate(BaseModel):
    natural_language_description: str | None = Field(default=None, min_length=8, max_length=4000)
    scope: dict | None = None
    buffer_config: TriggerBufferConfig | None = None
    match_config: TriggerMatchConfig | None = None
    status: str | None = None


class TriggerScopeOption(BaseModel):
    label: str
    value: str
    description: str | None = None


class TriggerScopeField(BaseModel):
    key: str
    label: str
    type: str
    multiple: bool = False
    required: bool = False
    help: str | None = None
    options: list[TriggerScopeOption] = Field(default_factory=list)


class TriggerConnectorOption(BaseModel):
    connector_id: UUID
    connector_name: str
    plugin_type: str
    display_name: str
    icon: str
    adapter_kind: str
    install_hint: str | None = None
    status: str
    scope_fields: list[TriggerScopeField] = Field(default_factory=list)


class TriggerConnectorSummary(BaseModel):
    id: UUID
    name: str
    type: str
    display_name: str
    icon: str


class TriggerStats(BaseModel):
    matched_events_last_24h: int = 0
    feature_request_count: int = 0
    open_buffer_events: int = 0


class TriggerRead(BaseModel):
    id: UUID
    connector: TriggerConnectorSummary
    plugin_type: str
    natural_language_description: str
    parsed_filter_criteria: dict = Field(default_factory=dict)
    scope: dict = Field(default_factory=dict)
    scope_summary: str
    status: str
    buffer_config: TriggerBufferConfig = Field(default_factory=TriggerBufferConfig)
    match_config: TriggerMatchConfig = Field(default_factory=TriggerMatchConfig)
    stats: TriggerStats = Field(default_factory=TriggerStats)
    last_event_at: datetime | None = None
    last_dispatch_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime
    updated_at: datetime


class TriggerFeatureRequestLink(BaseModel):
    id: UUID
    title: str


class TriggerActivityEvent(BaseModel):
    id: UUID
    external_id: str
    match_score: float | None = None
    processing_status: str
    content_text: str = ""
    source_label: str = ""
    author_name: str | None = None
    signal_id: UUID | None = None
    created_at: datetime
    processed_at: datetime | None = None
    feature_requests: list[TriggerFeatureRequestLink] = Field(default_factory=list)


class TriggerBufferRead(BaseModel):
    id: UUID
    event_count: int
    status: str
    buffer_started_at: datetime
    last_event_at: datetime | None = None
    dispatched_at: datetime | None = None
    completed_at: datetime | None = None
    synthesis_run_id: UUID | None = None
    feature_request_ids: list[str] = Field(default_factory=list)
    error: str | None = None


class TriggerDetail(BaseModel):
    trigger: TriggerRead
    recent_events: list[TriggerActivityEvent] = Field(default_factory=list)
    recent_buffers: list[TriggerBufferRead] = Field(default_factory=list)
