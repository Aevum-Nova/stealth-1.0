from __future__ import annotations

from datetime import datetime
from urllib.parse import urlencode

import httpx

from src.connectors.base import BaseConnector, RawIngestionItem

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_FORMS_SCOPES = "https://www.googleapis.com/auth/forms.responses.readonly"


class GoogleFormsConnector(BaseConnector):
    """Google Forms connector using user-provided OAuth credentials."""

    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        client_id = (self.config.credentials or {}).get("client_id")
        if not client_id:
            return None

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": GOOGLE_FORMS_SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{GOOGLE_AUTHORIZE_URL}?{urlencode(params)}"

    async def handle_oauth_callback(self, code: str, redirect_uri: str) -> dict:
        client_id = (self.config.credentials or {}).get("client_id")
        client_secret = (self.config.credentials or {}).get("client_secret")

        if not client_id or not client_secret:
            return {}

        async with httpx.AsyncClient() as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            response.raise_for_status()
            data = response.json()

        access_token = data.get("access_token")
        if not access_token:
            return {}

        return {
            "client_id": client_id,
            "client_secret": client_secret,
            "access_token": access_token,
            "refresh_token": data.get("refresh_token"),
            "token_type": data.get("token_type", "Bearer"),
        }

    async def validate_credentials(self) -> bool:
        token = (self.config.credentials or {}).get("access_token")
        return bool(token)

    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        return []
