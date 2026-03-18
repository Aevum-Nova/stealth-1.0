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
            "scope": "channels:history,channels:read,groups:history,groups:read,im:history,reactions:read,users:read,chat:write,channels:join",
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

    async def list_channels(self) -> list[dict]:
        token = (self.config.credentials or {}).get("access_token")
        if not token:
            return []

        channels: list[dict] = []
        cursor = None

        async with httpx.AsyncClient() as client:
            while True:
                params: dict = {
                    "types": "public_channel,private_channel",
                    "exclude_archived": "true",
                    "limit": "200",
                }
                if cursor:
                    params["cursor"] = cursor

                resp = await client.get(
                    "https://slack.com/api/conversations.list",
                    headers={"Authorization": f"Bearer {token}"},
                    params=params,
                )
                data = resp.json()

                if not data.get("ok"):
                    break

                for ch in data.get("channels", []):
                    channels.append({
                        "id": ch["id"],
                        "name": ch["name"],
                        "is_private": ch.get("is_private", False),
                        "num_members": ch.get("num_members", 0),
                        "topic": (ch.get("topic") or {}).get("value", ""),
                    })

                cursor = data.get("response_metadata", {}).get("next_cursor")
                if not cursor:
                    break

        return channels

    async def join_channels(self, channel_ids: list[str]) -> dict[str, str]:
        token = (self.config.credentials or {}).get("access_token")
        if not token:
            return {}

        results: dict[str, str] = {}
        async with httpx.AsyncClient() as client:
            for channel_id in channel_ids:
                resp = await client.post(
                    "https://slack.com/api/conversations.join",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"channel": channel_id},
                )
                data = resp.json()
                results[channel_id] = "ok" if data.get("ok") else data.get("error", "unknown")

        return results
