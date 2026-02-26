from __future__ import annotations

from collections import OrderedDict

from src.synthesis.feature_extractor import DraftFeatureRequest


class Deduplicator:
    async def deduplicate(self, drafts: list[DraftFeatureRequest]) -> list[DraftFeatureRequest]:
        deduped: OrderedDict[str, DraftFeatureRequest] = OrderedDict()
        for draft in drafts:
            key = " ".join(draft.title.lower().split())
            if key not in deduped:
                deduped[key] = draft
                continue

            existing = deduped[key]
            merged_ids = list(dict.fromkeys(existing.supporting_signal_ids + draft.supporting_signal_ids))
            merged_quotes = {**existing.representative_quotes, **draft.representative_quotes}
            existing.supporting_signal_ids = merged_ids
            existing.representative_quotes = merged_quotes
            existing.confidence = max(existing.confidence, draft.confidence)

        return list(deduped.values())


deduplicator = Deduplicator()
