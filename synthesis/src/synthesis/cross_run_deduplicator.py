from __future__ import annotations

from uuid import UUID

import structlog
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.feature_request import FeatureRequest, FeatureRequestSignal
from src.models.signal import Signal
from src.services.embeddings import embedding_service
from src.synthesis.feature_extractor import DraftFeatureRequest
from src.synthesis.prioritizer import (
    compute_impact_metrics,
    compute_priority_score,
    priority_from_score,
)

logger = structlog.get_logger(__name__)


class CrossRunDeduplicator:
    async def deduplicate(
        self,
        db: AsyncSession,
        organization_id: str,
        drafts: list[DraftFeatureRequest],
        signals: list[Signal],
    ) -> tuple[list[DraftFeatureRequest], list[str]]:
        """Compare drafts against existing FRs using vector similarity.

        Returns:
            remaining_drafts: drafts that need new FRs created
            merged_fr_ids: IDs of existing FRs that received merged signals
        """
        if not drafts:
            return [], []

        # Embed all drafts
        for draft in drafts:
            embedding_text = f"{draft.title}. {draft.problem_statement}"
            draft.embedding = await embedding_service.embed(embedding_text)

        # Check if any existing FRs have embeddings
        has_embeddings = await db.execute(
            select(FeatureRequest.id).where(
                FeatureRequest.organization_id == UUID(organization_id),
                FeatureRequest.embedding.isnot(None),
            ).limit(1)
        )
        if has_embeddings.scalar_one_or_none() is None:
            logger.info("cross_run_dedup.no_existing_embeddings", org_id=organization_id)
            return drafts, []

        threshold = settings.SYNTHESIS_FR_DEDUP_THRESHOLD
        remaining: list[DraftFeatureRequest] = []
        merged_fr_ids: list[str] = []
        signals_by_id = {str(s.id): s for s in signals}

        for draft in drafts:
            match = await self._find_nearest(db, organization_id, draft.embedding, threshold)
            if match:
                fr_id, similarity = match
                logger.info(
                    "cross_run_dedup.merge",
                    draft_title=draft.title,
                    target_fr_id=fr_id,
                    similarity=round(similarity, 3),
                )
                await self._merge_into_existing(db, fr_id, draft, signals_by_id)
                if fr_id not in merged_fr_ids:
                    merged_fr_ids.append(fr_id)
            else:
                remaining.append(draft)

        logger.info(
            "cross_run_dedup.result",
            total_drafts=len(drafts),
            merged=len(drafts) - len(remaining),
            new=len(remaining),
        )
        return remaining, merged_fr_ids

    async def _find_nearest(
        self,
        db: AsyncSession,
        organization_id: str,
        draft_embedding: list[float],
        threshold: float,
    ) -> tuple[str, float] | None:
        """Find the nearest existing FR above the similarity threshold."""
        embedding_literal = "[" + ",".join(str(v) for v in draft_embedding) + "]"
        result = await db.execute(
            text(
                """
                SELECT id, 1 - (embedding <=> :embedding::vector) AS similarity
                FROM feature_requests
                WHERE organization_id = :org_id
                  AND status NOT IN ('merged', 'rejected')
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> :embedding::vector
                LIMIT 1
                """
            ),
            {"org_id": UUID(organization_id), "embedding": embedding_literal},
        )
        row = result.first()
        if row and row.similarity >= threshold:
            return str(row.id), float(row.similarity)
        return None

    async def _merge_into_existing(
        self,
        db: AsyncSession,
        fr_id: str,
        draft: DraftFeatureRequest,
        signals_by_id: dict[str, Signal],
    ) -> None:
        """Merge a draft's signals and evidence into an existing FR."""
        fr = await db.get(FeatureRequest, UUID(fr_id))
        if not fr:
            return

        # Merge supporting evidence (dedup by signal_id)
        existing_evidence = fr.supporting_evidence or []
        evidence_by_signal = {item["signal_id"]: item for item in existing_evidence if item.get("signal_id")}
        for sig_id in draft.supporting_signal_ids:
            if sig_id in evidence_by_signal:
                continue
            sig = signals_by_id.get(sig_id)
            if not sig:
                continue
            evidence_by_signal[sig_id] = {
                "signal_id": str(sig.id),
                "signal_summary": sig.structured_summary or "",
                "source": sig.source,
                "source_data_type": sig.source_data_type,
                "customer_company": (sig.source_metadata or {}).get("customer_company"),
                "author_name": (sig.source_metadata or {}).get("author_name"),
                "representative_quote": draft.representative_quotes.get(
                    str(sig.id), (sig.structured_summary or "")[:220]
                ),
                "relevance_score": 1.0,
            }
        fr.supporting_evidence = list(evidence_by_signal.values())

        # Add FeatureRequestSignal links (skip duplicates via unique index)
        for sig_id in draft.supporting_signal_ids:
            existing_link = await db.execute(
                select(FeatureRequestSignal.id).where(
                    FeatureRequestSignal.feature_request_id == fr.id,
                    FeatureRequestSignal.signal_id == UUID(sig_id),
                )
            )
            if existing_link.scalar_one_or_none() is None:
                db.add(
                    FeatureRequestSignal(
                        feature_request_id=fr.id,
                        signal_id=UUID(sig_id),
                        relevance_score=100,
                        representative_quote=draft.representative_quotes.get(sig_id),
                    )
                )

        # Recalculate impact metrics with all linked signals
        all_signal_ids = [item["signal_id"] for item in fr.supporting_evidence if item.get("signal_id")]
        signal_rows = await db.execute(
            select(Signal).where(
                Signal.organization_id == fr.organization_id,
                Signal.id.in_([UUID(sid) for sid in all_signal_ids]),
            )
        )
        all_signals = list(signal_rows.scalars().all())
        metrics = compute_impact_metrics(all_signal_ids, all_signals)
        confidence = (fr.synthesis_confidence or 50) / 100
        score = compute_priority_score(metrics, confidence)

        fr.impact_metrics = metrics.model_dump(mode="json")
        fr.priority_score = score
        fr.priority = priority_from_score(score)

        # Re-embed from canonical text
        embedding_text = f"{fr.title}. {fr.problem_statement}"
        fr.embedding = await embedding_service.embed(embedding_text)

        await db.flush()


cross_run_deduplicator = CrossRunDeduplicator()
