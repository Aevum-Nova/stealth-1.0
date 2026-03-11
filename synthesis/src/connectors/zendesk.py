from __future__ import annotations

from datetime import datetime
from urllib.parse import urlencode

from src.connectors.base import BaseConnector, RawIngestionItem


class ZendeskConnector(BaseConnector):
    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        return []

    async def validate_credentials(self) -> bool:
        return bool((self.config.credentials or {}).get("access_token"))

    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        subdomain = str((self.config.config or {}).get("subdomain") or "").strip()
        if not subdomain:
            return None
        params = {
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": "read",
            "state": state,
        }
        return f"https://{subdomain}.zendesk.com/oauth/authorizations/new?{urlencode(params)}"

    async def handle_oauth_callback(self, code: str, redirect_uri: str) -> dict:
        return {"access_token": code, "redirect_uri": redirect_uri, "scope": "read"}
