import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from src.database import Base


class Signal(Base):
    __tablename__ = "signals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(
        SAEnum("pending", "processing", "completed", "failed", name="signal_status"),
        nullable=False,
        default="pending",
    )
    source = Column(
        SAEnum(
            "slack",
            "microsoft_teams",
            "google_forms",
            "zendesk",
            "servicenow",
            "figma",
            "granola",
            "intercom",
            "direct_upload",
            "api",
            name="signal_source",
        ),
        nullable=False,
    )
    source_data_type = Column(
        SAEnum("text", "audio", "image", name="signal_data_type"),
        nullable=False,
    )

    raw_artifact_r2_key = Column(Text, nullable=False)
    raw_artifact_mime_type = Column(String(255), nullable=False)
    raw_artifact_size_bytes = Column(Integer, nullable=False)

    transcript = Column(Text, nullable=True)
    extracted_text = Column(Text, nullable=True)
    original_text = Column(Text, nullable=True)

    structured_summary = Column(Text, nullable=True)
    entities = Column(JSONB, default=list)
    sentiment = Column(SAEnum("positive", "negative", "neutral", "mixed", name="sentiment"), nullable=True)
    urgency = Column(SAEnum("low", "medium", "high", "critical", name="urgency"), nullable=True)

    embedding = Column(Vector(1536), nullable=True)
    source_metadata = Column(JSONB, default=dict)

    synthesized = Column(Boolean, nullable=False, default=False)
    last_synthesized_at = Column(DateTime(timezone=True), nullable=True)

    organization_id = Column(UUID(as_uuid=True), nullable=False)
    trigger_id = Column(UUID(as_uuid=True), ForeignKey("triggers.id"), nullable=True)
    ingested_event_id = Column(UUID(as_uuid=True), ForeignKey("ingested_events.id"), nullable=True)
    event_buffer_id = Column(UUID(as_uuid=True), ForeignKey("event_buffers.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    source_created_at = Column(DateTime(timezone=True), nullable=True)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    processing_error = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_signals_org", "organization_id"),
        Index("idx_signals_source", "source"),
        Index("idx_signals_status", "status"),
        Index("idx_signals_created_at", "created_at"),
        Index("idx_signals_org_source", "organization_id", "source"),
        Index("idx_signals_synthesized", "organization_id", "synthesized"),
        Index("idx_signals_trigger", "trigger_id"),
        Index("idx_signals_ingested_event", "ingested_event_id"),
    )
