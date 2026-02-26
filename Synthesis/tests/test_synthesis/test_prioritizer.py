from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from src.synthesis.prioritizer import compute_impact_metrics, compute_priority_score, priority_from_score


def _signal(urgency: str, sentiment: str, customer_id: str, company: str):
    return SimpleNamespace(
        id=uuid4(),
        source="api",
        urgency=urgency,
        sentiment=sentiment,
        source_metadata={"customer_id": customer_id, "customer_company": company},
        source_created_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )


def test_compute_priority_score_ranges():
    signals = [
        _signal("high", "negative", "c1", "Acme"),
        _signal("critical", "negative", "c2", "Beta"),
        _signal("medium", "mixed", "c3", "Acme"),
    ]
    ids = [str(s.id) for s in signals]

    metrics = compute_impact_metrics(ids, signals)
    score = compute_priority_score(metrics, confidence=0.9)

    assert 0 <= score <= 100
    assert priority_from_score(score) in {"low", "medium", "high", "critical"}
