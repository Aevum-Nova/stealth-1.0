from __future__ import annotations

from dataclasses import dataclass, field

from src.services.llm import llm_service
from src.synthesis.clustering import SignalCluster

CLUSTER_EXTRACTION_PROMPT = """You are a senior product manager analyzing customer feedback.
Return JSON: {"feature_requests": [{title,type,problem_statement,proposed_solution,user_story,acceptance_criteria,technical_notes,affected_product_areas,supporting_signal_ids,representative_quotes,confidence}]}.
The confidence field must be a number between 0 and 1.
Return valid JSON only."""

UNGROUPED_EXTRACTION_PROMPT = """Review standalone signals and return actionable feature requests if specific enough.
Return JSON with feature_requests array only.
The confidence field must be a number between 0 and 1."""

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

    async def extract(self, clusters: list[SignalCluster]) -> list[DraftFeatureRequest]:
        drafts: list[DraftFeatureRequest] = []
        for cluster in clusters:
            if len(cluster.signals) < 2:
                continue

            formatted = self._format_cluster(cluster)
            payload = await llm_service.json_completion(
                CLUSTER_EXTRACTION_PROMPT,
                formatted,
                schema=FEATURE_REQUESTS_SCHEMA,
            )
            items = payload.get("feature_requests") if isinstance(payload, dict) else None
            if not items:
                drafts.append(self._fallback_from_cluster(cluster))
                continue

            for item in items:
                supporting = item.get("supporting_signal_ids") or cluster.signal_ids
                if len(supporting) < 2:
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
                        representative_quotes=item.get("representative_quotes", {}),
                        confidence=self._coerce_confidence(item.get("confidence"), 0.5),
                    )
                )

        ungrouped = [c for c in clusters if len(c.signals) == 1]
        for batch in self._chunk(ungrouped, 30):
            payload = await llm_service.json_completion(
                UNGROUPED_EXTRACTION_PROMPT,
                self._format_ungrouped(batch),
                schema=FEATURE_REQUESTS_SCHEMA,
            )
            batch_items = (payload.get("feature_requests") if isinstance(payload, dict) else []) or []
            created_from_batch = 0
            for item in batch_items:
                supporting = item.get("supporting_signal_ids") or []
                if not supporting:
                    continue
                drafts.append(
                    DraftFeatureRequest(
                        title=item.get("title", "Standalone request"),
                        type=item.get("type", "improvement"),
                        problem_statement=item.get("problem_statement", ""),
                        proposed_solution=item.get("proposed_solution", ""),
                        user_story=item.get("user_story", ""),
                        acceptance_criteria=item.get("acceptance_criteria", []),
                        technical_notes=item.get("technical_notes"),
                        affected_product_areas=item.get("affected_product_areas", []),
                        supporting_signal_ids=supporting,
                        representative_quotes=item.get("representative_quotes", {}),
                        confidence=self._coerce_confidence(item.get("confidence"), 0.4),
                    )
                )
                created_from_batch += 1

            # If the LLM returns nothing for ungrouped signals, keep each signal
            # as a separate fallback request to avoid merging unrelated asks.
            if created_from_batch == 0 and len(batch) > 0:
                drafts.extend(self._fallback_from_singleton(c) for c in batch)

        return drafts

    @staticmethod
    def _chunk(items: list[SignalCluster], size: int) -> list[list[SignalCluster]]:
        return [items[i : i + size] for i in range(0, len(items), size)]

    @staticmethod
    def _format_cluster(cluster: SignalCluster) -> str:
        lines = [f"CLUSTER SIGNALS ({len(cluster.signals)} signals):"]
        for s in cluster.signals:
            lines.append(
                f"Signal [{s.id}]:\n"
                f"  Source: {s.source}\n"
                f"  Summary: {s.structured_summary}\n"
                f"  Entities: {s.entities}\n"
                f"  Sentiment: {s.sentiment}\n"
                f"  Urgency: {s.urgency}\n"
                f"  Customer: {s.source_metadata.get('customer_company', 'Unknown')}"
            )
        return "\n\n".join(lines)

    @staticmethod
    def _format_ungrouped(clusters: list[SignalCluster]) -> str:
        lines = ["UNGROUPED SIGNALS:"]
        for c in clusters:
            s = c.signals[0]
            lines.append(f"Signal [{s.id}]\nSummary: {s.structured_summary}\nEntities: {s.entities}")
        return "\n\n".join(lines)

    @staticmethod
    def _fallback_from_cluster(cluster: SignalCluster) -> DraftFeatureRequest:
        first = cluster.signals[0]
        title = f"Address recurring feedback from {first.source}"
        problem = "Customers repeatedly report the same pain point across multiple signals."
        solution = "Implement an improvement that addresses the recurring request shown in this cluster."
        return DraftFeatureRequest(
            title=title,
            type="improvement",
            problem_statement=problem,
            proposed_solution=solution,
            user_story="As an end user, I want this issue addressed so that I can complete my workflow.",
            acceptance_criteria=["Pain point is resolved", "Users can complete workflow without workaround"],
            technical_notes=None,
            affected_product_areas=["core_product"],
            supporting_signal_ids=cluster.signal_ids,
            representative_quotes={sid: cluster.signals[0].structured_summary[:200] for sid in cluster.signal_ids},
            confidence=0.45,
        )

    @staticmethod
    def _fallback_from_singleton(cluster: SignalCluster) -> DraftFeatureRequest:
        signal = cluster.signals[0]
        summary = (signal.structured_summary or "").strip() or "A customer reported a specific product need."
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
