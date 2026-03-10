"""Retrieval service — semantic search over indexed code chunks using pgvector."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from stealth_agent.database import async_session
from stealth_agent.models import CodeChunk, ConnectorRow
from stealth_agent.services.embeddings import embed_text


@dataclass(slots=True)
class RetrievedChunk:
    file_path: str
    start_line: int
    end_line: int
    content: str
    language: str
    score: float


async def retrieve_relevant_chunks(
    query: str,
    connector_id: uuid.UUID,
    organization_id: uuid.UUID,
    top_k: int = 10,
) -> list[RetrievedChunk]:
    """Embed the query and find the top-K most similar code chunks."""
    query_vector = await embed_text(query)

    async with async_session() as db:
        # pgvector cosine distance: <=> returns distance (lower = more similar)
        result = await db.execute(
            text("""
                SELECT file_path, start_line, end_line, content, language,
                       1 - (embedding <=> :query_vec::vector) AS score
                FROM code_chunks
                WHERE connector_id = :cid AND organization_id = :oid
                      AND embedding IS NOT NULL
                ORDER BY embedding <=> :query_vec::vector
                LIMIT :top_k
            """),
            {
                "query_vec": str(query_vector),
                "cid": connector_id,
                "oid": organization_id,
                "top_k": top_k,
            },
        )
        rows = result.all()

    return [
        RetrievedChunk(
            file_path=row[0],
            start_line=row[1],
            end_line=row[2],
            content=row[3],
            language=row[4] or "text",
            score=float(row[5]),
        )
        for row in rows
    ]


async def find_github_connector_for_org(organization_id: str) -> ConnectorRow | None:
    """Find the first enabled GitHub connector for the given org."""
    async with async_session() as db:
        result = await db.execute(
            select(ConnectorRow).where(
                ConnectorRow.organization_id == uuid.UUID(organization_id),
                ConnectorRow.type == "github",
                ConnectorRow.enabled == True,
            )
        )
        return result.scalar_one_or_none()
