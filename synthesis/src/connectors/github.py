from __future__ import annotations

from datetime import datetime
from urllib.parse import urlencode

import httpx

from src.config import settings
from src.connectors.base import BaseConnector, RawIngestionItem

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_BASE = "https://api.github.com"


class GitHubConnector(BaseConnector):
    """GitHub OAuth connector for repository connection and PR creation."""

    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        client_id = settings.GITHUB_CLIENT_ID
        if not client_id:
            return None

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": "repo",
            "state": state,
        }
        return f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"

    async def handle_oauth_callback(self, code: str, redirect_uri: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GITHUB_TOKEN_URL,
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            data = response.json()

        access_token = data.get("access_token")
        if not access_token:
            return {}

        return {
            "access_token": access_token,
            "token_type": data.get("token_type", "bearer"),
            "scope": data.get("scope", ""),
        }

    async def validate_credentials(self) -> bool:
        token = (self.config.credentials or {}).get("access_token")
        if not token:
            return False

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                },
            )
            return response.status_code == 200

    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        # GitHub is a PR target, not a signal source
        return []

    async def list_repos(self) -> list[dict]:
        """List repositories accessible to the authenticated user."""
        token = (self.config.credentials or {}).get("access_token")
        if not token:
            return []

        repos: list[dict] = []
        page = 1

        async with httpx.AsyncClient() as client:
            while True:
                response = await client.get(
                    f"{GITHUB_API_BASE}/user/repos",
                    params={
                        "sort": "updated",
                        "direction": "desc",
                        "per_page": 100,
                        "page": page,
                        "type": "owner",
                    },
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github+json",
                    },
                )
                response.raise_for_status()
                data = response.json()
                if not data:
                    break

                for repo in data:
                    if repo.get("archived"):
                        continue
                    repos.append({
                        "full_name": repo["full_name"],
                        "default_branch": repo.get("default_branch", "main"),
                        "private": repo.get("private", False),
                        "description": repo.get("description") or "",
                    })

                if len(data) < 100:
                    break
                page += 1

        return repos

    async def list_branches(self, repo: str) -> list[str]:
        """List branches for a given repository."""
        token = (self.config.credentials or {}).get("access_token")
        if not token:
            return []

        branches: list[str] = []

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{repo}/branches",
                params={"per_page": 100},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                },
            )
            response.raise_for_status()
            data = response.json()
            branches = [branch["name"] for branch in data]

        return branches
