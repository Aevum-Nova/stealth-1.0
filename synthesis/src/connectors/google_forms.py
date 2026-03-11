from __future__ import annotations

from datetime import datetime
from urllib.parse import urlencode

from src.config import settings
from src.connectors.base import BaseConnector, RawIngestionItem


class GoogleFormsConnector(BaseConnector):
    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        return []

    async def validate_credentials(self) -> bool:
        return bool((self.config.credentials or {}).get("access_token"))

    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        if not settings.GOOGLE_CLIENT_ID:
            return None
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join([
                "https://www.googleapis.com/auth/forms.responses.readonly",
                "https://www.googleapis.com/auth/forms.body.readonly",
                "https://www.googleapis.com/auth/drive.readonly",
            ]),
            "access_type": "offline",
            "include_granted_scopes": "true",
            "prompt": "consent",
            "state": state,
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    async def handle_oauth_callback(self, code: str, redirect_uri: str) -> dict:
        return {
            "access_token": code,
            "refresh_token": f"refresh-{code}",
            "redirect_uri": redirect_uri,
            "scopes": [
                "https://www.googleapis.com/auth/forms.responses.readonly",
                "https://www.googleapis.com/auth/forms.body.readonly",
                "https://www.googleapis.com/auth/drive.readonly",
            ],
        }
