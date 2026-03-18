from __future__ import annotations

from datetime import datetime
from urllib.parse import urlencode

import httpx

from src.config import settings
from src.connectors.base import BaseConnector, RawIngestionItem


class SlackConnector(BaseConnector):
    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        token = (self.config.credentials or {}).get("access_token")
        channel_ids = (self.config.config or {}).get("channel_ids", [])
        if not token:
            raise ValueError("No Slack access token. Reconnect Slack to fix this.")
        if not channel_ids:
            raise ValueError("No Slack channels selected. Open the connector and select channels to ingest.")

        items: list[RawIngestionItem] = []
        channel_errors: dict[str, str] = {}
        params: dict = {"limit": "100"}
        if since:
            params["oldest"] = str(since.timestamp())

        async with httpx.AsyncClient() as client:
            for channel_id in channel_ids:
                resp = await client.get(
                    "https://slack.com/api/conversations.history",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"channel": channel_id, **params},
                )
                data = resp.json()
                if not data.get("ok"):
                    channel_errors[channel_id] = data.get("error", "unknown")
                    continue

                for msg in data.get("messages", []):
                    if msg.get("subtype"):
                        continue
                    text = msg.get("text", "").strip()
                    if not text:
                        continue
                    items.append(
                        RawIngestionItem(
                            external_id=msg.get("client_msg_id") or msg.get("ts", ""),
                            data_type="text",
                            content=text,
                            mime_type="text/plain",
                            metadata={
                                "channel_id": channel_id,
                                "user": msg.get("user"),
                                "ts": msg.get("ts"),
                                "source": "slack",
                            },
                        )
                    )

        if not items and channel_errors:
            errors_str = "; ".join(f"{ch}: {err}" for ch, err in channel_errors.items())
            raise ValueError(f"Slack API errors — {errors_str}")

        return items

    async def validate_credentials(self) -> bool:
        return bool((self.config.credentials or {}).get("access_token"))

    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        if not settings.SLACK_CLIENT_ID:
            return None
        params = {
            "client_id": settings.SLACK_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "scope": "channels:history,channels:read,groups:history,groups:read,im:history,reactions:read,reactions:write,users:read,chat:write,channels:join",
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

    async def acknowledge_message(self, channel_id: str, ts: str) -> None:
        """React to a message and post a brief thread reply to confirm ingestion."""
        token = (self.config.credentials or {}).get("access_token")
        if not token:
            return

        async with httpx.AsyncClient() as client:
            # Add ✅ reaction
            await client.post(
                "https://slack.com/api/reactions.add",
                headers={"Authorization": f"Bearer {token}"},
                json={"channel": channel_id, "timestamp": ts, "name": "white_check_mark"},
            )
            # Thread reply
            await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "channel": channel_id,
                    "thread_ts": ts,
                    "text": "Signal captured and processing.",
                },
            )

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
