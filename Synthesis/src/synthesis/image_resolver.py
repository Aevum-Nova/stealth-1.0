from __future__ import annotations

from src.models.signal import Signal
from src.schemas.feature_request import FeatureRequestImage


def find_signal(signal_id: str, all_signals: list[Signal]) -> Signal | None:
    return next((s for s in all_signals if str(s.id) == signal_id), None)


def find_linked_image_signals(signal: Signal, all_signals: list[Signal]) -> list[Signal]:
    if not signal.source_metadata:
        return []

    return [
        s
        for s in all_signals
        if s.source_data_type == "image"
        and s.id != signal.id
        and s.organization_id == signal.organization_id
        and (
            (
                s.source_metadata
                and s.source_metadata.get("thread_id")
                and s.source_metadata.get("thread_id") == signal.source_metadata.get("thread_id")
            )
            or (
                s.source_metadata
                and s.source_metadata.get("external_id")
                and s.source_metadata.get("external_id") == signal.source_metadata.get("external_id")
            )
        )
    ]


def deduplicate_by_r2_key(images: list[FeatureRequestImage]) -> list[FeatureRequestImage]:
    seen: set[str] = set()
    out: list[FeatureRequestImage] = []
    for image in images:
        if image.r2_key in seen:
            continue
        seen.add(image.r2_key)
        out.append(image)
    return out


def resolve_images(supporting_signal_ids: list[str], all_signals: list[Signal]) -> list[FeatureRequestImage]:
    images: list[FeatureRequestImage] = []

    for signal_id in supporting_signal_ids:
        signal = find_signal(signal_id, all_signals)
        if not signal:
            continue

        if signal.source_data_type == "image":
            images.append(
                FeatureRequestImage(
                    r2_key=signal.raw_artifact_r2_key,
                    signal_id=signal.id,
                    description=signal.extracted_text or signal.structured_summary or "Image evidence",
                    mime_type=signal.raw_artifact_mime_type,
                )
            )

        for img_signal in find_linked_image_signals(signal, all_signals):
            images.append(
                FeatureRequestImage(
                    r2_key=img_signal.raw_artifact_r2_key,
                    signal_id=img_signal.id,
                    description=img_signal.extracted_text
                    or img_signal.structured_summary
                    or "Related image evidence",
                    mime_type=img_signal.raw_artifact_mime_type,
                )
            )

    return deduplicate_by_r2_key(images)
