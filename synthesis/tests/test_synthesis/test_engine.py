from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.synthesis.engine import SynthesisEngine


def test_coerce_embedding_accepts_numpy_array():
    np = __import__("numpy")
    value = np.array([0.1, 0.2, 0.3], dtype=np.float32)

    embedding = SynthesisEngine._coerce_embedding(value)

    assert embedding == pytest.approx([0.1, 0.2, 0.3])


def test_coerce_embedding_rejects_invalid_values():
    assert SynthesisEngine._coerce_embedding(None) is None
    assert SynthesisEngine._coerce_embedding([]) is None
    assert SynthesisEngine._coerce_embedding("not-a-vector") is None


def test_with_fallback_embedding_preserves_valid_embedding():
    embedding = SynthesisEngine._with_fallback_embedding([0.4, 0.5], 1536)
    assert embedding == pytest.approx([0.4, 0.5])


def test_with_fallback_embedding_generates_zero_vector():
    embedding = SynthesisEngine._with_fallback_embedding(None, 3)
    assert embedding == [0.0, 0.0, 0.0]


@pytest.mark.asyncio
async def test_delete_existing_draft_feature_requests_cleans_dependents():
    db = AsyncMock()

    await SynthesisEngine()._delete_existing_draft_feature_requests(
        db, "00000000-0000-0000-0000-000000000123"
    )

    assert db.execute.await_count == 6


@pytest.mark.asyncio
async def test_run_rolls_back_before_marking_failure(monkeypatch):
    engine = SynthesisEngine()
    db = AsyncMock()
    run = SimpleNamespace(
        id=uuid4(),
        status="pending",
        error=None,
        completed_at=None,
    )
    failed_run = SimpleNamespace(
        id=run.id,
        status="pending",
        error=None,
        completed_at=None,
    )
    db.get.return_value = failed_run
    publish = AsyncMock()

    async def _boom(*args, **kwargs):
        _ = args, kwargs
        raise RuntimeError("boom")

    monkeypatch.setattr(engine, "_set_status", _boom)
    monkeypatch.setattr("src.synthesis.engine.get_event_bus", lambda: SimpleNamespace(publish=publish))

    with pytest.raises(RuntimeError, match="boom"):
        await engine.run(db, "00000000-0000-0000-0000-000000000123", run, mode="incremental")

    db.rollback.assert_awaited_once()
    db.get.assert_awaited_once()
    assert failed_run.status == "failed"
    assert failed_run.error == "boom"
    publish.assert_awaited()
