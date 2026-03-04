"""Chat routes: POST /{id}/chat, GET /{id}/chat."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from stealth_agent.adapters.llm import LLMProvider, create_llm_provider
from stealth_agent.config import settings
from stealth_agent.database import get_db
from stealth_agent.middleware.auth import get_current_org
from stealth_agent.models import AgentConversation, AgentMessage
from stealth_agent.schemas import ApiResponse, ChatMessageIn, ChatMessageOut, ConversationOut
from stealth_agent.services import chat as chat_service

router = APIRouter(prefix="/api/v1/feature-requests", tags=["chat"])


def _get_llm() -> LLMProvider:
    return create_llm_provider(settings.LLM_PROVIDER, settings.ANTHROPIC_API_KEY, settings.OPENAI_API_KEY)


@router.post("/{feature_request_id}/chat", response_model=ApiResponse)
async def send_chat_message(
    feature_request_id: str,
    payload: ChatMessageIn,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    llm = _get_llm()
    try:
        assistant_msg = await chat_service.chat(
            db=db,
            llm=llm,
            feature_request_id=feature_request_id,
            organization_id=org_id,
            user_message=payload.message,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM call failed: {exc}",
        ) from exc

    return ApiResponse(
        data=ChatMessageOut(
            id=str(assistant_msg.id),
            role=assistant_msg.role,
            content=assistant_msg.content,
            created_at=assistant_msg.created_at,
        )
    )


@router.get("/{feature_request_id}/chat", response_model=ApiResponse)
async def get_chat_history(
    feature_request_id: str,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    conversation = await chat_service.get_or_create_conversation(db, feature_request_id, org_id)
    messages = await chat_service.get_conversation_messages(db, conversation.id)

    return ApiResponse(
        data=ConversationOut(
            id=str(conversation.id),
            feature_request_id=feature_request_id,
            messages=[
                ChatMessageOut(
                    id=str(m.id),
                    role=m.role,
                    content=m.content,
                    created_at=m.created_at,
                )
                for m in messages
            ],
            created_at=conversation.created_at,
        )
    )
