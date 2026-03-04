"""Chat service — manages conversations with LLM context from feature requests."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from stealth_agent.adapters.llm import LLMProvider
from stealth_agent.mappers import feature_request_from_row
from stealth_agent.models import AgentConversation, AgentMessage, FeatureRequestRow


async def get_or_create_conversation(
    db: AsyncSession,
    feature_request_id: str,
    organization_id: str,
) -> AgentConversation:
    fr_uuid = uuid.UUID(feature_request_id)
    org_uuid = uuid.UUID(organization_id)

    result = await db.execute(
        select(AgentConversation).where(
            AgentConversation.feature_request_id == fr_uuid,
            AgentConversation.organization_id == org_uuid,
        )
    )
    conversation = result.scalar_one_or_none()
    if conversation:
        return conversation

    conversation = AgentConversation(
        id=uuid.uuid4(),
        feature_request_id=fr_uuid,
        organization_id=org_uuid,
    )
    db.add(conversation)
    await db.flush()
    return conversation


async def get_conversation_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> list[AgentMessage]:
    result = await db.execute(
        select(AgentMessage)
        .where(AgentMessage.conversation_id == conversation_id)
        .order_by(AgentMessage.created_at)
    )
    return list(result.scalars().all())


async def chat(
    db: AsyncSession,
    llm: LLMProvider,
    feature_request_id: str,
    organization_id: str,
    user_message: str,
) -> AgentMessage:
    # Load feature request for context
    fr_result = await db.execute(
        select(FeatureRequestRow).where(
            FeatureRequestRow.id == uuid.UUID(feature_request_id),
            FeatureRequestRow.organization_id == uuid.UUID(organization_id),
        )
    )
    fr_row = fr_result.scalar_one_or_none()

    # Build system context
    if fr_row:
        domain_fr = feature_request_from_row(fr_row)
        evidence_text = "\n".join(
            f"- [{e.source_type.value}] {e.snippet}" for e in domain_fr.evidence
        )
        system = (
            f"You are a product engineering assistant. You are helping with the following feature request:\n\n"
            f"Title: {domain_fr.title}\n"
            f"Problem: {domain_fr.problem_statement}\n"
            f"Business context: {domain_fr.business_context}\n"
            f"Evidence:\n{evidence_text}\n\n"
            "Help the user reason about implementation, prioritization, and technical planning."
        )
    else:
        system = "You are a product engineering assistant."

    # Get or create conversation
    conversation = await get_or_create_conversation(db, feature_request_id, organization_id)

    # Save user message
    user_msg = AgentMessage(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        role="user",
        content=user_message,
    )
    db.add(user_msg)
    await db.flush()

    # Build message history for LLM
    all_messages = await get_conversation_messages(db, conversation.id)
    llm_messages = [{"role": m.role, "content": m.content} for m in all_messages if m.role != "system"]

    # Call LLM
    response_text = await llm.complete(system, llm_messages)

    # Save assistant response
    assistant_msg = AgentMessage(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        role="assistant",
        content=response_text,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return assistant_msg
