"""Convert synthesis DB rows to agent domain dataclasses."""

from __future__ import annotations

from stealth_agent.domain.models import EvidenceItem, FeatureRequest, RepositoryContext, SourceType
from stealth_agent.models import FeatureRequestRow


def _map_source_type(source: str) -> SourceType:
    try:
        return SourceType(source)
    except ValueError:
        return SourceType.OTHER


def feature_request_from_row(
    row: FeatureRequestRow,
    repo_context: RepositoryContext | None = None,
) -> FeatureRequest:
    evidence: list[EvidenceItem] = []
    for item in row.supporting_evidence or []:
        evidence.append(
            EvidenceItem(
                source_type=_map_source_type(item.get("source", "other")),
                source_id=item.get("signal_id", ""),
                snippet=item.get("representative_quote", item.get("signal_summary", "")),
                weight=float(item.get("relevance_score", 50)) / 100.0,
            )
        )

    return FeatureRequest(
        request_id=str(row.id),
        title=row.title,
        problem_statement=row.problem_statement,
        evidence=evidence,
        business_context={
            "type": row.type or "",
            "priority": row.priority or "",
            "proposed_solution": row.proposed_solution or "",
            "user_story": row.user_story or "",
        },
        constraints={},
        repository=repo_context or RepositoryContext(path="."),
    )
