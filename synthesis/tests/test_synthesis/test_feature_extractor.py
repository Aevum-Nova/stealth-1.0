import pytest

from src.synthesis.clustering import SignalCluster
from src.synthesis.engine_types import SignalDigest
from src.synthesis.feature_extractor import feature_extractor


def _singleton_cluster(idx: int) -> SignalCluster:
    signal = SignalDigest(
        id=f"s{idx}",
        structured_summary=f"summary {idx}",
        entities=[],
        sentiment="neutral",
        urgency="low",
        source="api",
        source_data_type="text",
        raw_artifact_r2_key="k",
        source_metadata={},
        embedding=[1.0, 0.0, 0.0],
    )
    return SignalCluster(
        id=f"c{idx}",
        signal_ids=[signal.id],
        centroid=[1.0, 0.0, 0.0],  # type: ignore[arg-type]
        signals=[signal],
    )


def _clustered_pair() -> SignalCluster:
    first = SignalDigest(
        id="s1",
        structured_summary="admins need more control over SSO sessions",
        entities=[],
        sentiment="negative",
        urgency="high",
        source="api",
        source_data_type="text",
        raw_artifact_r2_key="k1",
        source_metadata={},
        embedding=[1.0, 0.0, 0.0],
    )
    second = SignalDigest(
        id="s2",
        structured_summary="session expiry causes repeated login issues",
        entities=[],
        sentiment="negative",
        urgency="high",
        source="api",
        source_data_type="text",
        raw_artifact_r2_key="k2",
        source_metadata={},
        embedding=[1.0, 0.0, 0.0],
    )
    return SignalCluster(
        id="c-pair",
        signal_ids=[first.id, second.id],
        centroid=[1.0, 0.0, 0.0],  # type: ignore[arg-type]
        signals=[first, second],
    )


@pytest.mark.asyncio
async def test_extract_falls_back_for_ungrouped_batch_when_llm_returns_no_feature_requests(monkeypatch):
    async def _no_feature_requests(
        system: str,
        user: str,
        max_tokens: int = 2000,
        schema: dict[str, object] | None = None,
    ) -> dict:
        _ = system, user, max_tokens, schema
        return {}

    monkeypatch.setattr("src.synthesis.feature_extractor.llm_service.json_completion", _no_feature_requests)

    clusters = [_singleton_cluster(1), _singleton_cluster(2)]
    drafts = await feature_extractor.extract(clusters)

    assert len(drafts) == 2
    assert drafts[0].supporting_signal_ids == ["s1"]
    assert drafts[1].supporting_signal_ids == ["s2"]


@pytest.mark.asyncio
async def test_extract_coerces_string_confidence_labels(monkeypatch):
    async def _string_confidence(
        system: str,
        user: str,
        max_tokens: int = 2000,
        schema: dict[str, object] | None = None,
    ) -> dict:
        _ = system, user, max_tokens, schema
        return {
            "feature_requests": [
                {
                    "title": "Improve SSO session handling",
                    "type": "improvement",
                    "problem_statement": "Admins see frequent session expiry issues.",
                    "proposed_solution": "Add configurable SSO session controls.",
                    "user_story": "As an admin, I want longer-lived SSO sessions for stable access.",
                    "acceptance_criteria": ["Admins can configure SSO session duration."],
                    "affected_product_areas": ["authentication"],
                    "supporting_signal_ids": ["s1", "s2"],
                    "confidence": "high",
                }
            ]
        }

    monkeypatch.setattr("src.synthesis.feature_extractor.llm_service.json_completion", _string_confidence)

    drafts = await feature_extractor.extract([_clustered_pair()])

    assert len(drafts) == 1
    assert drafts[0].confidence == 0.8
