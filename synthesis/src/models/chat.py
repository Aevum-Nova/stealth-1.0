import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.database import Base


class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    messages = relationship(
        "ChatMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )

    __table_args__ = (Index("idx_chat_conversations_org", "organization_id"),)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    tool_calls = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    conversation = relationship("ChatConversation", back_populates="messages")

    __table_args__ = (
        Index("idx_chat_messages_conversation", "conversation_id"),
        Index("idx_chat_messages_created_at", "created_at"),
    )
