import pytest

from src.processors.text import TextProcessor


@pytest.mark.asyncio
async def test_text_processor_short_text_skips_llm(monkeypatch):
    processor = TextProcessor()

    async def fake_embed(_text: str):
        return [0.1] * 1536

    monkeypatch.setattr("src.processors.text.embedding_service.embed", fake_embed)

    result = await processor.process("short text")

    assert result["structured_summary"] == "short text"
    assert result["sentiment"] == "neutral"
    assert len(result["embedding"]) == 1536


@pytest.mark.asyncio
async def test_text_processor_normalizes_llm_output(monkeypatch):
    processor = TextProcessor()

    async def fake_json_completion(_system: str, _user: str, max_tokens: int = 2000, schema: dict[str, object] | None = None):
        _ = max_tokens, schema
        return {
            "structured_summary": "  Login flow keeps timing out  ",
            "entities": [
                {"type": "feature", "value": "SSO", "confidence": 1.2},
                {"type": "customer", "value": "CampusQuest"},
                {"foo": "bar"},
                "invalid",
            ],
            "sentiment": "very negative",
            "urgency": "urgent",
        }

    async def fake_embed(_text: str):
        return [0.1] * 1536

    monkeypatch.setattr("src.processors.text.llm_service.json_completion", fake_json_completion)
    monkeypatch.setattr("src.processors.text.embedding_service.embed", fake_embed)

    result = await processor.process("x" * 120)

    assert result["structured_summary"] == "Login flow keeps timing out"
    assert result["entities"] == [
        {"type": "feature", "value": "SSO", "confidence": 1.0},
        {"type": "customer", "value": "CampusQuest", "confidence": 0.7},
    ]
    assert result["sentiment"] == "neutral"
    assert result["urgency"] == "low"
