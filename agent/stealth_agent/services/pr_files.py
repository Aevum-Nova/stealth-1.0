"""Fetch consolidated file list + diff stats from GitHub for a feature request's PR."""

from __future__ import annotations

import re
import uuid

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from stealth_agent.adapters.github import GITHUB_API_BASE
from stealth_agent.models import AgentJob, ConnectorRow, FeatureRequestRow

log = structlog.get_logger()

_PR_URL_RE = re.compile(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)")


def _parse_pr_url(pr_url: str) -> tuple[str, str, int] | None:
    m = _PR_URL_RE.search(pr_url)
    if not m:
        return None
    owner, repo, num = m.groups()
    return owner, repo, int(num)


async def list_pr_files_from_github(
    db: AsyncSession,
    feature_request_id: str,
    organization_id: str,
) -> dict:
    """
    List all files changed in the PR vs base, with additions/deletions from GitHub.

    Returns:
      {"pull_request_url": str | None, "files": [{filename, status, additions, deletions, patch}]}
    """
    fr_result = await db.execute(
        select(FeatureRequestRow).where(
            FeatureRequestRow.id == uuid.UUID(feature_request_id),
            FeatureRequestRow.organization_id == uuid.UUID(organization_id),
        )
    )
    if not fr_result.scalar_one_or_none():
        raise ValueError("Feature request not found")

    jobs_result = await db.execute(
        select(AgentJob)
        .where(
            AgentJob.feature_request_id == uuid.UUID(feature_request_id),
            AgentJob.organization_id == uuid.UUID(organization_id),
        )
        .order_by(AgentJob.created_at.desc())
    )
    jobs = list(jobs_result.scalars().all())

    pr_url = None
    for job in jobs:
        if job.result and job.result.get("pull_request_url"):
            pr_url = job.result["pull_request_url"]
            break

    if not pr_url:
        return {"pull_request_url": None, "files": []}

    parsed = _parse_pr_url(pr_url)
    if not parsed:
        log.warning("pr_url_unparseable", url=pr_url)
        return {"pull_request_url": pr_url, "files": []}

    owner, repo_name, pull_number = parsed

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

    gh_creds = gh_connector.credentials or {}
    gh_token = gh_creds.get("access_token", "")
    if not gh_token:
        raise ValueError("GitHub connector missing access token")

    headers = {
        "Authorization": f"Bearer {gh_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    all_files: list[dict] = []
    page = 1
    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{repo_name}/pulls/{pull_number}/files",
                headers=headers,
                params={"per_page": 100, "page": page},
            )
            if resp.status_code != 200:
                log.warning(
                    "github_pr_files_failed",
                    status=resp.status_code,
                    body=resp.text[:200],
                )
                raise ValueError(
                    f"GitHub returned {resp.status_code} when listing PR files"
                )

            batch = resp.json()
            if not isinstance(batch, list):
                break

            for item in batch:
                if not isinstance(item, dict):
                    continue
                all_files.append({
                    "filename": item.get("filename", ""),
                    "status": item.get("status", "modified"),
                    "additions": int(item.get("additions", 0)),
                    "deletions": int(item.get("deletions", 0)),
                    "patch": item.get("patch"),
                })

            if len(batch) < 100:
                break
            page += 1

    return {"pull_request_url": pr_url, "files": all_files}
