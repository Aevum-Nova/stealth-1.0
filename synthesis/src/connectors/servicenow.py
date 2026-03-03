from __future__ import annotations

from datetime import datetime

from src.connectors.base import BaseConnector, RawIngestionItem


class ServiceNowConnector(BaseConnector):
    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        return []

    async def validate_credentials(self) -> bool:
        return True

    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        return None

    async def handle_oauth_callback(self, code: str, redirect_uri: str) -> dict:
        return {"access_token": code, "redirect_uri": redirect_uri}
