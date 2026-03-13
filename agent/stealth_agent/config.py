from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PORT: int = 3002
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ingestion_service"
    JWT_SECRET: str = "change_me"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    LLM_PROVIDER: str = "claude"  # "claude" or "openai"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-opus-4-6"
    ANTHROPIC_PR_MODEL: str = "claude-opus-4-6"
    ANTHROPIC_PR_FAST_MODE: bool = True
    ANTHROPIC_PR_FAST_MODE_BETA: str = "fast-mode-2026-02-01"
    OPENAI_API_KEY: str = ""

    EMBEDDING_PROVIDER: str = "voyage"  # "voyage" or "openai"
    EMBEDDING_DIMENSION: int = 1536
    VOYAGE_API_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
