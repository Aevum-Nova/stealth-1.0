"""GitHub webhook handlers for PR state sync."""

from __future__ import annotations

import hashlib
import hmac
import json

import structlog
from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from stealth_agent.config import settings
from stealth_agent.database import async_session
from stealth_agent.models import AgentJob

log = structlog.get_logger()

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


def _verify_signature(raw_body: bytes, signature: str | None) -> None:
    secret = settings.GITHUB_WEBHOOK_SECRET
    if not secret:
        return
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature")

    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    expected = f"sha256={digest}"
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")


@router.post("/github")
async def handle_github_webhook(request: Request) -> dict:
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    _verify_signature(raw_body, signature)

    event = request.headers.get("X-GitHub-Event", "")
    if event != "pull_request":
        return {"ok": True, "ignored": True}

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    pr = payload.get("pull_request") or {}
    pr_url = pr.get("html_url")
    if not pr_url:
        return {"ok": True, "ignored": True}

    state = pr.get("state")
    merged = bool(pr.get("merged"))
    if merged:
        pr_state = "merged"
    elif state == "closed":
        pr_state = "closed"
    else:
        pr_state = "open"

    pr_number = pr.get("number")
    repo = (pr.get("base") or {}).get("repo") or {}
    repo_full_name = repo.get("full_name")

    async with async_session() as db:
        result = await db.execute(
            select(AgentJob).where(
                AgentJob.result["pull_request_url"].astext == pr_url  # type: ignore[index]
            )
        )
        jobs = list(result.scalars().all())
        if not jobs:
            log.info("webhook_pr_not_found", pr_url=pr_url)
            return {"ok": True, "updated": 0}

        for job in jobs:
            job.result = job.result or {}
            job.result["pull_request_state"] = pr_state
            job.result["pull_request_merged"] = merged
            if pr_number is not None:
                job.result["pull_request_number"] = pr_number
            if repo_full_name:
                job.result["pull_request_repo"] = repo_full_name
        await db.commit()

    log.info("webhook_pr_state_updated", pr_url=pr_url, state=pr_state, count=len(jobs))
    return {"ok": True, "updated": len(jobs), "state": pr_state}
