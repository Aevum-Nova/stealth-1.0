import pytest

from src.routes.connectors import connector_catalog, _missing_required_env_vars


def test_missing_required_env_vars_for_slack(monkeypatch):
    monkeypatch.setattr("src.routes.connectors.settings.SLACK_CLIENT_ID", "")
    monkeypatch.setattr("src.routes.connectors.settings.SLACK_CLIENT_SECRET", "")

    missing = _missing_required_env_vars("slack")

    assert missing == ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"]


def test_missing_required_env_vars_for_granola():
    missing = _missing_required_env_vars("granola")
    assert missing == []


def test_missing_required_env_vars_for_microsoft_teams(monkeypatch):
    monkeypatch.setattr("src.routes.connectors.settings.MICROSOFT_CLIENT_ID", "")
    monkeypatch.setattr("src.routes.connectors.settings.MICROSOFT_CLIENT_SECRET", "")

    missing = _missing_required_env_vars("microsoft_teams")

    assert missing == ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"]


@pytest.mark.asyncio
async def test_connector_catalog_includes_availability(monkeypatch):
    monkeypatch.setattr("src.routes.connectors.settings.SLACK_CLIENT_ID", "")
    monkeypatch.setattr("src.routes.connectors.settings.SLACK_CLIENT_SECRET", "")

    response = await connector_catalog()
    slack_item = next(item for item in response.data if item["type"] == "slack")

    assert slack_item["available"] is False
    assert "SLACK_CLIENT_ID" in slack_item["missing_env_vars"]
