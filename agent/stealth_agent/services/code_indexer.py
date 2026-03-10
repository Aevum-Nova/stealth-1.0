"""Codebase indexing service — fetches repo, chunks, embeds, and stores."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

import structlog

from stealth_agent.adapters.github_repo import GitHubRepoFetcher, RepoFile
from stealth_agent.database import async_session
from stealth_agent.models import CodeChunk, CodeIndexStatus, ConnectorRow
from stealth_agent.services.code_chunker import CodeChunkData, chunk_file
from stealth_agent.services.embeddings import embed_batch

log = structlog.get_logger()


def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def _get_github_connector(db: AsyncSession, connector_id: str, org_id: str) -> ConnectorRow | None:
    result = await db.execute(
        select(ConnectorRow).where(
            ConnectorRow.id == uuid.UUID(connector_id),
            ConnectorRow.organization_id == uuid.UUID(org_id),
            ConnectorRow.type == "github",
        )
    )
    return result.scalar_one_or_none()


async def _get_or_create_status(db: AsyncSession, connector_id: uuid.UUID, org_id: uuid.UUID) -> CodeIndexStatus:
    result = await db.execute(
        select(CodeIndexStatus).where(CodeIndexStatus.connector_id == connector_id)
    )
    status = result.scalar_one_or_none()
    if status is None:
        status = CodeIndexStatus(
            id=uuid.uuid4(),
            connector_id=connector_id,
            organization_id=org_id,
            status="pending",
        )
        db.add(status)
        await db.flush()
    return status


async def _get_existing_hashes(db: AsyncSession, connector_id: uuid.UUID) -> dict[str, set[str]]:
    """Return {file_path: {content_hash, ...}} for existing chunks."""
    result = await db.execute(
        select(CodeChunk.file_path, CodeChunk.content_hash).where(
            CodeChunk.connector_id == connector_id
        )
    )
    hashes: dict[str, set[str]] = {}
    for row in result.all():
        hashes.setdefault(row[0], set()).add(row[1])
    return hashes


async def index_repository(connector_id: str, organization_id: str) -> None:
    """Full indexing pipeline: fetch -> chunk -> embed -> store."""
    async with async_session() as db:
        connector = await _get_github_connector(db, connector_id, organization_id)
        if connector is None:
            log.error("index_connector_not_found", connector_id=connector_id)
            return

        cid = connector.id
        oid = connector.organization_id
        config = connector.config or {}
        creds = connector.credentials or {}

        token = creds.get("access_token", "")
        repo_full = config.get("repository", "")
        branch = config.get("default_branch", "main")

        if not token or not repo_full or "/" not in repo_full:
            log.error("index_missing_config", connector_id=connector_id)
            return

        owner, repo = repo_full.split("/", 1)

        # Mark indexing started
        status_row = await _get_or_create_status(db, cid, oid)
        status_row.status = "indexing"
        status_row.started_at = datetime.now(timezone.utc)
        status_row.error = None
        status_row.completed_at = None
        await db.commit()

        fetcher = GitHubRepoFetcher(token=token, owner=owner, repo=repo)
        try:
            files = await fetcher.fetch_indexable_files(branch)
        except Exception as exc:
            log.error("index_fetch_failed", error=str(exc))
            await _mark_failed(db, cid, str(exc))
            return
        finally:
            await fetcher.close()

        # Update total
        async with async_session() as db2:
            await db2.execute(
                update(CodeIndexStatus)
                .where(CodeIndexStatus.connector_id == cid)
                .values(total_files=len(files))
            )
            await db2.commit()

        # Get existing hashes to skip unchanged content
        async with async_session() as db3:
            existing_hashes = await _get_existing_hashes(db3, cid)

        # Chunk all files
        all_chunks: list[CodeChunkData] = []
        new_hashes: list[str] = []
        for f in files:
            chunks = chunk_file(f.path, f.content)
            for chunk in chunks:
                h = _content_hash(chunk.content)
                if h in existing_hashes.get(chunk.file_path, set()):
                    continue
                all_chunks.append(chunk)
                new_hashes.append(h)

        log.info("index_chunks_to_embed", total_new=len(all_chunks), total_files=len(files))

        if all_chunks:
            # Embed in batches
            texts = [
                f"File: {c.file_path}\nLanguage: {c.language}\n\n{c.content}"
                for c in all_chunks
            ]
            vectors = await embed_batch(texts)

            # Delete stale chunks for files that changed, then insert new ones
            async with async_session() as db4:
                changed_files = {c.file_path for c in all_chunks}
                if changed_files:
                    await db4.execute(
                        delete(CodeChunk).where(
                            CodeChunk.connector_id == cid,
                            CodeChunk.file_path.in_(changed_files),
                        )
                    )

                for chunk, vector, h in zip(all_chunks, vectors, new_hashes):
                    db4.add(CodeChunk(
                        id=uuid.uuid4(),
                        connector_id=cid,
                        organization_id=oid,
                        file_path=chunk.file_path,
                        start_line=chunk.start_line,
                        end_line=chunk.end_line,
                        content=chunk.content,
                        language=chunk.language,
                        content_hash=h,
                        embedding=vector,
                    ))

                await db4.commit()

        # Mark complete
        async with async_session() as db5:
            now = datetime.now(timezone.utc)
            await db5.execute(
                update(CodeIndexStatus)
                .where(CodeIndexStatus.connector_id == cid)
                .values(
                    status="ready",
                    indexed_files=len(files),
                    completed_at=now,
                )
            )
            await db5.commit()

        log.info("index_complete", connector_id=connector_id, files=len(files), chunks=len(all_chunks))


async def _mark_failed(db: AsyncSession, connector_id: uuid.UUID, error: str) -> None:
    await db.execute(
        update(CodeIndexStatus)
        .where(CodeIndexStatus.connector_id == connector_id)
        .values(status="failed", error=error)
    )
    await db.commit()


async def ensure_indexed(connector_id: str, organization_id: str) -> None:
    """Index the repo if it hasn't been indexed yet. No-op if already ready or in progress."""
    status = await get_index_status(connector_id, organization_id)
    if status and status["status"] in ("ready", "indexing"):
        return
    log.info("auto_indexing", connector_id=connector_id)
    await index_repository(connector_id, organization_id)


async def get_index_status(connector_id: str, organization_id: str) -> dict | None:
    async with async_session() as db:
        result = await db.execute(
            select(CodeIndexStatus).where(
                CodeIndexStatus.connector_id == uuid.UUID(connector_id),
                CodeIndexStatus.organization_id == uuid.UUID(organization_id),
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        return {
            "connector_id": str(row.connector_id),
            "status": row.status,
            "total_files": row.total_files,
            "indexed_files": row.indexed_files,
            "commit_sha": row.commit_sha,
            "error": row.error,
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "completed_at": row.completed_at.isoformat() if row.completed_at else None,
        }
