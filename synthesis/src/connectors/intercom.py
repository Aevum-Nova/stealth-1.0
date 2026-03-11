from __future__ import annotations

from datetime import datetime
from urllib.parse import urlencode

from src.config import settings
from src.connectors.base import BaseConnector, RawIngestionItem


class IntercomConnector(BaseConnector):
    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        return []

    async def validate_credentials(self) -> bool:
        return bool((self.config.credentials or {}).get("access_token"))

    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        if not settings.INTERCOM_CLIENT_ID:
            return None
        params = {
            "client_id": settings.INTERCOM_CLIENT_ID,
            "state": state,
            "redirect_uri": redirect_uri,
        }
        return f"https://app.intercom.com/oauth?{urlencode(params)}"

    async def handle_oauth_callback(self, code: str, redirect_uri: str) -> dict:
        return {
            "access_token": code,
            "redirect_uri": redirect_uri,
            "scopes": ["read_conversations", "read_contacts", "read_tags"],
        }
