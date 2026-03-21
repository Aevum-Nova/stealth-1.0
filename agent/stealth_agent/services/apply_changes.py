"""Apply chat-proposed changes to an existing PR branch."""

from __future__ import annotations

import re
import uuid

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from stealth_agent.adapters.github import GITHUB_API_BASE, GitHubGitProvider
from stealth_agent.database import async_session
from stealth_agent.domain.models import CodeChange
from stealth_agent.models import AgentJob, ConnectorRow, FeatureRequestRow

log = structlog.get_logger()


async def _fetch_branch_from_pr_url(pr_url: str, token: str) -> str | None:
    """Extract owner/repo/pull_number from PR URL and fetch head ref from GitHub API."""
    # Match https://github.com/owner/repo/pull/123
    m = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", pr_url)
    if not m:
        return None
    owner, repo, pull_number = m.groups()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pull_number}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        if resp.status_code != 200:
            return None
        return resp.json().get("head", {}).get("ref")


async def apply_changes_to_pr(
    feature_request_id: str,
    organization_id: str,
    proposed_changes: list[dict],
) -> dict:
    """
    Apply proposed changes from chat to the open PR branch.
    Returns {"commit_sha": str, "pull_request_url": str} or raises.
    """
    async with async_session() as db:
        # Load feature request
        fr_result = await db.execute(
            select(FeatureRequestRow).where(
                FeatureRequestRow.id == uuid.UUID(feature_request_id),
                FeatureRequestRow.organization_id == uuid.UUID(organization_id),
            )
        )
        fr_row = fr_result.scalar_one_or_none()
        if not fr_row:
            raise ValueError("Feature request not found")

        # Find latest completed job with a PR
        jobs_result = await db.execute(
            select(AgentJob)
            .where(
                AgentJob.feature_request_id == uuid.UUID(feature_request_id),
                AgentJob.organization_id == uuid.UUID(organization_id),
            )
            .order_by(AgentJob.created_at.desc())
        )
        jobs = list(jobs_result.scalars().all())

        pr_job = None
        for job in jobs:
            if job.result and job.result.get("pull_request_url"):
                pr_job = job
                break

        if not pr_job:
            raise ValueError("No open PR found for this feature request")

        pr_url = pr_job.result["pull_request_url"]
        branch_name = pr_job.result.get("branch_name")

        # Get GitHub connector
        gh_result = await db.execute(
            select(ConnectorRow).where(
                ConnectorRow.organization_id == uuid.UUID(organization_id),
                ConnectorRow.type == "github",
                ConnectorRow.enabled == True,  # noqa: E712
            )
        )
        gh_connector = gh_result.scalar_one_or_none()
        if not gh_connector:
            raise ValueError("GitHub connector not configured")

        gh_config = gh_connector.config or {}
        gh_creds = gh_connector.credentials or {}
        gh_token = gh_creds.get("access_token", "")
        gh_repo_full = gh_config.get("repository", "")

        if not gh_token or not gh_repo_full or "/" not in gh_repo_full:
            raise ValueError("GitHub connector missing token or repository")

        owner, repo_name = gh_repo_full.split("/", 1)

        # Fallback: fetch branch from PR URL if not stored (e.g. older jobs)
        if not branch_name:
            branch_name = await _fetch_branch_from_pr_url(pr_url, gh_token)
        if not branch_name:
            raise ValueError(
                "Could not determine PR branch. Re-run Generate PR to create a new job with branch info."
            )

        # Convert proposed changes to CodeChange
        changes: list[CodeChange] = [
            CodeChange(
                file_path=c["file_path"],
                content=c["content"],
                reason=c.get("reason", ""),
            )
            for c in proposed_changes
        ]

        git_provider = GitHubGitProvider(token=gh_token, owner=owner, repo=repo_name)
        try:
            commit_sha = await git_provider.apply_changes_and_commit(
                changes,
                "chore: apply chat-suggested changes",
                branch_name=branch_name,
            )
        finally:
            await git_provider.aclose()

        # Update the job result to reflect the newly applied files
        updated_result = dict(pr_job.result)
        existing_files = {f["file_path"]: f for f in updated_result.get("proposed_files", [])}
        for c in proposed_changes:
            existing_files[c["file_path"]] = {
                "file_path": c["file_path"],
                "content": c["content"],
                "reason": c.get("reason", ""),
            }
        updated_result["proposed_files"] = list(existing_files.values())
        pr_job.result = updated_result
        await db.commit()

        log.info(
            "chat_changes_applied",
            feature_request_id=feature_request_id,
            commit_sha=commit_sha,
            branch_name=branch_name,
        )

        return {"commit_sha": commit_sha, "pull_request_url": pr_url}
