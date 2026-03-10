"""Embedding service for the agent — produces vectors for code chunks and queries."""

from __future__ import annotations

import hashlib
from random import Random

import numpy as np
import structlog

from stealth_agent.config import settings

log = structlog.get_logger()

_voyage_client = None
_openai_client = None


def _get_voyage():
    global _voyage_client
    if _voyage_client is None and settings.VOYAGE_API_KEY:
        from voyageai import AsyncClient as VoyageClient
        _voyage_client = VoyageClient(api_key=settings.VOYAGE_API_KEY)
    return _voyage_client


def _get_openai():
    global _openai_client
    if _openai_client is None and settings.OPENAI_API_KEY:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def _resize_and_normalize(vector: list[float], dim: int) -> list[float]:
    arr = np.asarray(vector, dtype=np.float32).ravel()
    if arr.size > dim:
        arr = arr[:dim]
    elif arr.size < dim:
        padded = np.zeros(dim, dtype=np.float32)
        padded[:arr.size] = arr
        arr = padded
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm
    return arr.tolist()


async def embed_text(text: str) -> list[float]:
    """Embed a single text string and return a normalized vector."""
    dim = settings.EMBEDDING_DIMENSION
    vector: list[float] | None = None

    if settings.EMBEDDING_PROVIDER == "voyage":
        client = _get_voyage()
        if client is not None:
            try:
                resp = await client.embed(texts=[text], model="voyage-code-3")
                vector = resp.embeddings[0]
            except Exception as exc:
                log.warning("voyage_embed_failed", error=str(exc))

    elif settings.EMBEDDING_PROVIDER == "openai":
        client = _get_openai()
        if client is not None:
            try:
                resp = await client.embeddings.create(
                    model="text-embedding-3-small",
                    input=text,
                )
                vector = resp.data[0].embedding
            except Exception as exc:
                log.warning("openai_embed_failed", error=str(exc))

    if vector is None:
        seed = int(hashlib.sha256(text.encode()).hexdigest(), 16)
        rng = Random(seed)
        vector = [rng.random() for _ in range(dim)]

    return _resize_and_normalize(vector, dim)


async def embed_batch(texts: list[str], batch_size: int = 20) -> list[list[float]]:
    """Embed multiple texts, batching API calls."""
    dim = settings.EMBEDDING_DIMENSION
    all_vectors: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        batch_vectors: list[list[float]] = []

        if settings.EMBEDDING_PROVIDER == "voyage":
            client = _get_voyage()
            if client is not None:
                try:
                    resp = await client.embed(texts=batch, model="voyage-code-3")
                    batch_vectors = resp.embeddings
                except Exception as exc:
                    log.warning("voyage_batch_embed_failed", error=str(exc))

        if not batch_vectors and settings.EMBEDDING_PROVIDER == "openai":
            client = _get_openai()
            if client is not None:
                try:
                    resp = await client.embeddings.create(
                        model="text-embedding-3-small",
                        input=batch,
                    )
                    batch_vectors = [d.embedding for d in resp.data]
                except Exception as exc:
                    log.warning("openai_batch_embed_failed", error=str(exc))

        if not batch_vectors:
            for text in batch:
                seed = int(hashlib.sha256(text.encode()).hexdigest(), 16)
                rng = Random(seed)
                batch_vectors.append([rng.random() for _ in range(dim)])

        all_vectors.extend(
            _resize_and_normalize(v, dim) for v in batch_vectors
        )

    return all_vectors
