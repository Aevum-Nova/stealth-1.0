import math

import pytest

from src.services.embeddings import EmbeddingService


def test_resize_and_normalize_pads_short_vector():
    resized = EmbeddingService._resize_and_normalize([1.0] * 4, target_dimension=8)

    assert len(resized) == 8
    assert resized[4:] == [0.0, 0.0, 0.0, 0.0]
    assert math.isclose(sum(v * v for v in resized), 1.0, rel_tol=1e-5)


def test_resize_and_normalize_truncates_long_vector():
    resized = EmbeddingService._resize_and_normalize([1.0] * 10, target_dimension=6)

    assert len(resized) == 6
    assert math.isclose(sum(v * v for v in resized), 1.0, rel_tol=1e-5)


@pytest.mark.asyncio
async def test_embed_normalizes_voyage_dimension(monkeypatch):
    class _Response:
        embeddings = [[1.0] * 1024]

    class _VoyageClient:
        async def embed(self, texts: list[str], model: str):
            assert texts == ["hello"]
            assert model == "voyage-3-large"
            return _Response()

    service = EmbeddingService()
    service._voyage = _VoyageClient()
    service._openai = None

    monkeypatch.setattr("src.services.embeddings.settings.EMBEDDING_PROVIDER", "voyage")
    monkeypatch.setattr("src.services.embeddings.settings.EMBEDDING_DIMENSION", 1536)

    embedding = await service.embed("hello")

    assert len(embedding) == 1536
    assert embedding[1024:] == [0.0] * (1536 - 1024)


@pytest.mark.asyncio
async def test_embed_falls_back_when_voyage_errors(monkeypatch):
    class _VoyageClient:
        async def embed(self, texts: list[str], model: str):
            raise RuntimeError("rate limited")

    service = EmbeddingService()
    service._voyage = _VoyageClient()
    service._openai = None

    monkeypatch.setattr("src.services.embeddings.settings.EMBEDDING_PROVIDER", "voyage")
    monkeypatch.setattr("src.services.embeddings.settings.EMBEDDING_DIMENSION", 1536)

    embedding = await service.embed("hello")

    assert len(embedding) == 1536
