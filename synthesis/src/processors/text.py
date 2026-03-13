from __future__ import annotations

from src.config import settings
from src.services.embeddings import embedding_service
from src.services.llm import llm_service

TEXT_ANALYZER_PROMPT = """You are a product signal analyzer. Given raw customer feedback, support data, or product discussion, extract JSON with keys:
structured_summary, entities, sentiment, urgency.
Return valid JSON only."""

TEXT_ANALYZER_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "structured_summary": {"type": "string"},
        "entities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string"},
                    "value": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                "required": ["type", "value", "confidence"],
                "additionalProperties": False,
            },
        },
        "sentiment": {"type": "string", "enum": ["positive", "negative", "neutral", "mixed"]},
        "urgency": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
    },
    "required": ["structured_summary", "entities", "sentiment", "urgency"],
    "additionalProperties": False,
}


class TextProcessor:
    _SENTIMENT_VALUES = {"positive", "negative", "neutral", "mixed"}
    _URGENCY_VALUES = {"low", "medium", "high", "critical"}

    @classmethod
    def _normalize_label(cls, value: str | None, *, allowed: set[str], default: str) -> str:
        normalized = str(value or "").strip().lower()
        if normalized in allowed:
            return normalized
        return default

    @staticmethod
    def _normalize_entities(value: object) -> list[dict]:
        if not isinstance(value, list):
            return []

        entities: list[dict] = []
        for item in value:
            if not isinstance(item, dict):
                continue

            entity_type = str(item.get("type") or "").strip()
            entity_value = str(item.get("value") or "").strip()
            if not entity_type or not entity_value:
                continue

            confidence_raw = item.get("confidence", 0.7)
            try:
                confidence = float(confidence_raw)
            except (TypeError, ValueError):
                confidence = 0.7

            entities.append(
                {
                    "type": entity_type,
                    "value": entity_value,
                    "confidence": max(0.0, min(1.0, confidence)),
                }
            )

        return entities

    async def process(self, raw_text: str) -> dict:
        clean = raw_text.strip()[:100000]
        if len(clean) < 20:
            summary = clean
            entities: list[dict] = []
            sentiment = "neutral"
            urgency = "low"
        else:
            payload = await llm_service.json_completion(
                TEXT_ANALYZER_PROMPT,
                clean,
                max_tokens=600,
                schema=TEXT_ANALYZER_SCHEMA,
                stage="signal_analysis",
                model=settings.ANTHROPIC_SIGNAL_MODEL,
                effort=settings.ANTHROPIC_SIGNAL_EFFORT,
                enable_prompt_cache=settings.ANTHROPIC_ENABLE_PROMPT_CACHING,
                telemetry={"signal_chars": len(clean)},
            )
            summary = str(payload.get("structured_summary") or clean[:500]).strip() or clean[:500]
            entities = self._normalize_entities(payload.get("entities"))
            sentiment = self._normalize_label(
                payload.get("sentiment"),
                allowed=self._SENTIMENT_VALUES,
                default="neutral",
            )
            urgency = self._normalize_label(
                payload.get("urgency"),
                allowed=self._URGENCY_VALUES,
                default="low",
            )

        embedding = await embedding_service.embed(summary)
        return {
            "original_text": clean,
            "structured_summary": summary,
            "entities": entities,
            "sentiment": sentiment,
            "urgency": urgency,
            "embedding": embedding,
        }


text_processor = TextProcessor()
