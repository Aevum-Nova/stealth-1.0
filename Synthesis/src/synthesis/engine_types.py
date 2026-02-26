from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SignalDigest:
    id: str
    structured_summary: str
    entities: list[dict]
    sentiment: str
    urgency: str
    source: str
    source_data_type: str
    raw_artifact_r2_key: str
    source_metadata: dict
    embedding: list[float]
