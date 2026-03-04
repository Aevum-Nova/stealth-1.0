from __future__ import annotations

from typing import Protocol

from stealth_agent.domain.models import (
    CodeChange,
    FeatureRequest,
    FeatureSpec,
    PrioritizedFeature,
    PullRequestDraft,
    RepoAnalysis,
    TechnicalPlan,
)


class SignalProcessor(Protocol):
    def prioritize_feature(self, request: FeatureRequest) -> PrioritizedFeature:
        ...


class SpecPlanner(Protocol):
    def build_spec_and_plan(
        self,
        request: FeatureRequest,
        feature: PrioritizedFeature,
        repo_analysis: RepoAnalysis,
    ) -> tuple[FeatureSpec, TechnicalPlan]:
        ...


class RepositoryAnalyzer(Protocol):
    def analyze(self, repo_path: str) -> RepoAnalysis:
        ...


class CodeGenerator(Protocol):
    def propose_changes(
        self,
        request: FeatureRequest,
        feature: PrioritizedFeature,
        spec: FeatureSpec,
        plan: TechnicalPlan,
        repo_analysis: RepoAnalysis,
    ) -> list[CodeChange]:
        ...


class GitProvider(Protocol):
    def create_branch(self, base_branch: str, branch_name: str) -> None:
        ...

    def apply_changes_and_commit(self, changes: list[CodeChange], commit_message: str) -> str:
        ...


class PullRequestProvider(Protocol):
    def open_draft_pr(self, draft: PullRequestDraft) -> str:
        ...
