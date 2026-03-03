from types import SimpleNamespace

import numpy as np

from src.routes.signals import _normalize_query, _rank_signals


def _signal(
    *,
    signal_id: str,
    embedding: list[float] | None,
    structured_summary: str | None = None,
    original_text: str | None = None,
    transcript: str | None = None,
    extracted_text: str | None = None,
):
    return SimpleNamespace(
        id=signal_id,
        embedding=embedding,
        structured_summary=structured_summary,
        original_text=original_text,
        transcript=transcript,
        extracted_text=extracted_text,
    )


def test_normalize_query_collapses_case_and_spaces():
    assert _normalize_query("   Billing   Export   ") == "billing export"


def test_rank_signals_includes_keyword_match_even_with_low_semantic_similarity():
    query_embedding = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    keyword_signal = _signal(
        signal_id="kw",
        embedding=[0.0, 1.0, 0.0],
        original_text="Customers report billing export fails every Friday.",
    )
    unrelated_signal = _signal(
        signal_id="none",
        embedding=[0.0, 1.0, 0.0],
        original_text="Completely unrelated text",
    )

    ranked = _rank_signals(
        [keyword_signal, unrelated_signal],
        query_embedding,
        normalized_query="billing export",
        threshold=0.7,
    )

    assert [signal.id for _, signal in ranked] == ["kw"]
    assert ranked[0][0] == 1.0


def test_rank_signals_still_uses_semantic_similarity():
    query_embedding = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    semantic_signal = _signal(
        signal_id="semantic",
        embedding=[1.0, 0.0, 0.0],
        structured_summary="Unable to save dashboard filters",
    )
    weak_signal = _signal(
        signal_id="weak",
        embedding=[0.3, 0.95, 0.0],
        structured_summary="Unrelated summary",
    )

    ranked = _rank_signals(
        [semantic_signal, weak_signal],
        query_embedding,
        normalized_query="save filter state",
        threshold=0.7,
    )

    assert [signal.id for _, signal in ranked] == ["semantic"]
