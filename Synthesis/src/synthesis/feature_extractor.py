from __future__ import annotations

from dataclasses import dataclass, field

from src.services.llm import llm_service
from src.synthesis.clustering import SignalCluster

CLUSTER_EXTRACTION_PROMPT = """You are a senior product manager analyzing customer feedback.
Return JSON: {"feature_requests": [{title,type,problem_statement,proposed_solution,user_story,acceptance_criteria,technical_notes,affected_product_areas,supporting_signal_ids,representative_quotes,confidence}]}.
Return valid JSON only."""

UNGROUPED_EXTRACTION_PROMPT = """Review standalone signals and return actionable feature requests if specific enough.
Return JSON with feature_requests array only."""


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
    async def extract(self, clusters: list[SignalCluster]) -> list[DraftFeatureRequest]:
        drafts: list[DraftFeatureRequest] = []
        for cluster in clusters:
            if len(cluster.signals) < 2:
                continue

            formatted = self._format_cluster(cluster)
            payload = await llm_service.json_completion(CLUSTER_EXTRACTION_PROMPT, formatted)
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
                        confidence=float(item.get("confidence", 0.5)),
                    )
                )

        ungrouped = [c for c in clusters if len(c.signals) == 1]
        for batch in self._chunk(ungrouped, 30):
            payload = await llm_service.json_completion(UNGROUPED_EXTRACTION_PROMPT, self._format_ungrouped(batch))
            for item in (payload.get("feature_requests") if isinstance(payload, dict) else []) or []:
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
                        confidence=float(item.get("confidence", 0.4)),
                    )
                )

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


feature_extractor = FeatureExtractor()
