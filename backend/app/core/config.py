from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import Field, SecretStr, field_validator
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
    # Matched in addition to the list above. It exists for one case: opening the
    # dev server from a phone on the same Wi-Fi, where the origin is the
    # machine's LAN address and that address changes whenever DHCP feels like
    # it. Set it in `.env` to something like
    # `http://192\.168\.\d+\.\d+:3000` and leave it unset in production —
    # a regex here is a list of origins nobody reviewed.
    cors_origin_regex: str | None = None

    # --- Database ---
    # Given as separate parts rather than one URL so `.env` stays readable and
    # a password with URL-special characters can't silently corrupt the DSN —
    # `database_url` below quotes it.
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "airec"
    db_user: str = "postgres"
    db_password: SecretStr

    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_recycle_seconds: int = 1800
    db_echo: bool = False

    @property
    def database_url(self) -> str:
        """SQLAlchemy DSN. asyncpg is not optional — a sync driver here would
        block the event loop on every query."""
        password = quote_plus(self.db_password.get_secret_value())
        user = quote_plus(self.db_user)
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    # --- Security ---
    secret_key: SecretStr
    access_token_ttl_minutes: int = 15
    # How long a refresh token lives, and it depends on the answer to
    # "Запомнить меня". The short one is a backstop rather than the mechanism:
    # an unremembered session is really ended by the browser dropping the token
    # when it closes, and this is what stops the server-side row outliving it
    # by a month — which would leave a phantom device in the sessions list and
    # a live credential nobody is holding.
    refresh_token_ttl_days: int = 30
    refresh_token_session_ttl_hours: int = 12
    # How long after a token is rotated away a *second* request carrying it is
    # still read as the same client asking twice rather than as a stolen token
    # being replayed.
    #
    # Rotation is only safe to police strictly if a client can never send the
    # same token twice, and it can: two tabs share one `localStorage`, and a
    # single page can start two checks at once. The second request's *read* then
    # lands after the first has committed, so the token it holds is already
    # revoked — indistinguishable from a replay by inspection alone. Without
    # this window that benign double-send ended every session the user had,
    # which is far worse than the theft it was defending against.
    #
    # Seconds, not minutes: it only has to cover requests that were genuinely in
    # flight together. Anything later really is someone replaying an old token,
    # and gets the full response. It is also only half the test — the family
    # must still hold a live token, see `AuthService.refresh`.
    refresh_token_reuse_grace_seconds: int = 10

    # --- Password reset ---
    password_reset_code_ttl_minutes: int = 10
    password_reset_max_attempts: int = 5

    # --- Account deletion ---
    # A deleted account is kept this long before it is actually removed, so a
    # change of mind (or a misclick) is recoverable.
    account_deletion_grace_days: int = 30

    # **How recently a thread must have been spoken in to count as live.**
    # «Сейчас переписываются» is a window over the last message rather than a
    # stored flag, because a stored one needs something to turn it off again
    # and nothing ever would — see `ConversationStatus`. Fifteen minutes is a
    # reply people are still waiting for; an hour is a conversation you have
    # walked away from.
    conversation_active_minutes: int = 15

    # --- Email change confirmation ---
    # Separate from the reset settings on purpose: the two flows protect
    # different things and their limits should be tunable apart.
    email_change_code_ttl_minutes: int = 10
    email_change_max_attempts: int = 5

    # --- Uploaded images ---
    # Local disk storage; gitignored. Swap for object storage later by changing
    # only `app/core/images.py` and these prefixes. Avatars and logos are kept
    # apart so a cleanup pass over one can never touch the other.
    avatar_dir: Path = Path("uploads/avatars")
    avatar_url_prefix: str = "/media/avatars"
    logo_dir: Path = Path("uploads/logos")
    logo_url_prefix: str = "/media/logos"
    image_max_bytes: int = 5 * 1024 * 1024
    image_size_px: int = 512

    # --- SMTP (optional) ---
    # Left unset in local dev on purpose: with no host configured, reset codes
    # are logged to the console instead of emailed — see app/core/email.py.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: SecretStr | None = None
    smtp_from: str = "AIRec <no-reply@airec.local>"
    smtp_use_tls: bool = True

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
