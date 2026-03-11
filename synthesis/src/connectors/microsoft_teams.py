from __future__ import annotations

from datetime import datetime
from urllib.parse import urlencode

from src.config import settings
from src.connectors.base import BaseConnector, RawIngestionItem


class MicrosoftTeamsConnector(BaseConnector):
    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        return []

    async def validate_credentials(self) -> bool:
        return bool((self.config.credentials or {}).get("access_token"))

    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        client_id = settings.MICROSOFT_CLIENT_ID
        if not client_id:
            return None
        tenant = settings.MICROSOFT_TENANT_ID or "common"
        params = {
            "client_id": client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "response_mode": "query",
            "scope": "offline_access User.Read Team.ReadBasic.All Channel.ReadBasic.All Chat.Read ChannelMessage.Read.All",
            "state": state,
        }
        return f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?{urlencode(params)}"

    async def handle_oauth_callback(self, code: str, redirect_uri: str) -> dict:
        return {
            "access_token": code,
            "refresh_token": f"refresh-{code}",
            "redirect_uri": redirect_uri,
            "scopes": [
                "offline_access",
                "User.Read",
                "Team.ReadBasic.All",
                "Channel.ReadBasic.All",
                "Chat.Read",
                "ChannelMessage.Read.All",
            ],
        }
