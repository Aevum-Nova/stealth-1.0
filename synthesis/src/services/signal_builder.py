from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.signal import Signal
from src.processors.audio import audio_processor
from src.processors.image import image_processor
from src.processors.text import text_processor
from src.services.event_bus import get_event_bus
from src.services.r2 import r2_service


class SignalBuilder:
    async def create_pending_signal(
        self,
        db: AsyncSession,
        *,
        organization_id: str,
        source: str,
        source_data_type: str,
        raw_bytes: bytes,
        mime_type: str,
        filename: str,
        metadata: dict | None = None,
        source_created_at: datetime | None = None,
    ) -> Signal:
        signal_id = uuid4()
        key = f"{organization_id}/{signal_id}/{filename}"
        upload = await r2_service.upload(key=key, body=raw_bytes, content_type=mime_type)

        signal = Signal(
            id=signal_id,
            status="pending",
            source=source,
            source_data_type=source_data_type,
            raw_artifact_r2_key=upload["key"],
            raw_artifact_mime_type=mime_type,
            raw_artifact_size_bytes=upload["size"],
            source_metadata=metadata or {},
            organization_id=UUID(str(organization_id)),
            source_created_at=source_created_at,
        )

        if source_data_type == "text":
            try:
                signal.original_text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                signal.original_text = raw_bytes.decode("utf-8", errors="ignore")

        db.add(signal)
        await db.commit()
        await db.refresh(signal)
        return signal

    async def process_signal(
        self,
        db: AsyncSession,
        signal_id: str,
        raw_content: bytes,
        *,
        job_id: str | None = None,
    ) -> Signal:
        result = await db.execute(select(Signal).where(Signal.id == UUID(signal_id)))
        signal = result.scalar_one_or_none()
        if not signal:
            raise ValueError(f"Signal {signal_id} not found")

        org_id = str(signal.organization_id)
        signal.status = "processing"
        signal.processing_started_at = datetime.now(timezone.utc)
        await db.commit()

        try:
            if signal.source_data_type == "text":
                payload = await text_processor.process(raw_content.decode("utf-8", errors="ignore"))
            elif signal.source_data_type == "audio":
                payload = await audio_processor.process(raw_content)
            elif signal.source_data_type == "image":
                payload = await image_processor.process(raw_content, signal.raw_artifact_mime_type)
            else:
                raise ValueError(f"Unsupported source_data_type: {signal.source_data_type}")

            signal.original_text = payload.get("original_text", signal.original_text)
            signal.transcript = payload.get("transcript")
            signal.extracted_text = payload.get("extracted_text")
            signal.structured_summary = payload.get("structured_summary")
            signal.entities = payload.get("entities", [])
            signal.sentiment = payload.get("sentiment")
            signal.urgency = payload.get("urgency")
            signal.embedding = payload.get("embedding")
            signal.status = "completed"
            signal.processing_error = None
            signal.processing_completed_at = datetime.now(timezone.utc)
            await db.commit()

            await get_event_bus().publish(
                org_id,
                "signal_processed",
                {
                    "signal_id": str(signal.id),
                    "status": signal.status,
                    "source": signal.source,
                    "job_id": job_id,
                },
            )
            return signal
        except Exception as exc:
            await db.rollback()
            failed_result = await db.execute(select(Signal).where(Signal.id == UUID(signal_id)))
            failed_signal = failed_result.scalar_one_or_none()
            if failed_signal is not None:
                failed_signal.status = "failed"
                failed_signal.processing_error = str(exc)
                failed_signal.processing_completed_at = datetime.now(timezone.utc)
                await db.commit()

            await get_event_bus().publish(
                org_id,
                "signal_failed",
                {
                    "signal_id": signal_id,
                    "error": str(exc),
                    "job_id": job_id,
                },
            )
            raise


signal_builder = SignalBuilder()
