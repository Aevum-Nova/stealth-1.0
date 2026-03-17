from datetime import UTC, datetime, timedelta
from uuid import uuid4

from src.models.connector import Connector
from src.models.trigger import EventBuffer, Trigger
from src.services.triggers import trigger_service
from src.triggers.adapters.slack import SlackTriggerAdapter


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
