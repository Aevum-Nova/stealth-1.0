from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable


class ConflictError(RuntimeError):
    pass


class JobManager:
    def __init__(self, max_concurrent_ingestion: int = 5):
        self._ingestion_semaphore = asyncio.Semaphore(max_concurrent_ingestion)
        self._synthesis_locks: dict[str, asyncio.Lock] = {}

    async def run_ingestion_job(self, _job_id: str, coro: Awaitable[None]) -> None:
        async with self._ingestion_semaphore:
            await coro

    async def run_synthesis(self, org_id: str, _run_id: str, coro: Awaitable[None]) -> None:
        if org_id not in self._synthesis_locks:
            self._synthesis_locks[org_id] = asyncio.Lock()
        lock = self._synthesis_locks[org_id]
        if lock.locked():
            raise ConflictError("Synthesis already running for this organization")
        async with lock:
            await coro

    def is_synthesis_running(self, org_id: str) -> bool:
        lock = self._synthesis_locks.get(org_id)
        return bool(lock and lock.locked())


def spawn_task(func: Callable[[], Awaitable[None]]) -> asyncio.Task:
    return asyncio.create_task(func())


job_manager = JobManager()
