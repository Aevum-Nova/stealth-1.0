"""LLM provider abstraction with Claude and OpenAI implementations."""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from typing import Protocol

import structlog

log = structlog.get_logger()


class LLMProvider(Protocol):
    async def complete(
        self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384
    ) -> str:
        """Send messages to an LLM and return the assistant response text."""
        ...

    async def stream(
        self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384
    ) -> AsyncIterator[str]:
        """Stream response tokens from an LLM."""
        ...


class ClaudeLLMProvider:
    def __init__(
        self,
        api_key: str,
        model: str = "claude-opus-4-6",
        *,
        fast_mode: bool = False,
        fast_mode_beta: str = "fast-mode-2026-02-01",
    ) -> None:
        from anthropic import AsyncAnthropic

        self._client = AsyncAnthropic(api_key=api_key)
        self._model = model
        self._fast_mode = fast_mode
        self._fast_mode_beta = fast_mode_beta

    async def complete(
        self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384
    ) -> str:
        if self._fast_mode and self._supports_fast_mode():
            try:
                return await self._complete_fast(system, messages, max_tokens)
            except Exception as exc:
                log.warning(
                    "anthropic_fast_mode_failed",
                    model=self._model,
                    beta=self._fast_mode_beta,
                    error=str(exc),
                )
        return await self._complete_standard(system, messages, max_tokens)

    async def stream(
        self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384
    ) -> AsyncIterator[str]:
        async with self._client.messages.stream(
            model=self._model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def complete_with_tools(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        max_tokens: int = 16384,
    ) -> object:
        """Call LLM with tool definitions. Returns the raw Anthropic Message
        so callers can inspect stop_reason and tool_use blocks."""
        started_at = time.perf_counter()
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=self._cacheable_system(system),
            messages=messages,
            tools=tools,
        )
        self._log_response(
            response,
            mode="tool_use",
            max_tokens=max_tokens,
            duration_ms=(time.perf_counter() - started_at) * 1000,
        )
        return response

    async def stream_with_tools(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        max_tokens: int = 16384,
    ) -> AsyncIterator[dict]:
        """Stream LLM response with tool definitions.

        Yields dicts:
          {"type": "text_delta", "text": "..."} — incremental text
          {"type": "tool_use",   "id": "...", "name": "...", "input": {...}} — tool call
          {"type": "message_done", "stop_reason": "...", "response": <Message>} — end
        """
        started_at = time.perf_counter()
        async with self._client.messages.stream(
            model=self._model,
            max_tokens=max_tokens,
            system=self._cacheable_system(system),
            messages=messages,
            tools=tools,
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    delta = event.delta
                    if getattr(delta, "type", "") == "text_delta":
                        yield {"type": "text_delta", "text": delta.text}

            response = await stream.get_final_message()

        self._log_response(
            response,
            mode="stream_tool_use",
            max_tokens=max_tokens,
            duration_ms=(time.perf_counter() - started_at) * 1000,
        )

        # Yield any tool_use blocks from the final message
        for block in response.content:
            if getattr(block, "type", "") == "tool_use":
                yield {
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                }

        yield {
            "type": "message_done",
            "stop_reason": response.stop_reason,
            "response": response,
        }

    @staticmethod
    def _cacheable_system(system: str) -> list[dict]:
        return [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]

    async def _complete_standard(
        self,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int,
    ) -> str:
        started_at = time.perf_counter()
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=self._cacheable_system(system),
            messages=messages,
        )
        self._log_response(
            response,
            mode="standard",
            max_tokens=max_tokens,
            duration_ms=(time.perf_counter() - started_at) * 1000,
        )
        return self._response_text(response)

    async def _complete_fast(
        self,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int,
    ) -> str:
        started_at = time.perf_counter()
        response = await self._client.beta.messages.create(
            betas=[self._fast_mode_beta],
            model=self._model,
            max_tokens=max_tokens,
            speed="fast",
            system=self._cacheable_system(system),
            messages=messages,
        )
        self._log_response(
            response,
            mode="fast",
            max_tokens=max_tokens,
            duration_ms=(time.perf_counter() - started_at) * 1000,
        )
        return self._response_text(response)

    def _supports_fast_mode(self) -> bool:
        return "claude-opus-4-6" in self._model

    def _log_response(
        self, response: object, *, mode: str, max_tokens: int, duration_ms: float
    ) -> None:
        usage = getattr(response, "usage", None)
        log.info(
            "anthropic_agent_request_complete",
            mode=mode,
            model=self._model,
            max_tokens=max_tokens,
            duration_ms=round(duration_ms, 2),
            stop_reason=getattr(response, "stop_reason", None),
            input_tokens=getattr(usage, "input_tokens", None),
            output_tokens=getattr(usage, "output_tokens", None),
            cache_read_input_tokens=getattr(usage, "cache_read_input_tokens", None),
            cache_creation_input_tokens=getattr(
                usage, "cache_creation_input_tokens", None
            ),
        )

    @staticmethod
    def _response_text(response: object) -> str:
        content = getattr(response, "content", [])
        return "".join(
            block.text for block in content if getattr(block, "type", "") == "text"
        )


class OpenAILLMProvider:
    def __init__(self, api_key: str, model: str = "gpt-4o") -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model

    async def complete(
        self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384
    ) -> str:
        all_messages = [{"role": "system", "content": system}, *messages]
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=all_messages,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    async def stream(
        self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384
    ) -> AsyncIterator[str]:
        all_messages = [{"role": "system", "content": system}, *messages]
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=all_messages,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield delta.content


def create_llm_provider(
    provider: str,
    anthropic_key: str,
    openai_key: str,
    anthropic_model: str = "claude-opus-4-6",
    *,
    fast_mode: bool = False,
    fast_mode_beta: str = "fast-mode-2026-02-01",
) -> LLMProvider:
    if provider == "openai":
        return OpenAILLMProvider(api_key=openai_key)
    return ClaudeLLMProvider(
        api_key=anthropic_key,
        model=anthropic_model,
        fast_mode=fast_mode,
        fast_mode_beta=fast_mode_beta,
    )
