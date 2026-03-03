from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components

from src.synthesis.engine_types import SignalDigest


@dataclass
class SignalCluster:
    id: str
    signal_ids: list[str]
    centroid: np.ndarray
    signals: list[SignalDigest]


def cluster_signals(
    signals: list[SignalDigest],
    similarity_threshold: float = 0.75,
) -> list[SignalCluster]:
    if not signals:
        return []

    embeddings = np.array([s.embedding for s in signals], dtype=np.float32)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    normalized = embeddings / norms

    similarity = normalized @ normalized.T
    adjacency = (similarity >= similarity_threshold).astype(np.int8)
    np.fill_diagonal(adjacency, 1)

    n_components, labels = connected_components(csr_matrix(adjacency), directed=False)
    clusters: list[SignalCluster] = []

    for label in range(n_components):
        idxs = np.where(labels == label)[0]
        members = [signals[i] for i in idxs]
        centroid = np.mean(np.array([m.embedding for m in members], dtype=np.float32), axis=0)
        clusters.append(
            SignalCluster(
                id=f"cluster_{label}",
                signal_ids=[m.id for m in members],
                centroid=centroid,
                signals=members,
            )
        )

    return clusters
