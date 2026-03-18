"""GitHub API adapters for creating branches, commits, and pull requests."""

from __future__ import annotations

import asyncio
import base64
from dataclasses import dataclass, field

import httpx

from stealth_agent.domain.models import CodeChange, PullRequestDraft

GITHUB_API_BASE = "https://api.github.com"


@dataclass
class GitHubGitProvider:
    """Implements GitProvider protocol using the GitHub REST API (async)."""

    token: str
    owner: str
    repo: str
    _last_branch: str = field(default="", init=False, repr=False)
    _client: httpx.AsyncClient | None = field(default=None, init=False, repr=False)

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=f"{GITHUB_API_BASE}/repos/{self.owner}/{self.repo}",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                timeout=30.0,
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def create_branch(self, base_branch: str, branch_name: str) -> None:
        """Create a new branch from base_branch using the GitHub refs API."""
        self._last_branch = branch_name
        client = self._get_client()

        ref_resp = await client.get(f"/git/ref/heads/{base_branch}")
        ref_resp.raise_for_status()
        base_sha = ref_resp.json()["object"]["sha"]

        create_resp = await client.post(
            "/git/refs",
            json={"ref": f"refs/heads/{branch_name}", "sha": base_sha},
        )
        create_resp.raise_for_status()

    async def apply_changes_and_commit(
        self, changes: list[CodeChange], commit_message: str, branch_name: str | None = None
    ) -> str:
        """Create blobs, build a tree, create a commit, and update the branch ref."""
        target_branch = branch_name or self._last_branch
        client = self._get_client()

        if not target_branch:
            repo_resp = await client.get("")
            repo_resp.raise_for_status()
            target_branch = repo_resp.json()["default_branch"]

        # Get latest commit on the branch
        ref_resp = await client.get(f"/git/ref/heads/{target_branch}")
        ref_resp.raise_for_status()
        latest_sha = ref_resp.json()["object"]["sha"]

        # Get the base tree
        commit_resp = await client.get(f"/git/commits/{latest_sha}")
        commit_resp.raise_for_status()
        base_tree_sha = commit_resp.json()["tree"]["sha"]

        # Create blobs for each changed file in parallel
        async def _create_blob(change: CodeChange) -> dict:
            blob_resp = await client.post(
                "/git/blobs",
                json={
                    "content": base64.b64encode(change.content.encode("utf-8")).decode("ascii"),
                    "encoding": "base64",
                },
            )
            blob_resp.raise_for_status()
            return {
                "path": change.file_path,
                "mode": "100644",
                "type": "blob",
                "sha": blob_resp.json()["sha"],
            }

        tree_items = await asyncio.gather(*[_create_blob(c) for c in changes])

        # Create new tree
        tree_resp = await client.post(
            "/git/trees",
            json={"base_tree": base_tree_sha, "tree": list(tree_items)},
        )
        tree_resp.raise_for_status()
        new_tree_sha = tree_resp.json()["sha"]

        # Create the commit
        new_commit_resp = await client.post(
            "/git/commits",
            json={
                "message": commit_message,
                "tree": new_tree_sha,
                "parents": [latest_sha],
            },
        )
        new_commit_resp.raise_for_status()
        new_commit_sha = new_commit_resp.json()["sha"]

        # Update the branch ref
        update_resp = await client.patch(
            f"/git/refs/heads/{target_branch}",
            json={"sha": new_commit_sha},
        )
        update_resp.raise_for_status()

        return new_commit_sha


@dataclass
class GitHubPullRequestProvider:
    """Implements PullRequestProvider protocol using the GitHub REST API (async)."""

    token: str
    owner: str
    repo: str
    base_branch: str = "main"
    _client: httpx.AsyncClient | None = field(default=None, init=False, repr=False)

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=f"{GITHUB_API_BASE}/repos/{self.owner}/{self.repo}",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                timeout=30.0,
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def open_draft_pr(self, draft: PullRequestDraft) -> str:
        """Open a draft pull request on GitHub and return the PR URL."""
        client = self._get_client()
        resp = await client.post(
            "/pulls",
            json={
                "title": draft.title,
                "body": draft.body,
                "head": draft.branch_name,
                "base": self.base_branch,
                "draft": True,
            },
        )
        resp.raise_for_status()
        return resp.json()["html_url"]


def _webhook_config(url: str, secret: str | None) -> dict[str, str]:
    config = {"url": url, "content_type": "json"}
    if secret:
        config["secret"] = secret
    return config


async def ensure_github_webhook(
    *,
    token: str,
    owner: str,
    repo: str,
    webhook_url: str,
    secret: str | None = None,
) -> bool:
    if not webhook_url:
        return False

    async with httpx.AsyncClient(
        base_url=f"{GITHUB_API_BASE}/repos/{owner}/{repo}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=30.0,
    ) as client:
        list_resp = await client.get("/hooks")
        list_resp.raise_for_status()
        hooks = list_resp.json() or []

        target_hook = None
        for hook in hooks:
            config = hook.get("config") or {}
            if config.get("url") == webhook_url:
                target_hook = hook
                break

        desired_events = ["pull_request"]
        desired_config = _webhook_config(webhook_url, secret)

        if target_hook:
            hook_id = target_hook.get("id")
            needs_update = (
                target_hook.get("active") is False
                or any(event not in (target_hook.get("events") or []) for event in desired_events)
                or (target_hook.get("config") or {}).get("content_type") != "json"
                or (secret and (target_hook.get("config") or {}).get("secret") != secret)
            )
            if needs_update and hook_id:
                update_resp = await client.patch(
                    f"/hooks/{hook_id}",
                    json={
                        "active": True,
                        "events": desired_events,
                        "config": desired_config,
                    },
                )
                update_resp.raise_for_status()
            return True

        create_resp = await client.post(
            "/hooks",
            json={
                "name": "web",
                "active": True,
                "events": desired_events,
                "config": desired_config,
            },
        )
        create_resp.raise_for_status()
        return True
