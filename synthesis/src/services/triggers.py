from __future__ import annotations

import asyncio
import contextlib
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.connectors.base import ConnectorConfig
from src.connectors.catalog import CONNECTOR_CATALOG
from src.connectors.slack import SlackConnector
from src.database import async_session
from src.jobs.manager import ConflictError, job_manager
from src.models.connector import Connector
from src.models.feature_request import FeatureRequest, FeatureRequestSignal, SynthesisRun
from src.models.signal import Signal
from src.models.trigger import EventBuffer, IngestedEvent, Trigger, WebhookSubscription
from src.schemas.trigger import (
    TriggerActivityEvent,
    TriggerBufferConfig,
    TriggerBufferRead,
    TriggerConnectorOption,
    TriggerConnectorSummary,
    TriggerDetail,
    TriggerFeatureRequestLink,
    TriggerMatchConfig,
    TriggerRead,
    TriggerScopeField,
    TriggerScopeOption,
    TriggerStats,
)
from src.services.llm import llm_service
from src.services.signal_builder import signal_builder
from src.synthesis.engine import synthesis_engine
from src.triggers.adapters import TRIGGER_ADAPTERS
from src.triggers.adapters.base import (
    BaseTriggerAdapter,
    NormalizedTriggerEvent,
    ScopeFieldDefinition,
)

import structlog

logger = structlog.get_logger(__name__)

SUPPORTED_TRIGGER_TYPES = set(TRIGGER_ADAPTERS)
DEFAULT_BUFFER_CONFIG = {"time_threshold_minutes": 60, "count_threshold": 10, "min_buffer_minutes": 5}
DEFAULT_MATCH_CONFIG = {"confidence_threshold": 0.7}
CATALOG_BY_TYPE = {item["type"]: item for item in CONNECTOR_CATALOG}


class TriggerService:
    def __init__(self) -> None:
        self._runtime_task: asyncio.Task | None = None
        self._runtime_stop = asyncio.Event()

    async def list_connector_options(self, db: AsyncSession, org_id: str) -> list[TriggerConnectorOption]:
        result = await db.execute(
            select(Connector)
            .where(
                Connector.organization_id == UUID(org_id),
                Connector.type.in_(tuple(SUPPORTED_TRIGGER_TYPES)),
                Connector.enabled.is_(True),
            )
            .order_by(Connector.type.asc(), Connector.created_at.asc())
        )
        connectors = list(result.scalars().all())

        options: list[TriggerConnectorOption] = []
        for connector in connectors:
            adapter = TRIGGER_ADAPTERS.get(connector.type)
            if not adapter:
                continue
            catalog_item = CATALOG_BY_TYPE.get(connector.type, {})
            options.append(
                TriggerConnectorOption(
                    connector_id=connector.id,
                    connector_name=connector.name,
                    plugin_type=connector.type,
                    display_name=catalog_item.get("display_name", connector.type.replace("_", " ").title()),
                    icon=catalog_item.get("icon", connector.type),
                    adapter_kind=adapter.adapter_kind,
                    install_hint=adapter.install_hint,
                    status="connected" if connector.credentials else "needs_attention",
                    scope_fields=self._serialize_scope_fields(adapter.build_scope_fields(connector)),
                )
            )
        return options

    async def list_triggers(self, db: AsyncSession, org_id: str) -> list[TriggerRead]:
        trigger_rows = await db.execute(
            select(Trigger, Connector)
            .join(Connector, Connector.id == Trigger.connector_id)
            .where(Trigger.organization_id == UUID(org_id))
            .order_by(Trigger.created_at.desc())
        )
        pairs = list(trigger_rows.all())
        if not pairs:
            return []

        trigger_ids = [trigger.id for trigger, _ in pairs]
        stats = await self._load_trigger_stats(db, trigger_ids)
        return [self._build_trigger_read(trigger, connector, stats.get(trigger.id, TriggerStats())) for trigger, connector in pairs]

    async def get_trigger_detail(self, db: AsyncSession, org_id: str, trigger_id: UUID) -> TriggerDetail | None:
        row = await db.execute(
            select(Trigger, Connector)
            .join(Connector, Connector.id == Trigger.connector_id)
            .where(Trigger.organization_id == UUID(org_id), Trigger.id == trigger_id)
        )
        pair = row.first()
        if not pair:
            return None
        trigger, connector = pair
        stats = (await self._load_trigger_stats(db, [trigger.id])).get(trigger.id, TriggerStats())
        trigger_read = self._build_trigger_read(trigger, connector, stats)

        event_rows = await db.execute(
            select(IngestedEvent)
            .where(IngestedEvent.trigger_id == trigger.id)
            .order_by(IngestedEvent.created_at.desc())
            .limit(25)
        )
        events = list(event_rows.scalars().all())
        signal_ids = [event.signal_id for event in events if event.signal_id is not None]
        feature_links = await self._load_feature_request_links(db, signal_ids)
        recent_events = [
            TriggerActivityEvent(
                id=event.id,
                external_id=event.external_id,
                match_score=event.match_score,
                processing_status=event.processing_status,
                content_text=str((event.normalized_payload or {}).get("content_text") or ""),
                source_label=self._render_source_label(event.normalized_payload or {}),
                author_name=(event.normalized_payload or {}).get("author", {}).get("name"),
                signal_id=event.signal_id,
                created_at=event.created_at,
                processed_at=event.processed_at,
                feature_requests=feature_links.get(event.signal_id, []),
            )
            for event in events
        ]

        buffer_rows = await db.execute(
            select(EventBuffer, SynthesisRun)
            .outerjoin(SynthesisRun, SynthesisRun.id == EventBuffer.synthesis_run_id)
            .where(EventBuffer.trigger_id == trigger.id)
            .order_by(EventBuffer.buffer_started_at.desc())
            .limit(15)
        )
        recent_buffers = [
            TriggerBufferRead(
                id=buffer.id,
                event_count=buffer.event_count,
                status=buffer.status,
                buffer_started_at=buffer.buffer_started_at,
                last_event_at=buffer.last_event_at,
                dispatched_at=buffer.dispatched_at,
                completed_at=buffer.completed_at,
                synthesis_run_id=buffer.synthesis_run_id,
                feature_request_ids=(run.feature_request_ids if run else []) or [],
                error=buffer.error,
            )
            for buffer, run in buffer_rows.all()
        ]
        return TriggerDetail(trigger=trigger_read, recent_events=recent_events, recent_buffers=recent_buffers)

    async def create_trigger(
        self,
        db: AsyncSession,
        *,
        org_id: str,
        user_id: str | None,
        connector_id: UUID,
        natural_language_description: str,
        scope: dict,
        buffer_config: dict,
        match_config: dict,
        status: str,
        callback_url: str,
    ) -> TriggerRead:
        connector = await self._get_connector(db, org_id, connector_id)
        adapter = self._require_adapter(connector.type)
        clean_scope = self._sanitize_scope(scope, adapter.build_scope_fields(connector))
        trigger = Trigger(
            organization_id=UUID(org_id),
            connector_id=connector.id,
            created_by_user_id=UUID(user_id) if user_id else None,
            plugin_type=connector.type,
            natural_language_description=natural_language_description.strip(),
            scope=clean_scope,
            scope_summary=adapter.summarize_scope(clean_scope, connector),
            status=self._normalize_status(status),
            buffer_config=self._normalize_buffer_config(buffer_config),
            match_config=self._normalize_match_config(match_config),
        )
        db.add(trigger)
        await db.commit()
        await db.refresh(trigger)

        plan = adapter.build_subscription_plan(connector, clean_scope, callback_url)
        db.add(
            WebhookSubscription(
                organization_id=UUID(org_id),
                trigger_id=trigger.id,
                connector_id=connector.id,
                plugin_type=connector.type,
                adapter_kind=plan.adapter_kind,
                external_subscription_id=plan.external_subscription_id,
                callback_url=plan.callback_url,
                subscription_expiry=plan.subscription_expiry,
                scope_config=plan.scope_config,
                subscription_metadata=plan.metadata,
                status="active" if trigger.status == "active" else "paused",
            )
        )
        await db.commit()
        detail = await self.get_trigger_detail(db, org_id, trigger.id)
        assert detail is not None
        return detail.trigger

    async def update_trigger(
        self,
        db: AsyncSession,
        *,
        org_id: str,
        trigger_id: UUID,
        natural_language_description: str | None,
        scope: dict | None,
        buffer_config: dict | None,
        match_config: dict | None,
        status: str | None,
        callback_url: str,
    ) -> TriggerRead | None:
        pair = await db.execute(
            select(Trigger, Connector)
            .join(Connector, Connector.id == Trigger.connector_id)
            .where(Trigger.organization_id == UUID(org_id), Trigger.id == trigger_id)
        )
        result = pair.first()
        if not result:
            return None
        trigger, connector = result
        adapter = self._require_adapter(trigger.plugin_type)

        if natural_language_description is not None:
            trigger.natural_language_description = natural_language_description.strip()
        if scope is not None:
            trigger.scope = self._sanitize_scope(scope, adapter.build_scope_fields(connector))
        if buffer_config is not None:
            trigger.buffer_config = self._normalize_buffer_config(buffer_config)
        if match_config is not None:
            trigger.match_config = self._normalize_match_config(match_config)
        if status is not None:
            trigger.status = self._normalize_status(status)

        trigger.scope_summary = adapter.summarize_scope(trigger.scope or {}, connector)
        await db.commit()

        plan = adapter.build_subscription_plan(connector, trigger.scope or {}, callback_url)
        subs = await db.execute(select(WebhookSubscription).where(WebhookSubscription.trigger_id == trigger.id))
        subscription = subs.scalar_one_or_none()
        if subscription is None:
            subscription = WebhookSubscription(
                organization_id=UUID(org_id),
                trigger_id=trigger.id,
                connector_id=connector.id,
                plugin_type=connector.type,
            )
            db.add(subscription)
        subscription.adapter_kind = plan.adapter_kind
        subscription.external_subscription_id = plan.external_subscription_id
        subscription.callback_url = plan.callback_url
        subscription.subscription_expiry = plan.subscription_expiry
        subscription.scope_config = plan.scope_config
        subscription.subscription_metadata = plan.metadata
        subscription.status = "active" if trigger.status == "active" else "paused"
        await db.commit()

        detail = await self.get_trigger_detail(db, org_id, trigger.id)
        return detail.trigger if detail else None

    async def delete_trigger(self, db: AsyncSession, org_id: str, trigger_id: UUID) -> bool:
        row = await db.execute(select(Trigger).where(Trigger.organization_id == UUID(org_id), Trigger.id == trigger_id))
        trigger = row.scalar_one_or_none()
        if not trigger:
            return False
        await db.delete(trigger)
        await db.commit()
        return True

    async def set_trigger_status(self, db: AsyncSession, org_id: str, trigger_id: UUID, status: str) -> TriggerRead | None:
        row = await db.execute(select(Trigger).where(Trigger.organization_id == UUID(org_id), Trigger.id == trigger_id))
        trigger = row.scalar_one_or_none()
        if not trigger:
            return None
        trigger.status = self._normalize_status(status)
        subs = await db.execute(select(WebhookSubscription).where(WebhookSubscription.trigger_id == trigger.id))
        for subscription in subs.scalars().all():
            subscription.status = "active" if trigger.status == "active" else "paused"
        await db.commit()
        detail = await self.get_trigger_detail(db, org_id, trigger.id)
        return detail.trigger if detail else None

    async def process_webhook(
        self,
        db: AsyncSession,
        *,
        plugin_type: str,
        payload: dict,
        headers: dict[str, str],
    ) -> dict:
        adapter = self._require_adapter(plugin_type)
        normalized_events = adapter.normalize_webhook_payload(payload, headers)
        if not normalized_events:
            logger.info("webhook.empty_normalization", plugin_type=plugin_type)
            return {"received": 0, "matched": 0}

        trigger_rows = await db.execute(
            select(Trigger, Connector)
            .join(Connector, Connector.id == Trigger.connector_id)
            .where(
                Trigger.plugin_type == plugin_type,
                Trigger.status == "active",
                Connector.enabled.is_(True),
            )
        )
        candidates = list(trigger_rows.all())
        if not candidates:
            logger.info(
                "webhook.no_active_triggers",
                plugin_type=plugin_type,
                received=len(normalized_events),
            )
            return {"received": len(normalized_events), "matched": 0}

        logger.info("webhook.processing", plugin_type=plugin_type, events=len(normalized_events), candidates=len(candidates))
        matched = 0
        for normalized in normalized_events:
            for trigger, connector in candidates:
                if not adapter.scope_matches(trigger.scope or {}, normalized):
                    logger.info(
                        "webhook.scope_mismatch",
                        plugin_type=plugin_type,
                        trigger_id=str(trigger.id),
                        trigger_scope=trigger.scope,
                        event_channel=normalized.source_context.get("channel_id"),
                    )
                    continue
                score = await self.semantic_match(trigger, normalized)
                threshold = float((trigger.match_config or {}).get("confidence_threshold", DEFAULT_MATCH_CONFIG["confidence_threshold"]))
                if score < threshold:
                    logger.info(
                        "webhook.below_threshold",
                        plugin_type=plugin_type,
                        score=round(score, 2),
                        threshold=threshold,
                        trigger_id=str(trigger.id),
                    )
                    continue
                created = await self._persist_matched_event(db, trigger, connector, normalized, score)
                matched += int(created)
        logger.info("webhook.result", plugin_type=plugin_type, received=len(normalized_events), matched=matched)
        return {"received": len(normalized_events), "matched": matched}

    async def run_due_buffers_once(self, org_id: str | None = None, trigger_id: UUID | None = None) -> int:
        now = datetime.now(UTC)
        processed = 0
        async with async_session() as db:
            query = (
                select(EventBuffer, Trigger)
                .join(Trigger, Trigger.id == EventBuffer.trigger_id)
                .where(EventBuffer.status == "open", Trigger.status == "active")
                .order_by(EventBuffer.buffer_started_at.asc())
            )
            if org_id:
                query = query.where(EventBuffer.organization_id == UUID(org_id))
            if trigger_id:
                query = query.where(EventBuffer.trigger_id == trigger_id)
            rows = (await db.execute(query)).all()
            for buffer, trigger in rows:
                if job_manager.is_synthesis_running(str(trigger.organization_id)):
                    break
                if not self._buffer_is_due(buffer, trigger, now):
                    continue
                if await self._dispatch_buffer(db, trigger, buffer, now):
                    processed += 1
        return processed

    def start_runtime(self) -> None:
        if self._runtime_task and not self._runtime_task.done():
            return
        self._runtime_stop = asyncio.Event()
        self._runtime_task = asyncio.create_task(self._runtime_loop())

    async def stop_runtime(self) -> None:
        self._runtime_stop.set()
        if self._runtime_task:
            self._runtime_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._runtime_task
            self._runtime_task = None

    async def _runtime_loop(self) -> None:
        while not self._runtime_stop.is_set():
            try:
                await self.run_due_buffers_once()
            except Exception:
                pass
            try:
                await asyncio.wait_for(self._runtime_stop.wait(), timeout=60)
            except TimeoutError:
                continue

    async def semantic_match(self, trigger: Trigger, event: NormalizedTriggerEvent) -> float:
        base_score = self._heuristic_match_score(trigger, event)
        prompt = (
            "Decide whether this event matches the trigger. Return JSON only with keys "
            "match (boolean) and confidence (0 to 1)."
        )
        payload = (
            f"Trigger description:\n{trigger.natural_language_description}\n\n"
            f"Event content:\n{event.content_text}\n\n"
            f"Event context:\n{event.source_context}"
        )
        result = await llm_service.json_completion(prompt, payload, max_tokens=200)
        if isinstance(result, dict) and "confidence" in result:
            confidence = float(result.get("confidence") or 0)
            if not bool(result.get("match", confidence >= 0.7)):
                return min(confidence, base_score)
            return max(base_score, confidence)
        return base_score

    def _heuristic_match_score(self, trigger: Trigger, event: NormalizedTriggerEvent) -> float:
        return 0.8 if len(event.content_text) >= 20 else 0.55

    async def _persist_matched_event(
        self,
        db: AsyncSession,
        trigger: Trigger,
        connector: Connector,
        event: NormalizedTriggerEvent,
        match_score: float,
    ) -> bool:
        existing = await db.execute(
            select(IngestedEvent.id).where(
                IngestedEvent.trigger_id == trigger.id,
                IngestedEvent.external_id == event.external_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            return False

        buffer = await self._get_or_create_open_buffer(db, trigger)
        now = datetime.now(UTC)
        row = IngestedEvent(
            organization_id=trigger.organization_id,
            trigger_id=trigger.id,
            event_buffer_id=buffer.id,
            plugin_type=trigger.plugin_type,
            external_id=event.external_id,
            match_score=match_score,
            processing_status="matched",
            raw_payload=event.raw_payload,
            normalized_payload=event.as_payload(trigger.plugin_type),
            processed_at=now,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)

        raw_text = event.content_text.strip() or str(event.raw_payload)
        signal = await signal_builder.create_pending_signal(
            db,
            organization_id=str(trigger.organization_id),
            source=trigger.plugin_type,
            source_data_type="text",
            raw_bytes=raw_text.encode("utf-8", errors="ignore"),
            mime_type="text/plain",
            filename=f"{trigger.plugin_type}-{event.external_id}.txt",
            metadata={
                "trigger_id": str(trigger.id),
                "ingested_event_id": str(row.id),
                "source_context": event.source_context,
                "author_name": event.author.get("name"),
                "author_email": event.author.get("email"),
                "content_type": event.content_type,
            },
            source_created_at=event.occurred_at,
            trigger_id=str(trigger.id),
            ingested_event_id=str(row.id),
            event_buffer_id=str(buffer.id),
        )

        row.signal_id = signal.id
        trigger.last_event_at = now
        trigger.last_error = None
        buffer.event_ids = [*list(buffer.event_ids or []), str(row.id)]
        buffer.signal_ids = [*list(buffer.signal_ids or []), str(signal.id)]
        buffer.event_count = len(buffer.event_ids)
        buffer.last_event_at = now
        await db.commit()

        asyncio.create_task(self._process_signal_and_reconcile(str(trigger.organization_id), trigger.id, signal.id, raw_text.encode("utf-8", errors="ignore")))
        asyncio.create_task(self._acknowledge_in_source(connector, event))
        return True

    async def _acknowledge_in_source(self, connector: Connector, event: NormalizedTriggerEvent) -> None:
        """Best-effort acknowledgement in the source platform."""
        if connector.type != "slack":
            return
        try:
            slack = SlackConnector(ConnectorConfig(
                id=str(connector.id),
                organization_id=str(connector.organization_id),
                type=connector.type,
                credentials=connector.credentials or {},
                config=connector.config or {},
            ))
            channel_id = event.source_context.get("channel_id", "")
            raw_event = event.raw_payload.get("event") or event.raw_payload
            ts = raw_event.get("ts", "")
            if channel_id and ts:
                await slack.acknowledge_message(channel_id, ts)
        except Exception:
            logger.debug("webhook.acknowledge_failed", plugin_type="slack", exc_info=True)

    async def _process_signal_and_reconcile(self, org_id: str, trigger_id: UUID, signal_id: UUID, raw_bytes: bytes) -> None:
        async with async_session() as db:
            try:
                await signal_builder.process_signal(db, str(signal_id), raw_bytes)
            finally:
                await self.run_due_buffers_once(org_id=org_id, trigger_id=trigger_id)

    async def _dispatch_buffer(self, db: AsyncSession, trigger: Trigger, buffer: EventBuffer, now: datetime) -> bool:
        signal_ids = [UUID(value) for value in (buffer.signal_ids or [])]
        if not signal_ids:
            buffer.status = "completed"
            buffer.completed_at = now
            buffer.error = "Buffer had no signals to synthesize."
            await db.commit()
            return True

        completed_signal_ids = await self._wait_for_completed_signals(signal_ids)
        if not completed_signal_ids:
            return False

        run = await synthesis_engine.start_run(
            db,
            str(trigger.organization_id),
            mode="trigger",
            signal_ids=[str(value) for value in completed_signal_ids],
            trigger_id=str(trigger.id),
            event_buffer_id=str(buffer.id),
            trigger_context=trigger.natural_language_description,
        )
        buffer.status = "dispatching"
        buffer.dispatched_at = now
        buffer.synthesis_run_id = run.id
        trigger.last_dispatch_at = now
        await db.commit()

        async def _runner() -> None:
            async with async_session() as session:
                run_row = await session.get(SynthesisRun, run.id)
                buffer_row = await session.get(EventBuffer, buffer.id)
                trigger_row = await session.get(Trigger, trigger.id)
                if not run_row or not buffer_row or not trigger_row:
                    return
                try:
                    await job_manager.run_synthesis(
                        str(trigger.organization_id),
                        str(run.id),
                        synthesis_engine.run(
                            session,
                            str(trigger.organization_id),
                            run_row,
                            mode="trigger",
                            signal_ids=[str(value) for value in completed_signal_ids],
                            trigger_context=trigger_row.natural_language_description,
                        ),
                    )
                    await session.refresh(run_row)
                    buffer_row.status = "completed"
                    buffer_row.completed_at = datetime.now(UTC)
                    buffer_row.error = None
                    await session.commit()
                except ConflictError:
                    buffer_row.status = "open"
                    buffer_row.dispatched_at = None
                    buffer_row.synthesis_run_id = None
                    await session.commit()
                except Exception as exc:
                    buffer_row.status = "failed"
                    buffer_row.completed_at = datetime.now(UTC)
                    buffer_row.error = str(exc)
                    trigger_row.last_error = str(exc)
                    await session.commit()

        asyncio.create_task(_runner())
        return True

    async def _wait_for_completed_signals(self, signal_ids: list[UUID]) -> list[UUID]:
        deadline = datetime.now(UTC) + timedelta(seconds=45)
        while datetime.now(UTC) < deadline:
            async with async_session() as db:
                rows = await db.execute(select(Signal.id, Signal.status).where(Signal.id.in_(signal_ids)))
                states = {signal_id: status for signal_id, status in rows.all()}
            if states and all(status not in {"pending", "processing"} for status in states.values()):
                return [signal_id for signal_id, status in states.items() if status == "completed"]
            await asyncio.sleep(1)
        return []

    async def _get_connector(self, db: AsyncSession, org_id: str, connector_id: UUID) -> Connector:
        row = await db.execute(
            select(Connector).where(Connector.organization_id == UUID(org_id), Connector.id == connector_id)
        )
        connector = row.scalar_one_or_none()
        if connector is None:
            raise ValueError("Connector not found")
        if connector.type not in SUPPORTED_TRIGGER_TYPES:
            raise ValueError(f"Connector type '{connector.type}' is not supported for triggers")
        return connector

    def _require_adapter(self, plugin_type: str) -> BaseTriggerAdapter:
        adapter = TRIGGER_ADAPTERS.get(plugin_type)
        if adapter is None:
            raise ValueError(f"Unsupported trigger plugin type: {plugin_type}")
        return adapter

    def _sanitize_scope(self, scope: dict, fields: list[ScopeFieldDefinition]) -> dict:
        allowed = {field.key for field in fields}
        clean: dict[str, list[str] | str] = {}
        for key, value in (scope or {}).items():
            if key not in allowed:
                continue
            if isinstance(value, list):
                clean[key] = [str(item) for item in value if str(item).strip()]
            elif value not in (None, ""):
                clean[key] = str(value)
        return clean

    def _normalize_buffer_config(self, value: dict | None) -> dict:
        merged = {**DEFAULT_BUFFER_CONFIG, **(value or {})}
        merged["time_threshold_minutes"] = max(1, int(merged.get("time_threshold_minutes", 60)))
        merged["count_threshold"] = max(1, int(merged.get("count_threshold", 10)))
        merged["min_buffer_minutes"] = max(0, int(merged.get("min_buffer_minutes", 5)))
        return merged

    def _normalize_match_config(self, value: dict | None) -> dict:
        merged = {**DEFAULT_MATCH_CONFIG, **(value or {})}
        confidence = float(merged.get("confidence_threshold", 0.7))
        merged["confidence_threshold"] = max(0.1, min(0.99, confidence))
        return merged

    @staticmethod
    def _normalize_status(status: str | None) -> str:
        return status if status in {"active", "paused", "error"} else "active"

    async def _get_or_create_open_buffer(self, db: AsyncSession, trigger: Trigger) -> EventBuffer:
        row = await db.execute(
            select(EventBuffer)
            .where(EventBuffer.trigger_id == trigger.id, EventBuffer.status == "open")
            .order_by(EventBuffer.buffer_started_at.desc())
        )
        buffer = row.scalar_one_or_none()
        if buffer is not None:
            return buffer
        buffer = EventBuffer(
            organization_id=trigger.organization_id,
            trigger_id=trigger.id,
            event_ids=[],
            signal_ids=[],
            event_count=0,
            status="open",
            buffer_started_at=datetime.now(UTC),
        )
        db.add(buffer)
        await db.commit()
        await db.refresh(buffer)
        return buffer

    def _buffer_is_due(self, buffer: EventBuffer, trigger: Trigger, now: datetime) -> bool:
        config = {**DEFAULT_BUFFER_CONFIG, **(trigger.buffer_config or {})}
        started_at = buffer.buffer_started_at or buffer.created_at or now
        age_minutes = (now - started_at).total_seconds() / 60
        count_ready = buffer.event_count >= int(config["count_threshold"]) and age_minutes >= int(config["min_buffer_minutes"])
        time_ready = age_minutes >= int(config["time_threshold_minutes"])
        return count_ready or time_ready

    async def _load_trigger_stats(self, db: AsyncSession, trigger_ids: list[UUID]) -> dict[UUID, TriggerStats]:
        stats: dict[UUID, TriggerStats] = {trigger_id: TriggerStats() for trigger_id in trigger_ids}
        since = datetime.now(UTC) - timedelta(hours=24)

        recent = await db.execute(
            select(IngestedEvent.trigger_id, func.count(IngestedEvent.id))
            .where(
                IngestedEvent.trigger_id.in_(trigger_ids),
                IngestedEvent.created_at >= since,
            )
            .group_by(IngestedEvent.trigger_id)
        )
        for trigger_id, count in recent.all():
            if trigger_id:
                stats[trigger_id].matched_events_last_24h = int(count or 0)

        buffers = await db.execute(
            select(EventBuffer.trigger_id, func.coalesce(func.sum(EventBuffer.event_count), 0))
            .where(EventBuffer.trigger_id.in_(trigger_ids), EventBuffer.status == "open")
            .group_by(EventBuffer.trigger_id)
        )
        for trigger_id, count in buffers.all():
            if trigger_id:
                stats[trigger_id].open_buffer_events = int(count or 0)

        features = await db.execute(
            select(Signal.trigger_id, func.count(func.distinct(FeatureRequestSignal.feature_request_id)))
            .join(FeatureRequestSignal, FeatureRequestSignal.signal_id == Signal.id)
            .where(Signal.trigger_id.in_(trigger_ids))
            .group_by(Signal.trigger_id)
        )
        for trigger_id, count in features.all():
            if trigger_id:
                stats[trigger_id].feature_request_count = int(count or 0)

        return stats

    def _build_trigger_read(self, trigger: Trigger, connector: Connector, stats: TriggerStats) -> TriggerRead:
        catalog_item = CATALOG_BY_TYPE.get(connector.type, {})
        return TriggerRead(
            id=trigger.id,
            connector=TriggerConnectorSummary(
                id=connector.id,
                name=connector.name,
                type=connector.type,
                display_name=catalog_item.get("display_name", connector.type.replace("_", " ").title()),
                icon=catalog_item.get("icon", connector.type),
            ),
            plugin_type=trigger.plugin_type,
            natural_language_description=trigger.natural_language_description,
            parsed_filter_criteria=trigger.parsed_filter_criteria or {},
            scope=trigger.scope or {},
            scope_summary=trigger.scope_summary,
            status=trigger.status,
            buffer_config=TriggerBufferConfig(**self._normalize_buffer_config(trigger.buffer_config or {})),
            match_config=TriggerMatchConfig(**self._normalize_match_config(trigger.match_config or {})),
            stats=stats,
            last_event_at=trigger.last_event_at,
            last_dispatch_at=trigger.last_dispatch_at,
            last_error=trigger.last_error,
            created_at=trigger.created_at,
            updated_at=trigger.updated_at,
        )

    @staticmethod
    def _serialize_scope_fields(fields: list[ScopeFieldDefinition]) -> list[TriggerScopeField]:
        return [
            TriggerScopeField(
                key=field.key,
                label=field.label,
                type=field.field_type,
                multiple=field.multiple,
                required=field.required,
                help=field.help,
                options=[
                    TriggerScopeOption(label=option.label, value=option.value, description=option.description)
                    for option in field.options
                ],
            )
            for field in fields
        ]

    async def _load_feature_request_links(
        self, db: AsyncSession, signal_ids: list[UUID | None]
    ) -> dict[UUID | None, list[TriggerFeatureRequestLink]]:
        ids = [signal_id for signal_id in signal_ids if signal_id is not None]
        if not ids:
            return {}
        rows = await db.execute(
            select(FeatureRequestSignal.signal_id, FeatureRequest.id, FeatureRequest.title)
            .join(FeatureRequest, FeatureRequest.id == FeatureRequestSignal.feature_request_id)
            .where(FeatureRequestSignal.signal_id.in_(ids))
        )
        links: dict[UUID | None, list[TriggerFeatureRequestLink]] = defaultdict(list)
        for signal_id, feature_request_id, title in rows.all():
            links[signal_id].append(TriggerFeatureRequestLink(id=feature_request_id, title=title))
        return links

    @staticmethod
    def _render_source_label(normalized_payload: dict) -> str:
        context = normalized_payload.get("source_context") or {}
        if context.get("channel_id"):
            return f"Channel {context['channel_id']}"
        if context.get("form_id"):
            return f"Form {context['form_id']}"
        if context.get("file_key"):
            return f"File {context['file_key']}"
        if context.get("conversation_id"):
            return f"Conversation {context['conversation_id']}"
        if context.get("ticket_id"):
            return f"Ticket {context['ticket_id']}"
        if context.get("team_id") and context.get("channel_id"):
            return f"Team {context['team_id']} / Channel {context['channel_id']}"
        return "Matched event"


trigger_service = TriggerService()
