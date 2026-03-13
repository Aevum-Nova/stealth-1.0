from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Mapping
from typing import Any

import anthropic
import structlog

from src.config import settings

log = structlog.get_logger()


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
        *,
        stage: str = "generic",
        model: str | None = None,
        effort: str | None = None,
        enable_prompt_cache: bool = False,
        telemetry: Mapping[str, object] | None = None,
    ) -> dict:
        if self._client is None:
            return self._default_json_fallback(user)

        selected_model = model or settings.ANTHROPIC_SYNTHESIS_MODEL
        attempt_prompt = user
        for attempt in range(2):
            started_at = time.perf_counter()
            try:
                request: dict[str, Any] = {
                    "model": selected_model,
                    "max_tokens": max_tokens,
                    "system": self._build_system_blocks(system, enable_prompt_cache),
                    "messages": [{"role": "user", "content": attempt_prompt}],
                }
                output_config = self._build_output_config(
                    schema=schema,
                    model=selected_model,
                    effort=effort,
                )
                if output_config:
                    request["output_config"] = output_config

                message = await asyncio.wait_for(
                    self._client.messages.create(**request),
                    timeout=25,
                )

                self._log_telemetry(
                    stage=stage,
                    model=selected_model,
                    effort=output_config.get("effort") if output_config else None,
                    max_tokens=max_tokens,
                    message=message,
                    duration_ms=(time.perf_counter() - started_at) * 1000,
                    attempts=attempt + 1,
                    telemetry=telemetry,
                    prompt_caching=enable_prompt_cache,
                )

                text = "".join(
                    block.text for block in message.content if getattr(block, "type", "") == "text"
                )
                parsed = self._parse_json_from_text(text)
                if parsed is not None:
                    return parsed

                log.warning(
                    "anthropic_json_parse_failed",
                    stage=stage,
                    model=selected_model,
                    attempts=attempt + 1,
                    duration_ms=round((time.perf_counter() - started_at) * 1000, 2),
                    prompt_caching=enable_prompt_cache,
                    **self._safe_telemetry(telemetry),
                )
            except Exception as exc:
                log.warning(
                    "anthropic_request_failed",
                    stage=stage,
                    model=selected_model,
                    effort=output_config.get("effort") if output_config else None,
                    max_tokens=max_tokens,
                    attempts=attempt + 1,
                    duration_ms=round((time.perf_counter() - started_at) * 1000, 2),
                    prompt_caching=enable_prompt_cache,
                    error=str(exc),
                    **self._safe_telemetry(telemetry),
                )
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
        selected_model = settings.ANTHROPIC_SIGNAL_MODEL
        output_config = self._build_output_config(
            schema=None,
            model=selected_model,
            effort=settings.ANTHROPIC_SIGNAL_EFFORT,
        )
        request: dict[str, Any] = {
            "model": selected_model,
            "max_tokens": 1200,
            "system": self._build_system_blocks(
                "You are analyzing an image uploaded as customer feedback or product context. "
                "Return plain text with sections: Extracted Text and Description.",
                settings.ANTHROPIC_ENABLE_PROMPT_CACHING,
            ),
            "messages": [
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
        }
        if output_config:
            request["output_config"] = output_config
        try:
            started_at = time.perf_counter()
            message = await asyncio.wait_for(
                self._client.messages.create(**request),
                timeout=30,
            )
            self._log_telemetry(
                stage="image_signal_analysis",
                model=selected_model,
                effort=output_config.get("effort") if output_config else None,
                max_tokens=1200,
                message=message,
                duration_ms=(time.perf_counter() - started_at) * 1000,
                attempts=1,
                telemetry={"mime_type": mime_type},
                prompt_caching=settings.ANTHROPIC_ENABLE_PROMPT_CACHING,
            )
            return "".join(
                block.text for block in message.content if getattr(block, "type", "") == "text"
            )
        except Exception as exc:
            log.warning(
                "anthropic_request_failed",
                stage="image_signal_analysis",
                model=selected_model,
                effort=output_config.get("effort") if output_config else None,
                max_tokens=1200,
                attempts=1,
                prompt_caching=settings.ANTHROPIC_ENABLE_PROMPT_CACHING,
                mime_type=mime_type,
                error=str(exc),
            )
            return "Extracted Text:\n\nDescription: Timed out while analyzing image."

    @staticmethod
    def _build_system_blocks(
        system: str, enable_prompt_cache: bool
    ) -> str | list[dict[str, object]]:
        if not enable_prompt_cache:
            return system
        return [
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ]

    @staticmethod
    def _supports_effort(model: str) -> bool:
        normalized = model.strip().lower()
        return normalized.startswith("claude-opus-4") or "claude-sonnet-4-6" in normalized

    def _build_output_config(
        self,
        *,
        schema: Mapping[str, object] | None,
        model: str,
        effort: str | None,
    ) -> dict[str, object]:
        output_config: dict[str, object] = {}
        if schema is not None:
            output_config["format"] = {
                "type": "json_schema",
                "schema": dict(schema),
            }
        if effort and self._supports_effort(model):
            output_config["effort"] = effort
        return output_config

    @staticmethod
    def _safe_telemetry(telemetry: Mapping[str, object] | None) -> dict[str, object]:
        if not telemetry:
            return {}
        return {str(key): value for key, value in telemetry.items()}

    def _log_telemetry(
        self,
        *,
        stage: str,
        model: str,
        effort: object,
        max_tokens: int,
        message: object,
        duration_ms: float,
        attempts: int,
        telemetry: Mapping[str, object] | None,
        prompt_caching: bool,
    ) -> None:
        usage = getattr(message, "usage", None)
        log.info(
            "anthropic_request_complete",
            stage=stage,
            model=model,
            effort=effort,
            max_tokens=max_tokens,
            duration_ms=round(duration_ms, 2),
            attempts=attempts,
            stop_reason=getattr(message, "stop_reason", None),
            input_tokens=getattr(usage, "input_tokens", None),
            output_tokens=getattr(usage, "output_tokens", None),
            cache_read_input_tokens=getattr(usage, "cache_read_input_tokens", None),
            cache_creation_input_tokens=getattr(usage, "cache_creation_input_tokens", None),
            prompt_caching=prompt_caching,
            **self._safe_telemetry(telemetry),
        )


llm_service = LLMService()
