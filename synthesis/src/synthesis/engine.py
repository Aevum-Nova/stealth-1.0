from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.feature_request import FeatureRequest, FeatureRequestSignal, SynthesisRun
from src.models.signal import Signal
from src.services.event_bus import get_event_bus
from src.synthesis.clustering import cluster_signals
from src.synthesis.deduplicator import deduplicator
from src.synthesis.engine_types import SignalDigest
from src.synthesis.feature_extractor import DraftFeatureRequest, feature_extractor
from src.synthesis.image_resolver import resolve_images
from src.synthesis.prioritizer import compute_impact_metrics, compute_priority_score, priority_from_score


class SynthesisEngine:
    @staticmethod
    def _coerce_embedding(value: object) -> list[float] | None:
        if value is None:
            return None

        try:
            embedding = [float(v) for v in value]  # type: ignore[union-attr]
        except Exception:
            return None

        return embedding if embedding else None

    @staticmethod
    def _with_fallback_embedding(value: object, dimension: int) -> list[float]:
        embedding = SynthesisEngine._coerce_embedding(value)
        if embedding is not None:
            return embedding
        return [0.0] * max(dimension, 1)

    async def start_run(
        self,
        db: AsyncSession,
        organization_id: str,
        mode: str = "incremental",
        *,
        signal_ids: list[str] | None = None,
        trigger_id: str | None = None,
        event_buffer_id: str | None = None,
        trigger_context: str | None = None,
    ) -> SynthesisRun:
        run = SynthesisRun(
            organization_id=UUID(organization_id),
            trigger_id=UUID(trigger_id) if trigger_id else None,
            event_buffer_id=UUID(event_buffer_id) if event_buffer_id else None,
            status="pending",
            started_at=datetime.now(timezone.utc),
            input_signal_ids=signal_ids or [],
            model="claude-sonnet-4-20250514",
            trigger_context=trigger_context,
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)

        await get_event_bus().publish(
            organization_id,
            "synthesis_started",
            {
                "run_id": str(run.id),
                "signal_count": 0,
                "mode": mode,
                "trigger_id": trigger_id,
                "event_buffer_id": event_buffer_id,
            },
        )
        return run

    async def run(
        self,
        db: AsyncSession,
        organization_id: str,
        run: SynthesisRun,
        mode: str = "incremental",
        *,
        signal_ids: list[str] | None = None,
        trigger_context: str | None = None,
    ) -> None:
        try:
            await self._set_status(db, run, "clustering")
            selected_signal_ids = signal_ids or list(run.input_signal_ids or [])
            effective_context = trigger_context or run.trigger_context
            signals = await self._gather_signals(db, organization_id, mode, selected_signal_ids)
            run.signal_count = len(signals)
            await db.commit()

            if len(signals) < 2:
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc)
                run.feature_request_count = 0
                run.feature_request_ids = []
                await db.commit()
                await get_event_bus().publish(
                    organization_id,
                    "synthesis_completed",
                    {"run_id": str(run.id), "feature_request_count": 0, "feature_request_ids": []},
                )
                return

            fallback_dimension = settings.EMBEDDING_DIMENSION
            for s in signals:
                embedding = self._coerce_embedding(s.embedding)
                if embedding is not None:
                    fallback_dimension = len(embedding)
                    break

            digests: list[SignalDigest] = []
            for s in signals:
                digests.append(
                    SignalDigest(
                        id=str(s.id),
                        structured_summary=s.structured_summary or "",
                        entities=s.entities or [],
                        sentiment=s.sentiment or "neutral",
                        urgency=s.urgency or "low",
                        source=s.source,
                        source_data_type=s.source_data_type,
                        raw_artifact_r2_key=s.raw_artifact_r2_key,
                        source_metadata=s.source_metadata or {},
                        embedding=self._with_fallback_embedding(s.embedding, fallback_dimension),
                    )
                )

            clusters = cluster_signals(digests, similarity_threshold=settings.SYNTHESIS_CLUSTER_THRESHOLD)
            run.cluster_count = len(clusters)
            await db.commit()

            await self._publish_progress(organization_id, run.id, "synthesizing", 40)
            await self._set_status(db, run, "synthesizing")
            drafts = await feature_extractor.extract(clusters, context=effective_context)

            await self._publish_progress(organization_id, run.id, "deduplicating", 60)
            await self._set_status(db, run, "deduplicating")
            drafts = await deduplicator.deduplicate(drafts)

            await self._publish_progress(organization_id, run.id, "prioritizing", 80)
            fr_ids = await self._persist_feature_requests(db, organization_id, run, signals, drafts, mode)

            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            run.feature_request_count = len(fr_ids)
            run.feature_request_ids = fr_ids
            await db.commit()

            await get_event_bus().publish(
                organization_id,
                "synthesis_completed",
                {
                    "run_id": str(run.id),
                    "feature_request_count": len(fr_ids),
                    "feature_request_ids": fr_ids,
                },
            )
        except Exception as exc:
            run.status = "failed"
            run.error = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()
            await get_event_bus().publish(
                organization_id,
                "synthesis_failed",
                {"run_id": str(run.id), "error": str(exc)},
            )
            raise

    async def _set_status(self, db: AsyncSession, run: SynthesisRun, status: str) -> None:
        run.status = status
        await db.commit()

    async def _publish_progress(self, org_id: str, run_id: UUID, status: str, progress: int) -> None:
        await get_event_bus().publish(
            org_id,
            "synthesis_progress",
            {"run_id": str(run_id), "status": status, "progress": progress},
        )

    async def _gather_signals(
        self,
        db: AsyncSession,
        organization_id: str,
        mode: str,
        signal_ids: list[str] | None = None,
    ) -> list[Signal]:
        query = select(Signal).where(
            Signal.organization_id == UUID(organization_id),
            Signal.status == "completed",
        )
        if signal_ids:
            query = query.where(Signal.id.in_([UUID(signal_id) for signal_id in signal_ids]))
            query = query.order_by(Signal.created_at.desc())
            result = await db.execute(query)
            return list(result.scalars().all())
        if mode != "full":
            query = query.where(Signal.synthesized.is_(False))

        query = query.order_by(Signal.created_at.desc()).limit(settings.SYNTHESIS_MAX_SIGNALS)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def _persist_feature_requests(
        self,
        db: AsyncSession,
        organization_id: str,
        run: SynthesisRun,
        signals: list[Signal],
        drafts: list[DraftFeatureRequest],
        mode: str,
    ) -> list[str]:
        if mode == "full":
            await db.execute(
                delete(FeatureRequest).where(
                    FeatureRequest.organization_id == UUID(organization_id),
                    FeatureRequest.status == "draft",
                )
            )

        created_ids: list[str] = []
        async with db.begin_nested():
            for draft in drafts:
                metrics = compute_impact_metrics(draft.supporting_signal_ids, signals)
                score = compute_priority_score(metrics, draft.confidence)
                priority = priority_from_score(score)
                images = resolve_images(draft.supporting_signal_ids, signals)

                evidence = []
                for sig_id in draft.supporting_signal_ids:
                    sig = next((s for s in signals if str(s.id) == sig_id), None)
                    if not sig:
                        continue
                    evidence.append(
                        {
                            "signal_id": str(sig.id),
                            "signal_summary": sig.structured_summary or "",
                            "source": sig.source,
                            "source_data_type": sig.source_data_type,
                            "customer_company": (sig.source_metadata or {}).get("customer_company"),
                            "author_name": (sig.source_metadata or {}).get("author_name"),
                            "representative_quote": draft.representative_quotes.get(
                                str(sig.id),
                                (sig.structured_summary or "")[:220],
                            ),
                            "relevance_score": 1.0,
                        }
                    )

                fr = FeatureRequest(
                    organization_id=UUID(organization_id),
                    title=draft.title,
                    type=draft.type,
                    status="draft",
                    priority=priority,
                    priority_score=score,
                    problem_statement=draft.problem_statement,
                    proposed_solution=draft.proposed_solution,
                    user_story=draft.user_story,
                    acceptance_criteria=draft.acceptance_criteria,
                    technical_notes=draft.technical_notes,
                    affected_product_areas=draft.affected_product_areas,
                    supporting_evidence=evidence,
                    images=[img.model_dump(mode="json") for img in images],
                    impact_metrics=metrics.model_dump(mode="json"),
                    synthesis_run_id=run.id,
                    synthesis_model=run.model,
                    synthesis_confidence=round(draft.confidence * 100),
                )
                db.add(fr)
                await db.flush()
                created_ids.append(str(fr.id))

                for sig_id in draft.supporting_signal_ids:
                    db.add(
                        FeatureRequestSignal(
                            feature_request_id=fr.id,
                            signal_id=UUID(sig_id),
                            relevance_score=100,
                            representative_quote=draft.representative_quotes.get(sig_id),
                        )
                    )

            for signal in signals:
                signal.synthesized = True
                signal.last_synthesized_at = datetime.now(timezone.utc)

        await db.commit()
        return created_ids


synthesis_engine = SynthesisEngine()
