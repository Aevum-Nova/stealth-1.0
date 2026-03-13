"""Job service — triggers orchestration as async background tasks, tracks status."""

from __future__ import annotations

import asyncio
import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from stealth_agent.adapters.github import GitHubGitProvider, GitHubPullRequestProvider
from stealth_agent.adapters.llm import LLMProvider
from stealth_agent.adapters.llm_adapters import (
    LLMCodeGenerator,
    LLMSignalProcessor,
    LLMSpecPlanner,
)
from stealth_agent.adapters.local import (
    LocalGitProvider,
    LocalPullRequestProvider,
    LocalRepositoryAnalyzer,
)
from stealth_agent.database import async_session
from stealth_agent.domain.models import PullRequestDraft, RepositoryContext
from stealth_agent.mappers import feature_request_from_row
from stealth_agent.models import AgentJob, ConnectorRow, FeatureRequestRow
from stealth_agent.services.code_indexer import ensure_indexed
from stealth_agent.services.orchestrator import (
    FeatureToPROrchestrator,
    OrchestrationDependencies,
)

log = structlog.get_logger()


def _estimate_line_delta(content: str) -> tuple[int, int]:
    if not content:
        return (0, 0)

    lines = content.splitlines()
    has_hunks = any(line.startswith("@@") for line in lines)
    if has_hunks:
        additions = 0
        deletions = 0
        for line in lines:
            if line.startswith("+++") or line.startswith("---"):
                continue
            if line.startswith("+"):
                additions += 1
            elif line.startswith("-"):
                deletions += 1
        return (additions, deletions)

    additions = sum(1 for line in lines if line.strip())
    return (additions, 0)


async def create_job(
    db: AsyncSession,
    feature_request_id: str,
    organization_id: str,
) -> AgentJob:
    job = AgentJob(
        id=uuid.uuid4(),
        feature_request_id=uuid.UUID(feature_request_id),
        organization_id=uuid.UUID(organization_id),
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def get_job(db: AsyncSession, job_id: str) -> AgentJob | None:
    result = await db.execute(select(AgentJob).where(AgentJob.id == uuid.UUID(job_id)))
    return result.scalar_one_or_none()


async def list_jobs_for_feature_request(
    db: AsyncSession,
    feature_request_id: str,
    organization_id: str,
) -> list[AgentJob]:
    result = await db.execute(
        select(AgentJob)
        .where(
            AgentJob.feature_request_id == uuid.UUID(feature_request_id),
            AgentJob.organization_id == uuid.UUID(organization_id),
        )
        .order_by(AgentJob.created_at.desc())
    )
    return list(result.scalars().all())


def trigger_orchestration(
    job_id: str,
    feature_request_id: str,
    organization_id: str,
    dry_run: bool,
    llm: LLMProvider,
    codegen_llm: LLMProvider,
) -> None:
    """Launch orchestration as a fire-and-forget background task."""
    asyncio.get_event_loop().create_task(
        _run_orchestration(
            job_id, feature_request_id, organization_id, dry_run, llm, codegen_llm
        )
    )


async def _run_orchestration(
    job_id: str,
    feature_request_id: str,
    organization_id: str,
    dry_run: bool,
    llm: LLMProvider,
    codegen_llm: LLMProvider,
) -> None:
    async with async_session() as db:
        try:
            # Update job to running
            job_result = await db.execute(
                select(AgentJob).where(AgentJob.id == uuid.UUID(job_id))
            )
            job = job_result.scalar_one()
            job.status = "running"
            await db.commit()

            # Load feature request
            fr_result = await db.execute(
                select(FeatureRequestRow).where(
                    FeatureRequestRow.id == uuid.UUID(feature_request_id),
                    FeatureRequestRow.organization_id == uuid.UUID(organization_id),
                )
            )
            fr_row = fr_result.scalar_one()

            # Look up GitHub connector for this organization
            gh_result = await db.execute(
                select(ConnectorRow).where(
                    ConnectorRow.organization_id == uuid.UUID(organization_id),
                    ConnectorRow.type == "github",
                    ConnectorRow.enabled == True,  # noqa: E712
                )
            )
            gh_connector = gh_result.scalar_one_or_none()

            # Build repository context and adapters based on GitHub connector
            repo_context: RepositoryContext | None = None
            git_provider: LocalGitProvider | GitHubGitProvider = LocalGitProvider()
            pr_provider: LocalPullRequestProvider | GitHubPullRequestProvider = (
                LocalPullRequestProvider()
            )

            if gh_connector:
                gh_config = gh_connector.config or {}
                gh_creds = gh_connector.credentials or {}
                gh_token = gh_creds.get("access_token", "")
                gh_repo_full = gh_config.get("repository", "")
                gh_default_branch = gh_config.get("default_branch", "main")

                if gh_token and gh_repo_full and "/" in gh_repo_full:
                    owner, repo_name = gh_repo_full.split("/", 1)
                    repo_context = RepositoryContext(
                        path=gh_repo_full,
                        default_branch=gh_default_branch,
                        owner=owner,
                        repo=repo_name,
                    )
                    git_provider = GitHubGitProvider(
                        token=gh_token, owner=owner, repo=repo_name
                    )
                    pr_provider = GitHubPullRequestProvider(
                        token=gh_token,
                        owner=owner,
                        repo=repo_name,
                        base_branch=gh_default_branch,
                    )
                    log.info(
                        "using_github_provider",
                        repo=gh_repo_full,
                        base_branch=gh_default_branch,
                    )

                    # Auto-index the repo if not already indexed
                    try:
                        await ensure_indexed(str(gh_connector.id), organization_id)
                    except Exception as exc:
                        log.warning("auto_index_failed", error=str(exc))

            domain_fr = feature_request_from_row(fr_row, repo_context=repo_context)

            # Build orchestration deps with LLM-backed adapters
            deps = OrchestrationDependencies(
                signal_processor=LLMSignalProcessor(llm),
                repository_analyzer=LocalRepositoryAnalyzer(),
                spec_planner=LLMSpecPlanner(llm),
                code_generator=LLMCodeGenerator(codegen_llm),
                git_provider=git_provider,
                pr_provider=pr_provider,
            )
            FeatureToPROrchestrator(deps)

            # Run orchestration (adapters are now async, but orchestrator.run is sync)
            # We need to run the async adapters — use the async versions directly
            feature = await deps.signal_processor.prioritize_feature(domain_fr)
            repo_analysis = deps.repository_analyzer.analyze(domain_fr.repository.path)
            spec, plan = await deps.spec_planner.build_spec_and_plan(
                domain_fr, feature, repo_analysis
            )
            changes = await deps.code_generator.propose_changes(
                domain_fr, feature, spec, plan, repo_analysis
            )

            # When not a dry run and GitHub is connected, create branch and PR
            branch_name = f"feature/{domain_fr.request_id}-{'-'.join(feature.name.lower().split())}"
            commit_sha = None
            pr_url = None
            if not dry_run and isinstance(git_provider, GitHubGitProvider):
                git_provider.create_branch(
                    domain_fr.repository.default_branch, branch_name
                )
                commit_sha = git_provider.apply_changes_and_commit(
                    changes, commit_message=f"feat: {feature.name.lower()}"
                )
                pr_draft = PullRequestDraft(
                    title=f"[Draft] {feature.name}",
                    body=f"## {feature.name}\n\n{feature.rationale}\n\n{spec.summary}",
                    branch_name=branch_name,
                    changed_files=[c.file_path for c in changes],
                )
                pr_url = pr_provider.open_draft_pr(pr_draft)
                log.info("github_pr_created", pr_url=pr_url, commit_sha=commit_sha)

            proposed_files = []
            for change in changes:
                additions, deletions = _estimate_line_delta(change.content)
                proposed_files.append(
                    {
                        "file_path": change.file_path,
                        "reason": change.reason,
                        "content": change.content,
                        "additions": additions,
                        "deletions": deletions,
                    }
                )

            result_data = {
                "feature_name": feature.name,
                "rationale": feature.rationale,
                "priority_score": feature.priority_score,
                "spec_summary": spec.summary,
                "acceptance_criteria": spec.acceptance_criteria,
                "tasks": plan.tasks,
                "risk_notes": plan.risk_notes,
                "proposed_files": proposed_files,
                "dry_run": dry_run,
                "commit_sha": commit_sha,
                "pull_request_url": pr_url,
                "branch_name": branch_name if pr_url else None,
            }

            # Update job as completed
            await db.refresh(job)
            job.status = "completed"
            job.result = result_data
            await db.commit()

            log.info("orchestration_completed", job_id=job_id)

        except Exception as exc:
            log.error("orchestration_failed", job_id=job_id, error=str(exc))
            try:
                job_result = await db.execute(
                    select(AgentJob).where(AgentJob.id == uuid.UUID(job_id))
                )
                job = job_result.scalar_one()
                job.status = "failed"
                job.error = str(exc)
                await db.commit()
            except Exception:
                log.error("failed_to_update_job_status", job_id=job_id)
