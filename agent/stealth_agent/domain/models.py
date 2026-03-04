from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class SourceType(str, Enum):
    SUPPORT_TICKET = "support_ticket"
    CALL_TRANSCRIPT = "call_transcript"
    ANALYTICS = "analytics"
    DOC = "doc"
    OTHER = "other"


@dataclass(slots=True)
class EvidenceItem:
    source_type: SourceType
    source_id: str
    snippet: str
    weight: float = 0.5


@dataclass(slots=True)
class RepositoryContext:
    path: str
    default_branch: str = "main"
    owner: str = ""
    repo: str = ""


@dataclass(slots=True)
class FeatureRequest:
    request_id: str
    title: str
    problem_statement: str
    evidence: list[EvidenceItem]
    business_context: dict[str, str] = field(default_factory=dict)
    constraints: dict[str, str | int | float | bool] = field(default_factory=dict)
    repository: RepositoryContext = field(default_factory=lambda: RepositoryContext(path="."))


@dataclass(slots=True)
class PrioritizedFeature:
    name: str
    rationale: str
    priority_score: float


@dataclass(slots=True)
class FeatureSpec:
    summary: str
    acceptance_criteria: list[str]
    non_goals: list[str]


@dataclass(slots=True)
class TechnicalPlan:
    architecture_notes: str
    tasks: list[str]
    risk_notes: list[str]


@dataclass(slots=True)
class RepoAnalysis:
    primary_language: str
    key_paths: list[str]
    constraints: list[str]


@dataclass(slots=True)
class CodeChange:
    file_path: str
    content: str
    reason: str


@dataclass(slots=True)
class PullRequestDraft:
    title: str
    body: str
    branch_name: str
    changed_files: list[str]


@dataclass(slots=True)
class OrchestrationResult:
    request_id: str
    prioritized_feature: PrioritizedFeature
    spec: FeatureSpec
    technical_plan: TechnicalPlan
    pr_draft: PullRequestDraft
    commit_sha: str | None = None
    pull_request_url: str | None = None
