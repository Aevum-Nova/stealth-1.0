"""LLM provider abstraction with Claude and OpenAI implementations."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol

import structlog

log = structlog.get_logger()


class LLMProvider(Protocol):
    async def complete(self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384) -> str:
        """Send messages to an LLM and return the assistant response text."""
        ...

    async def stream(self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384) -> AsyncIterator[str]:
        """Stream response tokens from an LLM."""
        ...


class ClaudeLLMProvider:
    def __init__(self, api_key: str, model: str = "claude-opus-4-6") -> None:
        from anthropic import AsyncAnthropic

        self._client = AsyncAnthropic(api_key=api_key)
        self._model = model

    async def complete(self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384) -> str:
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return response.content[0].text

    async def stream(self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384) -> AsyncIterator[str]:
        async with self._client.messages.stream(
            model=self._model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text


class OpenAILLMProvider:
    def __init__(self, api_key: str, model: str = "gpt-4o") -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model

    async def complete(self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384) -> str:
        all_messages = [{"role": "system", "content": system}, *messages]
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=all_messages,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    async def stream(self, system: str, messages: list[dict[str, str]], max_tokens: int = 16384) -> AsyncIterator[str]:
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
) -> LLMProvider:
    if provider == "openai":
        return OpenAILLMProvider(api_key=openai_key)
    return ClaudeLLMProvider(api_key=anthropic_key, model=anthropic_model)
