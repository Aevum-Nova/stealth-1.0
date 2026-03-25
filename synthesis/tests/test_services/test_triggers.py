from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from src.models.connector import Connector
from src.models.trigger import EventBuffer, Trigger
from src.services.triggers import trigger_service
from src.triggers.adapters.slack import SlackTriggerAdapter
from src.triggers.adapters.base import NormalizedTriggerEvent


def test_parse_description_extracts_keywords() -> None:
    parsed = trigger_service.parse_description("bug reports from customers in #product-feedback about onboarding")

    assert "onboarding" in parsed["keyword_hints"]
    assert "product-feedback" in parsed["keyword_hints"]


def test_slack_scope_summary_uses_connector_scope_labels() -> None:
    connector = Connector(
        id=uuid4(),
        organization_id=uuid4(),
        type="slack",
        name="Slack",
        config={"channel_ids": ["product-feedback", "support"]},
        credentials={"access_token": "token"},
    )
    adapter = SlackTriggerAdapter()

    summary = adapter.summarize_scope({"channel_id": ["product-feedback"]}, connector)

    assert summary == "Slack channels: #product-feedback"


def test_buffer_is_due_when_count_threshold_and_minimum_window_met() -> None:
    trigger = Trigger(
        id=uuid4(),
        organization_id=uuid4(),
        connector_id=uuid4(),
        plugin_type="slack",
        natural_language_description="bugs from support",
        scope_summary="All activity",
        buffer_config={"time_threshold_minutes": 60, "count_threshold": 3, "min_buffer_minutes": 5},
        match_config={"confidence_threshold": 0.7},
        status="active",
    )
    buffer = EventBuffer(
        id=uuid4(),
        organization_id=uuid4(),
        trigger_id=trigger.id,
        event_ids=["a", "b", "c"],
        signal_ids=["a", "b", "c"],
        event_count=3,
        status="open",
        buffer_started_at=datetime.now(UTC) - timedelta(minutes=6),
    )

    assert trigger_service._buffer_is_due(buffer, trigger, datetime.now(UTC)) is True


@pytest.mark.asyncio
async def test_semantic_match_hard_rejects_excluded_ui_feedback(monkeypatch) -> None:
    async def _never_call_llm(*args, **kwargs):
        raise AssertionError("LLM should not be called during event-time matching.")

    monkeypatch.setattr("src.services.triggers.llm_service.json_completion", _never_call_llm)

    trigger = Trigger(
        id=uuid4(),
        organization_id=uuid4(),
        connector_id=uuid4(),
        plugin_type="slack",
        natural_language_description=(
            "Capture feature requests only. Do not include UI feedback, landing page changes, "
            "or color scheme updates."
        ),
        parsed_filter_criteria={
            "semantic_version": 2,
            "primary_intent": "Capture feature requests only.",
            "include_terms": ["feature", "request"],
            "exclude_terms": ["ui", "landing", "page", "color", "scheme"],
            "include_phrases": ["feature requests"],
            "exclude_phrases": ["ui feedback", "landing page", "color scheme"],
            "include_embedding": [1.0, 0.0],
            "exclude_embedding": [0.0, 1.0],
            "keyword_hints": ["feature", "request", "ui", "landing", "page", "color", "scheme"],
            "summary_for_embedding": "Capture feature requests only.",
            "exclude_summary_for_embedding": "Exclude UI feedback, landing page changes, and color scheme updates.",
        },
        scope_summary="All activity",
        status="active",
    )
    event = NormalizedTriggerEvent(
        external_id="event-1",
        occurred_at=datetime.now(UTC),
        content_type="message",
        content_text="Can you change the landing page color from black to yellow?",
    )

    score = await trigger_service.semantic_match(trigger, event, event_embedding=[0.1, 0.99])

    assert score <= 0.15


@pytest.mark.asyncio
async def test_compile_filter_criteria_prefers_llm_output(monkeypatch) -> None:
    async def _fake_llm(*args, **kwargs):
        return {
            "primary_intent": "Capture feature and functionality requests.",
            "include_topics": ["feature requests", "functionality requests"],
            "exclude_topics": ["ui feedback", "landing page changes", "color scheme changes"],
            "keyword_hints": ["feature", "functionality", "ui", "landing", "color"],
            "include_phrases": ["add support for", "should let users"],
            "exclude_phrases": ["landing page", "color scheme"],
            "include_terms": ["feature", "functionality", "support"],
            "exclude_terms": ["ui", "landing", "color"],
            "summary_for_embedding": "Capture requests for product capabilities and functionality.",
            "exclude_summary_for_embedding": "Exclude UI styling, landing page, and color feedback.",
        }

    async def _fake_embed(text: str) -> list[float]:
        if "Exclude UI styling" in text:
            return [0.0, 1.0]
        return [1.0, 0.0]

    monkeypatch.setattr("src.services.triggers.llm_service.json_completion", _fake_llm)
    monkeypatch.setattr("src.services.triggers.embedding_service.embed", _fake_embed)

    compiled = await trigger_service._compile_filter_criteria(
        "Capture functionality requests only. Do not include UI feedback like landing page or color changes."
    )

    assert compiled["semantic_version"] == 2
    assert compiled["primary_intent"] == "Capture feature and functionality requests."
    assert "feature requests" in compiled["include_phrases"]
    assert "ui feedback" in compiled["exclude_phrases"]
    assert compiled["include_embedding"] == [1.0, 0.0]
    assert compiled["exclude_embedding"] == [0.0, 1.0]


@pytest.mark.asyncio
async def test_compile_filter_criteria_falls_back_without_valid_llm_output(monkeypatch) -> None:
    async def _bad_llm(*args, **kwargs):
        return {"structured_summary": "not the schema we asked for"}

    async def _fake_embed(text: str) -> list[float]:
        return [0.5, 0.5]

    monkeypatch.setattr("src.services.triggers.llm_service.json_completion", _bad_llm)
    monkeypatch.setattr("src.services.triggers.embedding_service.embed", _fake_embed)

    compiled = await trigger_service._compile_filter_criteria(
        "bug reports from customers in #product-feedback about onboarding"
    )

    assert compiled["semantic_version"] == 2
    assert "onboarding" in compiled["keyword_hints"]
    assert "product-feedback" in compiled["keyword_hints"]
