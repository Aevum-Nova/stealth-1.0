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


@pytest.mark.asyncio
async def test_extract_falls_back_for_ungrouped_batch_when_llm_returns_no_feature_requests(monkeypatch):
    async def _no_feature_requests(system: str, user: str, max_tokens: int = 2000) -> dict:
        _ = system, user, max_tokens
        return {}

    monkeypatch.setattr("src.synthesis.feature_extractor.llm_service.json_completion", _no_feature_requests)

    clusters = [_singleton_cluster(1), _singleton_cluster(2)]
    drafts = await feature_extractor.extract(clusters)

    assert len(drafts) == 2
    assert drafts[0].supporting_signal_ids == ["s1"]
    assert drafts[1].supporting_signal_ids == ["s2"]
