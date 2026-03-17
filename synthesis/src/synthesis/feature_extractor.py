from __future__ import annotations

import asyncio
from collections import Counter
from dataclasses import dataclass, field

import structlog

from src.config import settings
from src.services.llm import llm_service
from src.synthesis.clustering import SignalCluster

log = structlog.get_logger()

CLUSTER_EXTRACTION_PROMPT = """You are a senior product manager analyzing a normalized cluster card derived from customer feedback.
Return JSON: {"feature_requests": [{title,type,problem_statement,proposed_solution,user_story,acceptance_criteria,technical_notes,affected_product_areas,supporting_signal_ids,representative_quotes,confidence,synthesis_summary}]}.
Use only signal IDs that appear in the cluster card.
Prefer one feature request unless the cluster card clearly contains multiple distinct asks.
The confidence field must be a number between 0 and 1.
The synthesis_summary field must be 2-3 sentences summarizing how many signals contributed, which sources they came from, and why this feature request is being created.
Return valid JSON only."""

UNGROUPED_EXTRACTION_PROMPT = """Review standalone signal cards and return actionable feature requests only when the ask is concrete enough.
Return JSON with feature_requests array only.
Use only signal IDs that appear in the batch card.
The confidence field must be a number between 0 and 1.
The synthesis_summary field must be 2-3 sentences summarizing which signal(s) and source(s) contributed and why this feature request is being created.
Return valid JSON only."""

FEATURE_REQUESTS_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "feature_requests": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": ["feature", "bug_fix", "improvement", "integration", "ux_change"],
                    },
                    "problem_statement": {"type": "string"},
                    "proposed_solution": {"type": "string"},
                    "user_story": {"type": "string"},
                    "acceptance_criteria": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "technical_notes": {"type": "string"},
                    "affected_product_areas": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "supporting_signal_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "representative_quotes": {
                        "type": "object",
                        "additionalProperties": {"type": "string"},
                    },
                    "confidence": {"type": "number"},
                    "synthesis_summary": {"type": "string"},
                },
                "required": [
                    "title",
                    "type",
                    "problem_statement",
                    "proposed_solution",
                    "user_story",
                    "acceptance_criteria",
                    "affected_product_areas",
                    "supporting_signal_ids",
                    "confidence",
                    "synthesis_summary",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["feature_requests"],
    "additionalProperties": False,
}


@dataclass
class DraftFeatureRequest:
    title: str
    type: str
    problem_statement: str
    proposed_solution: str
    user_story: str
    acceptance_criteria: list[str]
    technical_notes: str | None
    affected_product_areas: list[str]
    supporting_signal_ids: list[str]
    representative_quotes: dict[str, str] = field(default_factory=dict)
    confidence: float = 0.5
    synthesis_summary: str | None = None


class FeatureExtractor:
    @staticmethod
    def _coerce_confidence(value: object, default: float) -> float:
        if isinstance(value, (int, float)):
            confidence = float(value)
        elif isinstance(value, str):
            normalized = value.strip().lower()
            label_map = {
                "very low": 0.1,
                "low": 0.25,
                "medium": 0.5,
                "high": 0.8,
                "very high": 0.95,
            }
            if normalized in label_map:
                confidence = label_map[normalized]
            else:
                try:
                    confidence = float(normalized)
                except ValueError:
                    confidence = default
        else:
            confidence = default

        return max(0.0, min(1.0, confidence))

    async def extract(self, clusters: list[SignalCluster], context: str | None = None) -> list[DraftFeatureRequest]:
        drafts: list[DraftFeatureRequest] = []
        semaphore = asyncio.Semaphore(settings.SYNTHESIS_CLUSTER_CONCURRENCY)

        grouped = [cluster for cluster in clusters if len(cluster.signals) >= 2]
        if grouped:
            grouped_results = await asyncio.gather(
                *(self._extract_grouped_cluster(cluster, semaphore, context=context) for cluster in grouped)
            )
            for cluster_drafts in grouped_results:
                drafts.extend(cluster_drafts)

        ungrouped = [cluster for cluster in clusters if len(cluster.signals) == 1]
        if ungrouped:
            singleton_results = await asyncio.gather(
                *(
                    self._extract_ungrouped_batch(batch, semaphore)
                    for batch in self._chunk(ungrouped, 30)
                )
            )
            for batch_drafts in singleton_results:
                drafts.extend(batch_drafts)

        return drafts

    @staticmethod
    def _chunk(items: list[SignalCluster], size: int) -> list[list[SignalCluster]]:
        return [items[i : i + size] for i in range(0, len(items), size)]

    async def _extract_grouped_cluster(
        self,
        cluster: SignalCluster,
        semaphore: asyncio.Semaphore,
        *,
        context: str | None = None,
    ) -> list[DraftFeatureRequest]:
        async with semaphore:
            cluster_card = self._format_cluster_card(cluster, context=context)
            telemetry = {
                "cluster_id": cluster.id,
                "cluster_size": len(cluster.signals),
                "prompt_chars": len(cluster_card),
            }
            payload = await llm_service.json_completion(
                CLUSTER_EXTRACTION_PROMPT,
                cluster_card,
                max_tokens=1400,
                schema=FEATURE_REQUESTS_SCHEMA,
                stage="feature_extraction",
                model=settings.ANTHROPIC_SYNTHESIS_MODEL,
                effort=settings.ANTHROPIC_SYNTHESIS_EFFORT,
                enable_prompt_cache=settings.ANTHROPIC_ENABLE_PROMPT_CACHING,
                telemetry=telemetry,
            )
            drafts = self._drafts_from_payload(
                payload,
                fallback_ids=cluster.signal_ids,
                default_confidence=0.5,
                minimum_supporting_signals=2,
            )

            retry_reasons = self._retry_reasons_for_cluster(cluster, drafts)
            if retry_reasons:
                log.info(
                    "feature_extraction_retry",
                    cluster_id=cluster.id,
                    cluster_size=len(cluster.signals),
                    reasons=retry_reasons,
                    initial_model=settings.ANTHROPIC_SYNTHESIS_MODEL,
                    retry_model=settings.ANTHROPIC_SYNTHESIS_RETRY_MODEL,
                )
                retry_payload = await llm_service.json_completion(
                    CLUSTER_EXTRACTION_PROMPT,
                    cluster_card,
                    max_tokens=1600,
                    schema=FEATURE_REQUESTS_SCHEMA,
                    stage="feature_extraction_retry",
                    model=settings.ANTHROPIC_SYNTHESIS_RETRY_MODEL,
                    effort=settings.ANTHROPIC_SYNTHESIS_RETRY_EFFORT,
                    enable_prompt_cache=settings.ANTHROPIC_ENABLE_PROMPT_CACHING,
                    telemetry={**telemetry, "retry_reasons": ",".join(retry_reasons)},
                )
                retry_drafts = self._drafts_from_payload(
                    retry_payload,
                    fallback_ids=cluster.signal_ids,
                    default_confidence=0.55,
                    minimum_supporting_signals=2,
                )
                if retry_drafts:
                    drafts = retry_drafts

            if drafts:
                return drafts
            return [self._fallback_from_cluster(cluster)]

    async def _extract_ungrouped_batch(
        self,
        batch: list[SignalCluster],
        semaphore: asyncio.Semaphore,
    ) -> list[DraftFeatureRequest]:
        async with semaphore:
            batch_card = self._format_ungrouped_batch_card(batch)
            payload = await llm_service.json_completion(
                UNGROUPED_EXTRACTION_PROMPT,
                batch_card,
                max_tokens=1200,
                schema=FEATURE_REQUESTS_SCHEMA,
                stage="feature_extraction_ungrouped",
                model=settings.ANTHROPIC_SYNTHESIS_MODEL,
                effort=settings.ANTHROPIC_SYNTHESIS_EFFORT,
                enable_prompt_cache=settings.ANTHROPIC_ENABLE_PROMPT_CACHING,
                telemetry={
                    "cluster_size": len(batch),
                    "singleton_batch_size": len(batch),
                    "prompt_chars": len(batch_card),
                },
            )
            drafts = self._drafts_from_payload(
                payload,
                fallback_ids=[],
                default_confidence=0.4,
                minimum_supporting_signals=1,
            )
            if drafts:
                return drafts
            return [self._fallback_from_singleton(cluster) for cluster in batch]

    def _drafts_from_payload(
        self,
        payload: dict | object,
        *,
        fallback_ids: list[str],
        default_confidence: float,
        minimum_supporting_signals: int,
    ) -> list[DraftFeatureRequest]:
        items = payload.get("feature_requests") if isinstance(payload, dict) else None
        if not items:
            return []

        drafts: list[DraftFeatureRequest] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            supporting = item.get("supporting_signal_ids") or fallback_ids
            if len(supporting) < minimum_supporting_signals:
                continue
            drafts.append(
                DraftFeatureRequest(
                    title=item.get("title", "Untitled request"),
                    type=item.get("type", "improvement"),
                    problem_statement=item.get("problem_statement", ""),
                    proposed_solution=item.get("proposed_solution", ""),
                    user_story=item.get("user_story", ""),
                    acceptance_criteria=item.get("acceptance_criteria", []),
                    technical_notes=item.get("technical_notes"),
                    affected_product_areas=item.get("affected_product_areas", []),
                    supporting_signal_ids=supporting,
                    representative_quotes=self._normalize_quotes(item.get("representative_quotes")),
                    confidence=self._coerce_confidence(item.get("confidence"), default_confidence),
                    synthesis_summary=item.get("synthesis_summary"),
                )
            )
        return drafts

    @staticmethod
    def _normalize_quotes(value: object) -> dict[str, str]:
        if not isinstance(value, dict):
            return {}
        normalized: dict[str, str] = {}
        for key, item in value.items():
            text = str(item or "").strip()
            if text:
                normalized[str(key)] = text
        return normalized

    def _retry_reasons_for_cluster(
        self,
        cluster: SignalCluster,
        drafts: list[DraftFeatureRequest],
    ) -> list[str]:
        reasons: list[str] = []
        if not drafts:
            reasons.append("empty_result")
        elif any(
            draft.confidence < settings.SYNTHESIS_RETRY_CONFIDENCE_THRESHOLD for draft in drafts
        ):
            reasons.append("low_confidence")

        if self._is_high_value_cluster(cluster):
            reasons.append("high_value")
        if self._is_ambiguous_cluster(cluster):
            reasons.append("ambiguous")
        return reasons

    @staticmethod
    def _is_high_value_cluster(cluster: SignalCluster) -> bool:
        customer_count = len(
            {
                str(signal.source_metadata.get("customer_company", "")).strip()
                for signal in cluster.signals
                if str(signal.source_metadata.get("customer_company", "")).strip()
            }
        )
        critical_count = sum(1 for signal in cluster.signals if signal.urgency == "critical")
        return (
            len(cluster.signals) >= settings.SYNTHESIS_HIGH_VALUE_SIGNAL_COUNT
            or customer_count >= 3
            or critical_count > 0
        )

    @staticmethod
    def _is_ambiguous_cluster(cluster: SignalCluster) -> bool:
        sentiments = {signal.sentiment for signal in cluster.signals if signal.sentiment}
        urgencies = {signal.urgency for signal in cluster.signals if signal.urgency}
        sources = {signal.source for signal in cluster.signals if signal.source}
        return len(sentiments) >= 3 or len(urgencies) >= 3 or len(sources) >= 3

    @staticmethod
    def _format_cluster_card(cluster: SignalCluster, context: str | None = None) -> str:
        source_counts = Counter(signal.source for signal in cluster.signals)
        urgency_counts = Counter(signal.urgency for signal in cluster.signals)
        sentiment_counts = Counter(signal.sentiment for signal in cluster.signals)
        entity_counts = FeatureExtractor._top_entity_counts(cluster)
        customer_counts = Counter(
            str(signal.source_metadata.get("customer_company", "")).strip()
            for signal in cluster.signals
            if str(signal.source_metadata.get("customer_company", "")).strip()
        )
        representative = FeatureExtractor._representative_signals(cluster)

        lines = []
        if context:
            lines.append(f"TRIGGER CONTEXT:\n{context}")
        lines.extend([
            "CLUSTER CARD",
            f"Cluster ID: {cluster.id}",
            f"Signal count: {len(cluster.signals)}",
            f"Source breakdown: {FeatureExtractor._format_counter(source_counts)}",
            f"Urgency breakdown: {FeatureExtractor._format_counter(urgency_counts)}",
            f"Sentiment breakdown: {FeatureExtractor._format_counter(sentiment_counts)}",
            f"Top entities: {FeatureExtractor._format_ranked_pairs(entity_counts, empty='none')}",
            f"Top affected customers: {FeatureExtractor._format_counter(customer_counts, empty='unknown')}",
            "Representative signals:",
        ])
        for signal in representative:
            customer = (
                str(signal.source_metadata.get("customer_company", "Unknown")).strip() or "Unknown"
            )
            lines.append(
                f"- [{signal.id}] source={signal.source}; urgency={signal.urgency}; "
                f"sentiment={signal.sentiment}; customer={customer}; summary={signal.structured_summary}"
            )
        lines.append("Representative quotes:")
        for signal in representative[:3]:
            lines.append(f'- [{signal.id}] "{signal.structured_summary[:180]}"')
        return "\n".join(lines)

    @staticmethod
    def _format_ungrouped_batch_card(clusters: list[SignalCluster]) -> str:
        lines = ["UNGROUPED SIGNAL CARDS:"]
        for cluster in clusters:
            signal = cluster.signals[0]
            entity_counts = FeatureExtractor._signal_entity_summary(signal.entities)
            customer = (
                str(signal.source_metadata.get("customer_company", "Unknown")).strip() or "Unknown"
            )
            lines.append(
                "\n".join(
                    [
                        f"Signal [{signal.id}]",
                        f"  Source: {signal.source}",
                        f"  Customer: {customer}",
                        f"  Urgency: {signal.urgency}",
                        f"  Sentiment: {signal.sentiment}",
                        f"  Top entities: {entity_counts or 'none'}",
                        f"  Summary: {signal.structured_summary}",
                    ]
                )
            )
        return "\n\n".join(lines)

    @staticmethod
    def _representative_signals(cluster: SignalCluster):
        urgency_rank = {"critical": 3, "high": 2, "medium": 1, "low": 0}
        ordered = sorted(
            cluster.signals,
            key=lambda signal: (
                urgency_rank.get(signal.urgency, 0),
                len(str(signal.source_metadata.get("customer_company", "")).strip()),
                len(signal.structured_summary or ""),
            ),
            reverse=True,
        )
        return ordered[: settings.SYNTHESIS_MAX_REPRESENTATIVE_SIGNALS]

    @staticmethod
    def _top_entity_counts(cluster: SignalCluster) -> list[tuple[str, int]]:
        counts: Counter[str] = Counter()
        for signal in cluster.signals:
            for entity in signal.entities:
                if not isinstance(entity, dict):
                    continue
                entity_type = str(entity.get("type", "")).strip()
                entity_value = str(entity.get("value", "")).strip()
                if not entity_value:
                    continue
                label = f"{entity_type}:{entity_value}" if entity_type else entity_value
                counts[label] += 1
        return counts.most_common(6)

    @staticmethod
    def _signal_entity_summary(entities: list[dict]) -> str:
        counts: Counter[str] = Counter()
        for entity in entities:
            if not isinstance(entity, dict):
                continue
            entity_type = str(entity.get("type", "")).strip()
            entity_value = str(entity.get("value", "")).strip()
            if not entity_value:
                continue
            label = f"{entity_type}:{entity_value}" if entity_type else entity_value
            counts[label] += 1
        return FeatureExtractor._format_ranked_pairs(counts.most_common(4), empty="none")

    @staticmethod
    def _format_counter(counter: Counter[str], *, empty: str = "none") -> str:
        items = [(label, count) for label, count in counter.most_common() if label]
        return FeatureExtractor._format_ranked_pairs(items, empty=empty)

    @staticmethod
    def _format_ranked_pairs(items: list[tuple[str, int]], *, empty: str) -> str:
        if not items:
            return empty
        return ", ".join(f"{label} ({count})" for label, count in items)

    @staticmethod
    def _fallback_from_cluster(cluster: SignalCluster) -> DraftFeatureRequest:
        first = cluster.signals[0]
        title = f"Address recurring feedback from {first.source}"
        problem = "Customers repeatedly report the same pain point across multiple signals."
        solution = (
            "Implement an improvement that addresses the recurring request shown in this cluster."
        )
        return DraftFeatureRequest(
            title=title,
            type="improvement",
            problem_statement=problem,
            proposed_solution=solution,
            user_story="As an end user, I want this issue addressed so that I can complete my workflow.",
            acceptance_criteria=[
                "Pain point is resolved",
                "Users can complete workflow without workaround",
            ],
            technical_notes=None,
            affected_product_areas=["core_product"],
            supporting_signal_ids=cluster.signal_ids,
            representative_quotes={
                sid: cluster.signals[0].structured_summary[:200] for sid in cluster.signal_ids
            },
            confidence=0.45,
        )

    @staticmethod
    def _fallback_from_singleton(cluster: SignalCluster) -> DraftFeatureRequest:
        signal = cluster.signals[0]
        summary = (
            signal.structured_summary or ""
        ).strip() or "A customer reported a specific product need."
        title = summary[:90] if len(summary) > 12 else f"Address request from {signal.source}"

        return DraftFeatureRequest(
            title=title,
            type="improvement",
            problem_statement=summary,
            proposed_solution=f"Implement support for: {summary}",
            user_story=f"As a customer, I want {summary.lower()}",
            acceptance_criteria=[
                "The requested capability in the supporting signal is implemented.",
                "The original customer workflow no longer requires a workaround.",
            ],
            technical_notes=None,
            affected_product_areas=["core_product"],
            supporting_signal_ids=[signal.id],
            representative_quotes={signal.id: summary[:200]},
            confidence=0.35,
        )


feature_extractor = FeatureExtractor()
