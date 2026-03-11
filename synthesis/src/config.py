from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PORT: int = 3001
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ingestion_service"
    JWT_SECRET: str = "change_me"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "ingestion-artifacts"

    ASSEMBLYAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    EMBEDDING_PROVIDER: str = "voyage"
    EMBEDDING_DIMENSION: int = 1536
    VOYAGE_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None

    SYNTHESIS_CLUSTER_THRESHOLD: float = 0.75
    SYNTHESIS_MAX_SIGNALS: int = 2000
    SYNTHESIS_AUTO_TRIGGER_MIN: int = 5

    SLACK_CLIENT_ID: str | None = None
    SLACK_CLIENT_SECRET: str | None = None
    MICROSOFT_CLIENT_ID: str | None = None
    MICROSOFT_CLIENT_SECRET: str | None = None
    MICROSOFT_TENANT_ID: str | None = None
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    ZENDESK_CLIENT_ID: str | None = None
    ZENDESK_CLIENT_SECRET: str | None = None
    FIGMA_CLIENT_ID: str | None = None
    FIGMA_CLIENT_SECRET: str | None = None
    INTERCOM_CLIENT_ID: str | None = None
    INTERCOM_CLIENT_SECRET: str | None = None
    SERVICENOW_CLIENT_ID: str | None = None
    SERVICENOW_CLIENT_SECRET: str | None = None
    GITHUB_CLIENT_ID: str | None = None
    GITHUB_CLIENT_SECRET: str | None = None

    CREDENTIALS_ENCRYPTION_KEY: str = Field(default="")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("EMBEDDING_PROVIDER")
    @classmethod
    def validate_embedding_provider(cls, value: str) -> str:
        if value not in {"voyage", "openai"}:
            raise ValueError("EMBEDDING_PROVIDER must be 'voyage' or 'openai'")
        return value

    @field_validator("EMBEDDING_DIMENSION")
    @classmethod
    def validate_embedding_dimension(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("EMBEDDING_DIMENSION must be greater than 0")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
