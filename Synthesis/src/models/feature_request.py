import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.database import Base


class FeatureRequest(Base):
    __tablename__ = "feature_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)

    title = Column(String(500), nullable=False)
    type = Column(
        SAEnum(
            "feature",
            "bug_fix",
            "improvement",
            "integration",
            "ux_change",
            name="feature_request_type",
        ),
        nullable=False,
    )
    status = Column(
        SAEnum(
            "draft",
            "reviewed",
            "approved",
            "rejected",
            "merged",
            "sent_to_agent",
            name="feature_request_status",
        ),
        nullable=False,
        default="draft",
    )
    priority = Column(
        SAEnum("low", "medium", "high", "critical", name="feature_request_priority"),
        nullable=False,
    )
    priority_score = Column(Integer, nullable=False, default=0)

    problem_statement = Column(Text, nullable=False)
    proposed_solution = Column(Text, nullable=False)
    user_story = Column(Text, nullable=False)
    acceptance_criteria = Column(JSONB, default=list)

    technical_notes = Column(Text, nullable=True)
    affected_product_areas = Column(JSONB, default=list)

    supporting_evidence = Column(JSONB, default=list)
    images = Column(JSONB, default=list)
    impact_metrics = Column(JSONB, nullable=True)

    synthesis_run_id = Column(UUID(as_uuid=True), ForeignKey("synthesis_runs.id"), nullable=True)
    synthesis_model = Column(String(100), nullable=True)
    synthesis_confidence = Column(Integer, nullable=True)
    merged_into_id = Column(UUID(as_uuid=True), ForeignKey("feature_requests.id"), nullable=True)

    human_edited = Column(Boolean, nullable=False, default=False)
    human_edited_fields = Column(JSONB, default=list)
    human_notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    signal_links = relationship(
        "FeatureRequestSignal",
        back_populates="feature_request",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_fr_org", "organization_id"),
        Index("idx_fr_status", "organization_id", "status"),
        Index("idx_fr_priority", "organization_id", "priority_score"),
        Index("idx_fr_synthesis_run", "synthesis_run_id"),
    )


class FeatureRequestSignal(Base):
    __tablename__ = "feature_request_signals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("feature_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    signal_id = Column(
        UUID(as_uuid=True),
        ForeignKey("signals.id", ondelete="CASCADE"),
        nullable=False,
    )
    relevance_score = Column(Integer, nullable=True)
    representative_quote = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    feature_request = relationship("FeatureRequest", back_populates="signal_links")

    __table_args__ = (
        Index("idx_frs_feature_request", "feature_request_id"),
        Index("idx_frs_signal", "signal_id"),
        Index("idx_frs_unique_pair", "feature_request_id", "signal_id", unique=True),
    )


class SynthesisRun(Base):
    __tablename__ = "synthesis_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    signal_count = Column(Integer, nullable=False, default=0)
    cluster_count = Column(Integer, default=0)
    feature_request_count = Column(Integer, default=0)
    feature_request_ids = Column(JSONB, default=list)
    model = Column(String(100), nullable=True)
    error = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (Index("idx_synth_runs_org", "organization_id"),)
