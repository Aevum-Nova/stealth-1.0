import os

# Ensure deterministic auth config in tests.
os.environ.setdefault("JWT_SECRET", "test-secret")
