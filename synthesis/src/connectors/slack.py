from __future__ import annotations

from datetime import datetime
from urllib.parse import urlencode

import httpx

from src.config import settings
from src.connectors.base import BaseConnector, RawIngestionItem


class SlackConnector(BaseConnector):
    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        return []

    async def validate_credentials(self) -> bool:
        return bool((self.config.credentials or {}).get("access_token"))

    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        if not settings.SLACK_CLIENT_ID:
            return None
        params = {
            "client_id": settings.SLACK_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "scope": "channels:history,channels:read,groups:history,groups:read,im:history,reactions:read,users:read,chat:write",
            "state": state,
            "user_scope": "",
        }
        return f"https://slack.com/oauth/v2/authorize?{urlencode(params)}"

    async def handle_oauth_callback(self, code: str, redirect_uri: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://slack.com/api/oauth.v2.access",
                data={
                    "client_id": settings.SLACK_CLIENT_ID,
                    "client_secret": settings.SLACK_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
            )
            data = resp.json()

        if not data.get("ok"):
            raise ValueError(f"Slack OAuth failed: {data.get('error', 'unknown error')}")

        return {
            "access_token": data["access_token"],
            "team_id": data.get("team", {}).get("id"),
            "team_name": data.get("team", {}).get("name"),
            "bot_user_id": data.get("bot_user_id"),
            "scopes": (data.get("scope") or "").split(","),
        }
