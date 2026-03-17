from __future__ import annotations

from datetime import datetime
from urllib.parse import urlencode

from src.config import settings
from src.connectors.base import BaseConnector, RawIngestionItem


class FigmaConnector(BaseConnector):
    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        return []

    async def validate_credentials(self) -> bool:
        return bool((self.config.credentials or {}).get("access_token"))

    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        if not settings.FIGMA_CLIENT_ID:
            return None
        params = {
            "client_id": settings.FIGMA_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "scope": "file_content:read file_comments:read webhooks:read webhooks:write current_user:read",
            "state": state,
            "response_type": "code",
        }
        return f"https://www.figma.com/oauth?{urlencode(params)}"

    async def handle_oauth_callback(self, code: str, redirect_uri: str) -> dict:
        return {
            "access_token": code,
            "refresh_token": f"refresh-{code}",
            "redirect_uri": redirect_uri,
            "scopes": [
                "file_content:read",
                "file_comments:read",
                "webhooks:read",
                "webhooks:write",
                "current_user:read",
            ],
        }
