"""SQLAlchemy models.

Read-only mirrors of synthesis tables (feature_requests, feature_request_signals).
Agent-owned tables: agent_conversations, agent_messages, agent_jobs.
"""

from __future__ import annotations

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

from stealth_agent.database import Base


# ---------------------------------------------------------------------------
# Read-only mirrors of synthesis tables
# ---------------------------------------------------------------------------


class FeatureRequestRow(Base):
    """Read-only mirror of the synthesis feature_requests table."""

    __tablename__ = "feature_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(String(500), nullable=False)
    type = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="draft")
    priority = Column(String(20), nullable=False)
    priority_score = Column(Integer, nullable=False, default=0)
    problem_statement = Column(Text, nullable=False)
    proposed_solution = Column(Text, nullable=False)
    user_story = Column(Text, nullable=False)
    acceptance_criteria = Column(JSONB, default=list)
    technical_notes = Column(Text, nullable=True)
    affected_product_areas = Column(JSONB, default=list)
    supporting_evidence = Column(JSONB, default=list)
    impact_metrics = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class FeatureRequestSignalRow(Base):
    """Read-only mirror of the synthesis feature_request_signals table."""

    __tablename__ = "feature_request_signals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_request_id = Column(UUID(as_uuid=True), ForeignKey("feature_requests.id"), nullable=False)
    signal_id = Column(UUID(as_uuid=True), nullable=False)
    relevance_score = Column(Integer, nullable=True)
    representative_quote = Column(Text, nullable=True)


class ConnectorRow(Base):
    """Read-only mirror of the synthesis connectors table."""

    __tablename__ = "connectors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    type = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    config = Column(JSONB, default=dict)
    credentials = Column(JSONB, default=dict)


# ---------------------------------------------------------------------------
# Agent-owned tables
# ---------------------------------------------------------------------------


class AgentConversation(Base):
    __tablename__ = "agent_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_request_id = Column(UUID(as_uuid=True), ForeignKey("feature_requests.id"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_agent_conv_fr", "feature_request_id"),
        Index("idx_agent_conv_org", "organization_id"),
    )


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("agent_conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(
        SAEnum("user", "assistant", "system", name="agent_message_role"),
        nullable=False,
    )
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("idx_agent_msg_conv", "conversation_id"),
    )


class AgentJob(Base):
    __tablename__ = "agent_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_request_id = Column(UUID(as_uuid=True), ForeignKey("feature_requests.id"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(
        SAEnum("pending", "running", "completed", "failed", name="agent_job_status"),
        nullable=False,
        default="pending",
    )
    result = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_agent_job_fr", "feature_request_id"),
        Index("idx_agent_job_org", "organization_id"),
    )
