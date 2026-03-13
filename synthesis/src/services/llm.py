from __future__ import annotations

import asyncio
import json
from collections.abc import Mapping

import anthropic

from src.config import settings


class LLMService:
    def __init__(self) -> None:
        self._client: anthropic.AsyncAnthropic | None = None
        if settings.ANTHROPIC_API_KEY:
            self._client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    @staticmethod
    def _default_json_fallback(user: str) -> dict:
        return {
            "structured_summary": user[:400],
            "entities": [],
            "sentiment": "neutral",
            "urgency": "low",
        }

    async def json_completion(
        self,
        system: str,
        user: str,
        max_tokens: int = 2000,
        schema: Mapping[str, object] | None = None,
    ) -> dict:
        if self._client is None:
            return self._default_json_fallback(user)

        attempt_prompt = user
        for attempt in range(2):
            try:
                request: dict[str, object] = {
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": [{"role": "user", "content": attempt_prompt}],
                }
                if schema is not None:
                    request["output_config"] = {
                        "format": {
                            "type": "json_schema",
                            "schema": dict(schema),
                        }
                    }

                message = await asyncio.wait_for(
                    self._client.messages.create(**request),
                    timeout=25,
                )

                text = "".join(
                    block.text for block in message.content if getattr(block, "type", "") == "text"
                )
                parsed = self._parse_json_from_text(text)
                if parsed is not None:
                    return parsed
            except Exception:
                if attempt == 1:
                    break

            if attempt == 0:
                attempt_prompt = f"{user}\n\nYou MUST return valid JSON. No other text."

        return self._default_json_fallback(user)

    @staticmethod
    def _parse_json_from_text(text: str) -> dict | None:
        if not text:
            return None

        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            pass

        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None

        try:
            parsed = json.loads(text[start : end + 1])
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    async def vision_to_text(self, image_bytes: bytes, mime_type: str) -> str:
        if self._client is None:
            return "Extracted Text:\n\nDescription: No LLM configured."

        import base64

        image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
        try:
            message = await asyncio.wait_for(
                self._client.messages.create(
                    model=settings.ANTHROPIC_MODEL,
                    max_tokens=2000,
                    system=(
                        "You are analyzing an image uploaded as customer feedback or product context. "
                        "Return plain text with sections: Extracted Text and Description."
                    ),
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": mime_type,
                                        "data": image_b64,
                                    },
                                },
                                {"type": "text", "text": "Analyze this image."},
                            ],
                        }
                    ],
                ),
                timeout=30,
            )
            return "".join(block.text for block in message.content if getattr(block, "type", "") == "text")
        except Exception:
            return "Extracted Text:\n\nDescription: Timed out while analyzing image."


llm_service = LLMService()
