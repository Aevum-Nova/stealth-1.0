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
