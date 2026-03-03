import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from src.database import Base


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    connector_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(String(50), nullable=False, default="pending")
    total_items = Column(Integer, default=0)
    processed_items = Column(Integer, default=0)
    failed_items = Column(Integer, default=0)
    signal_ids = Column(JSONB, default=list)
    trigger_synthesis = Column(Boolean, nullable=False, default=False)
    error = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
