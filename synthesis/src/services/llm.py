from __future__ import annotations

import asyncio
import json

import anthropic

from src.config import settings


class LLMService:
    def __init__(self) -> None:
        self._client: anthropic.AsyncAnthropic | None = None
        if settings.ANTHROPIC_API_KEY:
            self._client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def json_completion(self, system: str, user: str, max_tokens: int = 2000) -> dict:
        if self._client is None:
            return {
                "structured_summary": user[:400],
                "entities": [],
                "sentiment": "neutral",
                "urgency": "low",
            }

        attempt_prompt = user
        for attempt in range(2):
            try:
                message = await asyncio.wait_for(
                    self._client.messages.create(
                        model="claude-sonnet-4-20250514",
                        max_tokens=max_tokens,
                        system=system,
                        messages=[{"role": "user", "content": attempt_prompt}],
                    ),
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

        return {
            "structured_summary": user[:400],
            "entities": [],
            "sentiment": "neutral",
            "urgency": "low",
        }

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
                    model="claude-sonnet-4-20250514",
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
