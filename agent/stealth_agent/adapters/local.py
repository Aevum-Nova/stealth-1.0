from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from stealth_agent.domain.models import (
    CodeChange,
    FeatureRequest,
    FeatureSpec,
    PrioritizedFeature,
    PullRequestDraft,
    RepoAnalysis,
    TechnicalPlan,
)


class LocalSignalProcessor:
    def prioritize_feature(self, request: FeatureRequest) -> PrioritizedFeature:
        score = min(1.0, sum(item.weight for item in request.evidence) / max(len(request.evidence), 1))
        return PrioritizedFeature(
            name=request.title,
            rationale=request.problem_statement,
            priority_score=score,
        )


class LocalRepositoryAnalyzer:
    def analyze(self, repo_path: str) -> RepoAnalysis:
        root = Path(repo_path)
        py_files = list(root.rglob("*.py"))
        primary_language = "python" if py_files else "unknown"
        key_paths = [str(path) for path in py_files[:10]]
        constraints = ["Prefer minimal scoped changes", "Do not touch unrelated files"]
        return RepoAnalysis(
            primary_language=primary_language,
            key_paths=key_paths,
            constraints=constraints,
        )


class LocalSpecPlanner:
    def build_spec_and_plan(
        self,
        request: FeatureRequest,
        feature: PrioritizedFeature,
        repo_analysis: RepoAnalysis,
    ) -> tuple[FeatureSpec, TechnicalPlan]:
        summary = (
            f"Implement '{feature.name}' to address: {request.problem_statement}. "
            f"Target stack: {repo_analysis.primary_language}."
        )
        criteria = [
            "Accept structured feature request payload",
            "Produce a deterministic implementation plan",
            "Generate draft PR metadata",
        ]
        non_goals = ["Autonomous merge", "Large-scale refactors"]
        tasks = [
            "Map request fields into a feature decision",
            "Build technical task list from spec",
            "Prepare code-change proposal artifacts",
            "Draft PR title/body from evidence + implementation summary",
        ]
        risk_notes = ["Incorrect prioritization without richer scoring", "Adapter outputs may drift"]

        return (
            FeatureSpec(summary=summary, acceptance_criteria=criteria, non_goals=non_goals),
            TechnicalPlan(architecture_notes="Pipeline with adapter boundaries", tasks=tasks, risk_notes=risk_notes),
        )


class LocalCodeGenerator:
    def propose_changes(
        self,
        request: FeatureRequest,
        feature: PrioritizedFeature,
        spec: FeatureSpec,
        plan: TechnicalPlan,
        repo_analysis: RepoAnalysis,
    ) -> list[CodeChange]:
        proposal = {
            "request_id": request.request_id,
            "feature": feature.name,
            "spec_summary": spec.summary,
            "tasks": plan.tasks,
            "repo_language": repo_analysis.primary_language,
        }

        return [
            CodeChange(
                file_path=".stealth/proposed_changes.json",
                content=json.dumps(proposal, indent=2),
                reason="Persist minimal machine-readable change proposal",
            )
        ]


class LocalGitProvider:
    def create_branch(self, base_branch: str, branch_name: str) -> None:
        _ = base_branch, branch_name

    def apply_changes_and_commit(self, changes: list[CodeChange], commit_message: str) -> str:
        for change in changes:
            path = Path(change.file_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(change.content, encoding="utf-8")

        digest = hashlib.sha1(commit_message.encode("utf-8")).hexdigest()
        return digest[:12]


@dataclass(slots=True)
class LocalPullRequestProvider:
    base_url: str = "https://example.local/pr"

    def open_draft_pr(self, draft: PullRequestDraft) -> str:
        slug = "-".join(draft.title.lower().split())
        return f"{self.base_url}/{slug}"
