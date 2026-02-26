import pytest

from src.connectors.base import ConnectorConfig
from src.connectors.slack import SlackConnector


@pytest.mark.asyncio
async def test_slack_connector_stub_fetches_empty_list():
    connector = SlackConnector(
        ConnectorConfig(
            id="c1",
            organization_id="o1",
            type="slack",
            credentials={},
            config={"channel_ids": ["C123"]},
        )
    )
    rows = await connector.fetch_new_data()
    assert rows == []
