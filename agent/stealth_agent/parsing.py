from __future__ import annotations

import json
from pathlib import Path

from stealth_agent.domain.models import EvidenceItem, FeatureRequest, RepositoryContext, SourceType


def load_feature_request(path: str) -> FeatureRequest:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))

    evidence = [
        EvidenceItem(
            source_type=SourceType(item.get("source_type", "other")),
            source_id=item["source_id"],
            snippet=item["snippet"],
            weight=float(item.get("weight", 0.5)),
        )
        for item in payload.get("evidence", [])
    ]

    repository_payload = payload.get("repository", {})
    repository = RepositoryContext(
        path=repository_payload.get("path", "."),
        default_branch=repository_payload.get("default_branch", "main"),
    )

    return FeatureRequest(
        request_id=payload["request_id"],
        title=payload["title"],
        problem_statement=payload["problem_statement"],
        evidence=evidence,
        business_context=payload.get("business_context", {}),
        constraints=payload.get("constraints", {}),
        repository=repository,
    )
