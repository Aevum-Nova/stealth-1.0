"""Chat routes: POST /{id}/chat, POST /{id}/chat/stream, GET /{id}/chat."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from stealth_agent.adapters.llm import LLMProvider, create_llm_provider
from stealth_agent.config import settings
from stealth_agent.database import get_db
from stealth_agent.middleware.auth import get_current_org
from stealth_agent.schemas import ApiResponse, ChatMessageIn, ChatMessageOut, ConversationOut, ProposedChange, SearchReplace
from stealth_agent.services import chat as chat_service

router = APIRouter(prefix="/api/v1/feature-requests", tags=["chat"])


def _get_llm() -> LLMProvider:
    return create_llm_provider(
        settings.LLM_PROVIDER,
        settings.ANTHROPIC_API_KEY,
        settings.OPENAI_API_KEY,
        settings.ANTHROPIC_MODEL,
    )


def _map_proposed_changes(raw: list[dict] | None) -> list[ProposedChange] | None:
    if not raw:
        return None
    result = []
    for c in raw:
        sr_raw = c.get("search_replace")
        sr = None
        if sr_raw and isinstance(sr_raw, list):
            sr = [
                SearchReplace(search=s.get("search", ""), replace=s.get("replace", ""))
                for s in sr_raw
                if isinstance(s, dict)
            ]
        result.append(ProposedChange(
            file_path=c.get("file_path", ""),
            content=c.get("content", ""),
            reason=c.get("reason", ""),
            search_replace=sr,
        ))
    return result


def _message_out(m) -> ChatMessageOut:
    return ChatMessageOut(
        id=str(m.id),
        role=m.role,
        content=m.content,
        proposed_changes=_map_proposed_changes(m.proposed_changes),
        created_at=m.created_at,
    )


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

    return ApiResponse(data=_message_out(assistant_msg))


@router.post("/{feature_request_id}/chat/stream")
async def stream_chat_message(
    feature_request_id: str,
    payload: ChatMessageIn,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    llm = _get_llm()

    async def event_generator():
        try:
            async for event in chat_service.chat_stream(
                db=db,
                llm=llm,
                feature_request_id=feature_request_id,
                organization_id=org_id,
                user_message=payload.message,
            ):
                data = json.dumps({"type": event.type, "content": event.content})
                yield f"data: {data}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as exc:
            error_data = json.dumps({"type": "error", "content": str(exc)})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{feature_request_id}/summary", response_model=ApiResponse)
async def generate_summary(
    feature_request_id: str,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    llm = _get_llm()
    try:
        summary = await chat_service.generate_summary(
            db=db,
            llm=llm,
            feature_request_id=feature_request_id,
            organization_id=org_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Summary generation failed: {exc}",
        ) from exc

    return ApiResponse(data={"summary": summary})


@router.get("/{feature_request_id}/chat", response_model=ApiResponse)
async def get_chat_history(
    feature_request_id: str,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    conversation = await chat_service.get_or_create_conversation(db, feature_request_id, org_id)
    await db.commit()
    messages = await chat_service.get_conversation_messages(db, conversation.id)

    return ApiResponse(
        data=ConversationOut(
            id=str(conversation.id),
            feature_request_id=feature_request_id,
            messages=[_message_out(m) for m in messages],
            created_at=conversation.created_at,
        )
    )
