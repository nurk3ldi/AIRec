from __future__ import annotations

from functools import lru_cache

from pydantic import Field, PostgresDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from environment / `.env`.

    Anything security-sensitive is required — the app refuses to start rather
    than silently falling back to a guessable default.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- App ---
    app_name: str = "AIRec API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # --- Database ---
    database_url: PostgresDsn
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_recycle_seconds: int = 1800
    db_echo: bool = False

    # --- Security ---
    secret_key: SecretStr
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30

    @field_validator("database_url")
    @classmethod
    def _require_async_driver(cls, value: PostgresDsn) -> PostgresDsn:
        # A sync driver here would block the event loop on every query.
        if value.scheme != "postgresql+asyncpg":
            raise ValueError(
                "DATABASE_URL must use the asyncpg driver, "
                f"e.g. postgresql+asyncpg://... (got {value.scheme!r})"
            )
        return value

    @field_validator("secret_key")
    @classmethod
    def _reject_weak_secret(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment


settings = get_settings()
