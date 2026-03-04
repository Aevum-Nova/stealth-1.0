"""GitHub API adapters for creating branches, commits, and pull requests."""

from __future__ import annotations

import base64
from dataclasses import dataclass, field

import httpx

from stealth_agent.domain.models import CodeChange, PullRequestDraft

GITHUB_API_BASE = "https://api.github.com"


@dataclass
class GitHubGitProvider:
    """Implements GitProvider protocol using the GitHub REST API."""

    token: str
    owner: str
    repo: str
    _last_branch: str = field(default="", init=False, repr=False)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def create_branch(self, base_branch: str, branch_name: str) -> None:
        """Create a new branch from base_branch using the GitHub refs API."""
        self._last_branch = branch_name

        with httpx.Client() as client:
            ref_resp = client.get(
                f"{GITHUB_API_BASE}/repos/{self.owner}/{self.repo}/git/ref/heads/{base_branch}",
                headers=self._headers(),
            )
            ref_resp.raise_for_status()
            base_sha = ref_resp.json()["object"]["sha"]

            create_resp = client.post(
                f"{GITHUB_API_BASE}/repos/{self.owner}/{self.repo}/git/refs",
                headers=self._headers(),
                json={
                    "ref": f"refs/heads/{branch_name}",
                    "sha": base_sha,
                },
            )
            create_resp.raise_for_status()

    def apply_changes_and_commit(self, changes: list[CodeChange], commit_message: str) -> str:
        """Create blobs, build a tree, create a commit, and update the branch ref."""
        with httpx.Client() as client:
            headers = self._headers()
            repo_url = f"{GITHUB_API_BASE}/repos/{self.owner}/{self.repo}"

            branch_name = self._last_branch
            if not branch_name:
                repo_resp = client.get(repo_url, headers=headers)
                repo_resp.raise_for_status()
                branch_name = repo_resp.json()["default_branch"]

            # Get latest commit on the branch
            ref_resp = client.get(
                f"{repo_url}/git/ref/heads/{branch_name}",
                headers=headers,
            )
            ref_resp.raise_for_status()
            latest_sha = ref_resp.json()["object"]["sha"]

            # Get the base tree
            commit_resp = client.get(
                f"{repo_url}/git/commits/{latest_sha}",
                headers=headers,
            )
            commit_resp.raise_for_status()
            base_tree_sha = commit_resp.json()["tree"]["sha"]

            # Create blobs for each changed file
            tree_items = []
            for change in changes:
                blob_resp = client.post(
                    f"{repo_url}/git/blobs",
                    headers=headers,
                    json={
                        "content": base64.b64encode(change.content.encode("utf-8")).decode("ascii"),
                        "encoding": "base64",
                    },
                )
                blob_resp.raise_for_status()
                blob_sha = blob_resp.json()["sha"]

                tree_items.append({
                    "path": change.file_path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": blob_sha,
                })

            # Create new tree
            tree_resp = client.post(
                f"{repo_url}/git/trees",
                headers=headers,
                json={
                    "base_tree": base_tree_sha,
                    "tree": tree_items,
                },
            )
            tree_resp.raise_for_status()
            new_tree_sha = tree_resp.json()["sha"]

            # Create the commit
            new_commit_resp = client.post(
                f"{repo_url}/git/commits",
                headers=headers,
                json={
                    "message": commit_message,
                    "tree": new_tree_sha,
                    "parents": [latest_sha],
                },
            )
            new_commit_resp.raise_for_status()
            new_commit_sha = new_commit_resp.json()["sha"]

            # Update the branch ref
            update_resp = client.patch(
                f"{repo_url}/git/refs/heads/{branch_name}",
                headers=headers,
                json={"sha": new_commit_sha},
            )
            update_resp.raise_for_status()

            return new_commit_sha


@dataclass(slots=True)
class GitHubPullRequestProvider:
    """Implements PullRequestProvider protocol using the GitHub REST API."""

    token: str
    owner: str
    repo: str
    base_branch: str = "main"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def open_draft_pr(self, draft: PullRequestDraft) -> str:
        """Open a draft pull request on GitHub and return the PR URL."""
        with httpx.Client() as client:
            resp = client.post(
                f"{GITHUB_API_BASE}/repos/{self.owner}/{self.repo}/pulls",
                headers=self._headers(),
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
