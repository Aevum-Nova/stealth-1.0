import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from src.database import Base


class Trigger(Base):
    __tablename__ = "triggers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    connector_id = Column(UUID(as_uuid=True), ForeignKey("connectors.id", ondelete="CASCADE"), nullable=False)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    plugin_type = Column(String(50), nullable=False)
    natural_language_description = Column(Text, nullable=False)
    parsed_filter_criteria = Column(JSONB, default=dict)
    scope = Column(JSONB, default=dict)
    scope_summary = Column(Text, nullable=False, default="All activity")
    status = Column(String(32), nullable=False, default="active")
    buffer_config = Column(JSONB, default=dict)
    match_config = Column(JSONB, default=dict)
    last_event_at = Column(DateTime(timezone=True), nullable=True)
    last_dispatch_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_triggers_org", "organization_id"),
        Index("idx_triggers_connector", "connector_id"),
        Index("idx_triggers_status", "organization_id", "status"),
        Index("idx_triggers_plugin", "organization_id", "plugin_type"),
    )


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    trigger_id = Column(UUID(as_uuid=True), ForeignKey("triggers.id", ondelete="CASCADE"), nullable=False)
    connector_id = Column(UUID(as_uuid=True), ForeignKey("connectors.id", ondelete="CASCADE"), nullable=False)
    plugin_type = Column(String(50), nullable=False)
    adapter_kind = Column(String(32), nullable=False, default="webhook")
    external_subscription_id = Column(String(255), nullable=True)
    callback_url = Column(Text, nullable=False)
    subscription_expiry = Column(DateTime(timezone=True), nullable=True)
    scope_config = Column(JSONB, default=dict)
    status = Column(String(32), nullable=False, default="active")
    subscription_metadata = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_webhook_sub_trigger", "trigger_id"),
        Index("idx_webhook_sub_status", "organization_id", "status"),
    )


class IngestedEvent(Base):
    __tablename__ = "ingested_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    trigger_id = Column(UUID(as_uuid=True), ForeignKey("triggers.id", ondelete="CASCADE"), nullable=True)
    event_buffer_id = Column(UUID(as_uuid=True), ForeignKey("event_buffers.id", ondelete="SET NULL"), nullable=True)
    plugin_type = Column(String(50), nullable=False)
    external_id = Column(String(255), nullable=False)
    match_score = Column(Float, nullable=True)
    processing_status = Column(String(32), nullable=False, default="received")
    raw_payload = Column(JSONB, default=dict)
    normalized_payload = Column(JSONB, default=dict)
    signal_id = Column(UUID(as_uuid=True), ForeignKey("signals.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_ingested_events_org", "organization_id"),
        Index("idx_ingested_events_trigger", "trigger_id"),
        Index("idx_ingested_events_status", "organization_id", "processing_status"),
        Index("idx_ingested_events_ext", "plugin_type", "external_id"),
    )


class EventBuffer(Base):
    __tablename__ = "event_buffers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    trigger_id = Column(UUID(as_uuid=True), ForeignKey("triggers.id", ondelete="CASCADE"), nullable=False)
    event_ids = Column(JSONB, default=list)
    signal_ids = Column(JSONB, default=list)
    event_count = Column(Integer, nullable=False, default=0)
    status = Column(String(32), nullable=False, default="open")
    buffer_started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_event_at = Column(DateTime(timezone=True), nullable=True)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    synthesis_run_id = Column(UUID(as_uuid=True), ForeignKey("synthesis_runs.id", ondelete="SET NULL"), nullable=True)
    error = Column(Text, nullable=True)
    buffer_metadata = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_event_buffers_trigger", "trigger_id"),
        Index("idx_event_buffers_status", "organization_id", "status"),
    )
