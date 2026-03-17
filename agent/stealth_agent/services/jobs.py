"""Job service — triggers orchestration as async background tasks, tracks status."""

from __future__ import annotations

import asyncio
import time
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
from stealth_agent.config import settings
from stealth_agent.models import AgentJob, ConnectorRow, FeatureRequestRow
from stealth_agent.services.code_indexer import ensure_indexed
from stealth_agent.services.orchestrator import OrchestrationDependencies

log = structlog.get_logger()


async def _safe_ensure_indexed(connector_id: str, organization_id: str) -> None:
    """Fire-and-forget indexing wrapper that logs errors instead of raising."""
    try:
        await ensure_indexed(connector_id, organization_id)
    except Exception as exc:
        log.warning("auto_index_failed", connector_id=connector_id, error=str(exc))


async def _should_skip_regeneration(
    db: AsyncSession,
    feature_request_id: str,
    organization_id: str,
) -> dict | None:
    """Return the last job result if regeneration can be skipped, else None."""
    result = await db.execute(
        select(AgentJob)
        .where(
            AgentJob.feature_request_id == uuid.UUID(feature_request_id),
            AgentJob.organization_id == uuid.UUID(organization_id),
            AgentJob.status == "completed",
        )
        .order_by(AgentJob.created_at.desc())
        .limit(1)
    )
    last_job = result.scalar_one_or_none()
    if not last_job or not last_job.result:
        return None

    fr_result = await db.execute(
        select(FeatureRequestRow.updated_at).where(
            FeatureRequestRow.id == uuid.UUID(feature_request_id),
            FeatureRequestRow.organization_id == uuid.UUID(organization_id),
        )
    )
    fr_updated = fr_result.scalar_one_or_none()
    if fr_updated and fr_updated > last_job.created_at:
        return None

    return last_job.result


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
    llm: LLMProvider,
    codegen_llm: LLMProvider,
) -> None:
    """Launch orchestration as a fire-and-forget background task."""
    asyncio.get_event_loop().create_task(
        _run_orchestration(
            job_id, feature_request_id, organization_id, llm, codegen_llm
        )
    )


async def _run_orchestration(
    job_id: str,
    feature_request_id: str,
    organization_id: str,
    llm: LLMProvider,
    codegen_llm: LLMProvider,
) -> None:
    async with async_session() as db:
        git_provider: LocalGitProvider | GitHubGitProvider = LocalGitProvider()
        pr_provider: LocalPullRequestProvider | GitHubPullRequestProvider = (
            LocalPullRequestProvider()
        )
        try:
            orchestration_started_at = time.perf_counter()
            # Update job to running
            job_result = await db.execute(
                select(AgentJob).where(AgentJob.id == uuid.UUID(job_id))
            )
            job = job_result.scalar_one()
            job.status = "running"
            await db.commit()

            # Check if regeneration can be skipped (nothing changed since last job)
            cached_result = await _should_skip_regeneration(
                db, feature_request_id, organization_id
            )
            if cached_result is not None:
                log.info(
                    "orchestration_skipped_no_changes",
                    job_id=job_id,
                    feature_request_id=feature_request_id,
                )
                await db.refresh(job)
                job.status = "completed"
                job.result = cached_result
                await db.commit()
                return

            # Load feature request
            load_fr_started_at = time.perf_counter()
            fr_result = await db.execute(
                select(FeatureRequestRow).where(
                    FeatureRequestRow.id == uuid.UUID(feature_request_id),
                    FeatureRequestRow.organization_id == uuid.UUID(organization_id),
                )
            )
            fr_row = fr_result.scalar_one()
            log.info(
                "orchestration_step_timing",
                job_id=job_id,
                step="load_feature_request",
                duration_ms=round((time.perf_counter() - load_fr_started_at) * 1000, 2),
            )

            # Look up GitHub connector for this organization
            lookup_connector_started_at = time.perf_counter()
            gh_result = await db.execute(
                select(ConnectorRow).where(
                    ConnectorRow.organization_id == uuid.UUID(organization_id),
                    ConnectorRow.type == "github",
                    ConnectorRow.enabled == True,  # noqa: E712
                )
            )
            gh_connector = gh_result.scalar_one_or_none()
            log.info(
                "orchestration_step_timing",
                job_id=job_id,
                step="lookup_github_connector",
                duration_ms=round(
                    (time.perf_counter() - lookup_connector_started_at) * 1000, 2
                ),
                has_connector=bool(gh_connector),
            )

            # Build repository context and adapters based on GitHub connector
            repo_context: RepositoryContext | None = None
            index_task: asyncio.Task | None = None

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

                    # Start indexing; we'll await it before RAG retrieval in step 3
                    index_task = asyncio.create_task(
                        _safe_ensure_indexed(str(gh_connector.id), organization_id)
                    )

            domain_fr = feature_request_from_row(fr_row, repo_context=repo_context)

            # Build orchestration deps with LLM-backed adapters
            connector_id = gh_connector.id if gh_connector else None
            deps = OrchestrationDependencies(
                signal_processor=LLMSignalProcessor(llm),
                repository_analyzer=LocalRepositoryAnalyzer(),
                spec_planner=LLMSpecPlanner(llm),
                code_generator=LLMCodeGenerator(
                    codegen_llm,
                    connector_id=connector_id,
                    organization_id=organization_id,
                ),
                git_provider=git_provider,
                pr_provider=pr_provider,
            )

            # Run orchestration with parallelized steps where possible
            # Step 1: prioritize_feature + repo_analysis (independent, run in parallel)
            step1_started_at = time.perf_counter()
            feature, repo_analysis = await asyncio.gather(
                deps.signal_processor.prioritize_feature(domain_fr),
                asyncio.to_thread(
                    deps.repository_analyzer.analyze, domain_fr.repository.path
                ),
            )
            log.info(
                "orchestration_step_timing",
                job_id=job_id,
                step="prioritize_feature_and_repo_analysis",
                duration_ms=round((time.perf_counter() - step1_started_at) * 1000, 2),
            )
            # Step 2: spec + plan (depends on feature + repo_analysis)
            step2_started_at = time.perf_counter()
            spec, plan = await deps.spec_planner.build_spec_and_plan(
                domain_fr, feature, repo_analysis
            )
            log.info(
                "orchestration_step_timing",
                job_id=job_id,
                step="build_spec_and_plan",
                duration_ms=round((time.perf_counter() - step2_started_at) * 1000, 2),
            )

            # Wait for index to be ready before RAG retrieval (runs in parallel with steps 1-2)
            if index_task is not None:
                index_wait_started_at = time.perf_counter()
                done, _ = await asyncio.wait(
                    {index_task}, timeout=settings.INDEX_WAIT_TIMEOUT_SECONDS
                )
                log.info(
                    "orchestration_step_timing",
                    job_id=job_id,
                    step="wait_for_index",
                    duration_ms=round((time.perf_counter() - index_wait_started_at) * 1000, 2),
                    index_ready=bool(done),
                )

            # Step 3: propose_changes (depends on spec + plan)
            step3_started_at = time.perf_counter()
            changes = await deps.code_generator.propose_changes(
                domain_fr, feature, spec, plan, repo_analysis
            )
            log.info(
                "orchestration_step_timing",
                job_id=job_id,
                step="propose_changes",
                duration_ms=round((time.perf_counter() - step3_started_at) * 1000, 2),
                change_count=len(changes),
            )

            # Create branch and PR when GitHub is connected
            branch_name = f"feature/{domain_fr.request_id}-{'-'.join(feature.name.lower().split())}"
            commit_sha = None
            pr_url = None
            if isinstance(git_provider, GitHubGitProvider):
                github_started_at = time.perf_counter()
                await git_provider.create_branch(
                    domain_fr.repository.default_branch, branch_name
                )
                commit_sha = await git_provider.apply_changes_and_commit(
                    changes, commit_message=f"feat: {feature.name.lower()}"
                )
                pr_draft = PullRequestDraft(
                    title=f"[Draft] {feature.name}",
                    body=f"## {feature.name}\n\n{feature.rationale}\n\n{spec.summary}",
                    branch_name=branch_name,
                    changed_files=[c.file_path for c in changes],
                )
                pr_url = await pr_provider.open_draft_pr(pr_draft)
                log.info(
                    "orchestration_step_timing",
                    job_id=job_id,
                    step="github_create_branch_commit_pr",
                    duration_ms=round((time.perf_counter() - github_started_at) * 1000, 2),
                )
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
                "dry_run": False,
                "commit_sha": commit_sha,
                "pull_request_url": pr_url,
                "branch_name": branch_name if pr_url else None,
            }

            # Update job as completed
            await db.refresh(job)
            job.status = "completed"
            job.result = result_data
            await db.commit()

            log.info(
                "orchestration_step_timing",
                job_id=job_id,
                step="total",
                duration_ms=round(
                    (time.perf_counter() - orchestration_started_at) * 1000, 2
                ),
            )
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
        finally:
            if isinstance(git_provider, GitHubGitProvider):
                await git_provider.aclose()
            if isinstance(pr_provider, GitHubPullRequestProvider):
                await pr_provider.aclose()
