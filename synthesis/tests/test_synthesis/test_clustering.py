from src.synthesis.clustering import cluster_signals
from src.synthesis.engine_types import SignalDigest


def _digest(idx: int, emb: list[float]) -> SignalDigest:
    return SignalDigest(
        id=f"s{idx}",
        structured_summary=f"summary {idx}",
        entities=[],
        sentiment="neutral",
        urgency="low",
        source="api",
        source_data_type="text",
        raw_artifact_r2_key="k",
        source_metadata={},
        embedding=emb,
    )


def test_cluster_signals_groups_similar_embeddings():
    signals = [
        _digest(1, [1.0, 0.0, 0.0]),
        _digest(2, [0.95, 0.05, 0.0]),
        _digest(3, [0.0, 1.0, 0.0]),
    ]

    clusters = cluster_signals(signals, similarity_threshold=0.8)
    sizes = sorted(len(c.signals) for c in clusters)

    assert sizes == [1, 2]
