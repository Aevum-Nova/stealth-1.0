from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from statistics import mean

from src.models.signal import Signal
from src.schemas.feature_request import ImpactMetrics


def count_by_source(signals: list[Signal]) -> dict[str, int]:
    return dict(Counter(s.source for s in signals))


def compute_trend(signals: list[Signal]) -> str:
    now = datetime.now(timezone.utc)
    weekly_counts: list[int] = []
    for w in range(8):
        end = now - timedelta(days=w * 7)
        start = end - timedelta(days=7)
        weekly_counts.append(
            sum(
                1
                for s in signals
                if start
                <= (s.source_created_at or s.created_at)
                <= end
            )
        )

    recent = sum(weekly_counts[:2])
    previous = max(sum(weekly_counts[2:4]), 1)

    if recent > previous * 1.5:
        return "increasing"
    if recent < previous * 0.5:
        return "decreasing"
    return "stable"


def compute_impact_metrics(supporting_signal_ids: list[str], all_signals: list[Signal]) -> ImpactMetrics:
    supporting = [s for s in all_signals if str(s.id) in supporting_signal_ids]

    urgency_map = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    sentiment_map = {"positive": 1, "neutral": 0, "mixed": -0.5, "negative": -1}

    customer_ids = {
        s.source_metadata.get("customer_id")
        for s in supporting
        if s.source_metadata and s.source_metadata.get("customer_id")
    }
    company_names = {
        s.source_metadata.get("customer_company")
        for s in supporting
        if s.source_metadata and s.source_metadata.get("customer_company")
    }

    signal_times = [(s.source_created_at or s.created_at) for s in supporting]
    fallback_time = datetime.now(timezone.utc)

    return ImpactMetrics(
        signal_count=len(supporting),
        unique_customers=len(customer_ids),
        unique_companies=len(company_names),
        source_breakdown=count_by_source(supporting),
        avg_urgency_score=mean([urgency_map.get(s.urgency, 1) for s in supporting]) if supporting else 1.0,
        avg_sentiment_score=mean([sentiment_map.get(s.sentiment, 0) for s in supporting]) if supporting else 0.0,
        earliest_mention=min(signal_times) if signal_times else fallback_time,
        latest_mention=max(signal_times) if signal_times else fallback_time,
        trend_direction=compute_trend(supporting) if supporting else "stable",
    )


def compute_priority_score(metrics: ImpactMetrics, confidence: float) -> int:
    weights = {
        "signal_count": 0.25,
        "unique_customers": 0.20,
        "unique_companies": 0.15,
        "avg_urgency": 0.20,
        "negative_sentiment": 0.10,
        "confidence": 0.10,
    }

    normalized = {
        "signal_count": min(metrics.signal_count / 20, 1.0),
        "unique_customers": min(metrics.unique_customers / 10, 1.0),
        "unique_companies": min(metrics.unique_companies / 5, 1.0),
        "avg_urgency": (metrics.avg_urgency_score - 1) / 3,
        "negative_sentiment": max(-metrics.avg_sentiment_score, 0),
        "confidence": confidence,
    }

    score = sum(normalized[k] * w * 100 for k, w in weights.items())
    return round(min(max(score, 0), 100))


def priority_from_score(score: int) -> str:
    if score <= 25:
        return "low"
    if score <= 50:
        return "medium"
    if score <= 75:
        return "high"
    return "critical"
