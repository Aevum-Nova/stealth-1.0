import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from src.database import Base


class Connector(Base):
    __tablename__ = "connectors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    type = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    auto_synthesize = Column(Boolean, nullable=False, default=True)
    config = Column(JSONB, default=dict)
    credentials = Column(JSONB, default=dict)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
