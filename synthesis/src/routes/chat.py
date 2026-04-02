from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from dataclasses import asdict, dataclass
from typing import Any

import anthropic
import structlog
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import async_session
from src.middleware.auth import get_org_and_agent_token
from src.models.chat import ChatConversation, ChatMessage
from src.schemas.chat import ChatQueryRequest
from src.services.chat_tools import MAX_TOOL_ROUNDS, PlatformToolExecutor, TOOL_SCHEMAS

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])
log = structlog.get_logger(__name__)


@dataclass
class StreamEvent:
    type: str
    name: str | None = None
    content: str = ""
    input: dict[str, Any] | None = None
    tool_use_id: str | None = None


SYSTEM_PROMPT = """You are a product analytics assistant. The user is asking questions about their platform data.

You have access to tools that let you query:
- Triggers: what data capture rules are configured
- Feature requests: list with filters; compare_feature_requests_code for PR/code stats across many ids in one call; get_feature_request_detail for one id (full spec + evidence + agent)
- Signal stats: raw customer feedback metrics
- Connectors: data source integrations
- Dashboard stats: overview metrics

When comparing code change size, PR scope, or ranking multiple feature requests, call compare_feature_requests_code once with all relevant UUIDs from get_feature_requests — never call get_feature_request_detail separately for each id for that purpose.

Use these tools to gather the data needed to answer the user's question. Be specific and actionable in your responses. When showing data, summarize key insights rather than dumping raw JSON.

Guidelines:
- Answer directly and concisely
- Highlight actionable insights
- When data is sparse or missing, acknowledge it honestly
- Suggest follow-up questions when relevant
"""


async def chat_query_stream(
    org_id: str,
    message: str,
    conversation_id: str | None = None,
    agent_bearer_token: str | None = None,
) -> AsyncIterator[StreamEvent]:
    async with async_session() as db:
        conversation = await _get_or_create_conversation(db, org_id, conversation_id)

        user_msg = ChatMessage(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            role="user",
            content=message,
        )
        db.add(user_msg)
        await db.flush()

        messages_for_llm = await _get_conversation_messages(db, conversation.id)
        llm_messages = [{"role": m.role, "content": m.content} for m in messages_for_llm]

        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY or "")

        tool_executor = PlatformToolExecutor(db, org_id, agent_bearer_token=agent_bearer_token)

        all_text_parts: list[str] = []
        assistant_msg_id = str(uuid.uuid4())

        try:
            for round_num in range(MAX_TOOL_ROUNDS):
                log.info("chat_tool_round", round=round_num, conversation_id=str(conversation.id))

                tool_calls_this_round: list[dict] = []

                async with client.messages.stream(
                    model=settings.ANTHROPIC_SYNTHESIS_MODEL,
                    max_tokens=4096,
                    system=[
                        {
                            "type": "text",
                            "text": SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    messages=llm_messages,
                    tools=TOOL_SCHEMAS,
                ) as stream:
                    async for event in stream:
                        if event.type == "content_block_delta":
                            delta = event.delta
                            if getattr(delta, "type", "") == "text_delta":
                                chunk = delta.text
                                all_text_parts.append(chunk)
                                yield StreamEvent(type="token", content=chunk)

                response = await stream.get_final_message()

                content_blocks = list(response.content)
                has_tool_use = any(getattr(b, "type", "") == "tool_use" for b in content_blocks)

                if not has_tool_use:
                    break

                llm_messages.append(
                    {
                        "role": "assistant",
                        "content": [
                            {
                                "type": getattr(b, "type", "text"),
                                **(
                                    {"text": b.text}
                                    if getattr(b, "type", "") == "text"
                                    else {
                                        "id": b.id,
                                        "name": b.name,
                                        "input": b.input,
                                    }
                                ),
                            }
                            for b in content_blocks
                        ],
                    }
                )

                for block in content_blocks:
                    if getattr(block, "type", "") == "tool_use":
                        tool_name = block.name
                        tool_input = block.input
                        tool_id = block.id

                        tool_calls_this_round.append(
                            {
                                "id": tool_id,
                                "name": tool_name,
                                "input": tool_input,
                            }
                        )

                        yield StreamEvent(
                            type="tool_call",
                            name=tool_name,
                            input=tool_input,
                            tool_use_id=tool_id,
                        )

                        status_msg = tool_executor.status_message(tool_name, tool_input)
                        yield StreamEvent(type="status", content=status_msg)

                        result_text = await tool_executor.execute(tool_name, tool_input)

                        yield StreamEvent(
                            type="tool_result",
                            name=tool_name,
                            content=result_text,
                            tool_use_id=tool_id,
                        )

                        llm_messages.append(
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "tool_result",
                                        "tool_use_id": tool_id,
                                        "content": result_text,
                                    }
                                ],
                            }
                        )

            response_text = "".join(all_text_parts)

            assistant_msg = ChatMessage(
                id=uuid.UUID(assistant_msg_id),
                conversation_id=conversation.id,
                role="assistant",
                content=response_text,
                tool_calls=tool_calls_this_round if tool_calls_this_round else None,
            )
            db.add(assistant_msg)
            await db.commit()

            conversation.updated_at = func.now()
            await db.commit()

        finally:
            await client.close()

        yield StreamEvent(
            type="done",
            content="",
        )


async def _get_or_create_conversation(
    db: Any,
    org_id: str,
    conversation_id: str | None,
) -> ChatConversation:
    if conversation_id:
        try:
            result = await db.execute(
                select(ChatConversation).where(
                    ChatConversation.id == uuid.UUID(conversation_id),
                    ChatConversation.organization_id == uuid.UUID(org_id),
                )
            )
            conv = result.scalar_one_or_none()
            if conv:
                return conv
        except (ValueError, Exception):
            pass

    conv = ChatConversation(
        id=uuid.uuid4(),
        organization_id=uuid.UUID(org_id),
    )
    db.add(conv)
    await db.flush()
    return conv


async def _get_conversation_messages(
    db: Any,
    conversation_id: uuid.UUID,
) -> list[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at)
    )
    return list(result.scalars().all())


@router.post("/query")
async def chat_query(
    body: ChatQueryRequest,
    auth: tuple[str, str | None] = Depends(get_org_and_agent_token),
) -> StreamingResponse:
    org_id, agent_token = auth

    async def event_generator():
        try:
            async for event in chat_query_stream(
                org_id=org_id,
                message=body.message,
                conversation_id=body.conversation_id,
                agent_bearer_token=agent_token,
            ):
                yield f"data: {json.dumps(asdict(event), default=str)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            log.error("chat_query_error", error=str(exc))
            yield f'data: {{"type": "error", "content": "{str(exc)}"}}\n\n'

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
