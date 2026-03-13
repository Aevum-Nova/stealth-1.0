from __future__ import annotations

from dataclasses import dataclass

from stealth_agent.adapters.protocols import (
    CodeGenerator,
    GitProvider,
    PullRequestProvider,
    RepositoryAnalyzer,
    SignalProcessor,
    SpecPlanner,
)
from stealth_agent.domain.models import FeatureRequest, OrchestrationResult, PullRequestDraft


@dataclass(slots=True)
class OrchestrationDependencies:
    signal_processor: SignalProcessor
    repository_analyzer: RepositoryAnalyzer
    spec_planner: SpecPlanner
    code_generator: CodeGenerator
    git_provider: GitProvider
    pr_provider: PullRequestProvider


class FeatureToPROrchestrator:
    def __init__(self, deps: OrchestrationDependencies) -> None:
        self._deps = deps

    def run(self, request: FeatureRequest) -> OrchestrationResult:
        feature = self._deps.signal_processor.prioritize_feature(request)
        repo_analysis = self._deps.repository_analyzer.analyze(request.repository.path)
        spec, technical_plan = self._deps.spec_planner.build_spec_and_plan(
            request, feature, repo_analysis
        )
        changes = self._deps.code_generator.propose_changes(
            request,
            feature,
            spec,
            technical_plan,
            repo_analysis,
        )

        branch_name = f"feature/{request.request_id}-{_slug(feature.name)}"
        pr_title = f"[Draft] {feature.name}"
        pr_body = _build_pr_body(request, feature.rationale, spec.summary, technical_plan.tasks)
        pr_draft = PullRequestDraft(
            title=pr_title,
            body=pr_body,
            branch_name=branch_name,
            changed_files=[change.file_path for change in changes],
        )

        self._deps.git_provider.create_branch(request.repository.default_branch, branch_name)
        commit_sha = self._deps.git_provider.apply_changes_and_commit(
            changes,
            commit_message=f"feat: {feature.name.lower()}",
        )
        pr_url = self._deps.pr_provider.open_draft_pr(pr_draft)

        return OrchestrationResult(
            request_id=request.request_id,
            prioritized_feature=feature,
            spec=spec,
            technical_plan=technical_plan,
            pr_draft=pr_draft,
            commit_sha=commit_sha,
            pull_request_url=pr_url,
        )


def _slug(value: str) -> str:
    return "-".join(value.lower().split())


def _build_pr_body(
    request: FeatureRequest,
    rationale: str,
    feature_summary: str,
    tasks: list[str],
) -> str:
    evidence = "\n".join(
        f"- {item.source_type.value}:{item.source_id} (weight={item.weight}) - {item.snippet}"
        for item in request.evidence
    )
    task_lines = "\n".join(f"- {task}" for task in tasks)

    return (
        "## Why this feature\n"
        f"{rationale}\n\n"
        "## Product evidence\n"
        f"{evidence}\n\n"
        "## Technical summary\n"
        f"{feature_summary}\n\n"
        "## Planned tasks\n"
        f"{task_lines}\n"
    )
