from __future__ import annotations

import hashlib
import logging
from random import Random

import numpy as np
from openai import AsyncOpenAI
from voyageai import AsyncClient as VoyageClient

from src.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self) -> None:
        self._voyage = VoyageClient(api_key=settings.VOYAGE_API_KEY) if settings.VOYAGE_API_KEY else None
        self._openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

    @staticmethod
    def _resize_and_normalize(vector: list[float], target_dimension: int) -> list[float]:
        arr = np.asarray(vector, dtype=np.float32).reshape(-1)

        if arr.size > target_dimension:
            arr = arr[:target_dimension]
        elif arr.size < target_dimension:
            padded = np.zeros(target_dimension, dtype=np.float32)
            padded[: arr.size] = arr
            arr = padded

        norm = np.linalg.norm(arr)
        if norm == 0:
            return arr.tolist()
        return (arr / norm).tolist()

    async def embed(self, text: str) -> list[float]:
        vector: list[float] | None = None

        if settings.EMBEDDING_PROVIDER == "voyage" and self._voyage is not None:
            try:
                response = await self._voyage.embed(texts=[text], model="voyage-3-large")
                vector = response.embeddings[0]
            except Exception as exc:
                logger.warning(
                    "Voyage embedding request failed; falling back to deterministic embedding: %s",
                    exc,
                )

        elif settings.EMBEDDING_PROVIDER == "openai" and self._openai is not None:
            try:
                response = await self._openai.embeddings.create(
                    model="text-embedding-3-small",
                    input=text,
                )
                vector = response.data[0].embedding
            except Exception as exc:
                logger.warning(
                    "OpenAI embedding request failed; falling back to deterministic embedding: %s",
                    exc,
                )

        if vector is None:
            # Deterministic fallback for local dev and tests.
            seed = int(hashlib.sha256(text.encode()).hexdigest(), 16)
            rng = Random(seed)
            vector = [rng.random() for _ in range(settings.EMBEDDING_DIMENSION)]

        return self._resize_and_normalize(vector, settings.EMBEDDING_DIMENSION)


embedding_service = EmbeddingService()
