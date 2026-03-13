from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.routes.synthesis import _count_active_runs, _reconcile_stale_runs


@pytest.mark.asyncio
async def test_reconcile_stale_runs_marks_old_inactive_run_failed(monkeypatch):
    stale_run = SimpleNamespace(
        id=uuid4(),
        status="deduplicating",
        started_at=datetime.now(UTC) - timedelta(minutes=5),
        created_at=datetime.now(UTC) - timedelta(minutes=5),
        completed_at=None,
        error=None,
    )
    db = AsyncMock()
    db.execute.side_effect = [
        SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [stale_run])),
    ]
    bus = AsyncMock()

    monkeypatch.setattr("src.routes.synthesis.job_manager.is_synthesis_running", lambda org_id: False)
    monkeypatch.setattr("src.routes.synthesis.get_event_bus", lambda: bus)

    await _reconcile_stale_runs(db, "00000000-0000-0000-0000-000000000123")

    assert stale_run.status == "failed"
    assert stale_run.completed_at is not None
    assert "no longer running" in (stale_run.error or "")
    db.commit.assert_awaited_once()
    assert bus.publish.await_count == 2


@pytest.mark.asyncio
async def test_reconcile_stale_runs_keeps_latest_run_when_worker_is_active(monkeypatch):
    fresh_run = SimpleNamespace(
        id=uuid4(),
        status="synthesizing",
        started_at=datetime.now(UTC) - timedelta(seconds=10),
        created_at=datetime.now(UTC) - timedelta(seconds=10),
        completed_at=None,
        error=None,
    )
    older_run = SimpleNamespace(
        id=uuid4(),
        status="deduplicating",
        started_at=datetime.now(UTC) - timedelta(minutes=4),
        created_at=datetime.now(UTC) - timedelta(minutes=4),
        completed_at=None,
        error=None,
    )
    db = AsyncMock()
    db.execute.side_effect = [
        SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [fresh_run, older_run])),
    ]
    bus = AsyncMock()

    monkeypatch.setattr("src.routes.synthesis.job_manager.is_synthesis_running", lambda org_id: True)
    monkeypatch.setattr("src.routes.synthesis.get_event_bus", lambda: bus)

    await _reconcile_stale_runs(db, "00000000-0000-0000-0000-000000000123")

    assert fresh_run.status == "synthesizing"
    assert older_run.status == "failed"
    db.commit.assert_awaited_once()
    assert bus.publish.await_count == 2


@pytest.mark.asyncio
async def test_count_active_runs_counts_only_non_terminal_statuses():
    db = AsyncMock()
    db.execute.return_value = SimpleNamespace(scalar_one=lambda: 2)

    count = await _count_active_runs(db, "00000000-0000-0000-0000-000000000123")

    assert count == 2
