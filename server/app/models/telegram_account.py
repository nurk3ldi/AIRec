from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.business import Business


class TelegramAccount(Base):
    """The bot a business answers through, and the credential that speaks for it.

    A table of its own for the same two reasons `whatsapp_accounts` is one: the
    bot token is a password to somebody's bot and has no business travelling
    beside the row `GET /business` returns on every page load, and a connection
    is something that is made, breaks and is remade — a row that appears and
    disappears rather than a column that is sometimes null. One per business,
    so `business_id` is unique.

    **`webhook_secret` is how an update is routed, and that is the one real
    difference from WhatsApp.** A Meta delivery names its own
    `phone_number_id` in the body, so the inbox it belongs to can be looked up
    from what arrived. A Telegram update names no bot at all — the *URL* is the
    identity, which is why every bot is normally given a webhook path of its
    own. Telegram's own answer to that is `setWebhook(secret_token=…)`: it
    sends the value back in `X-Telegram-Bot-Api-Secret-Token` on every update,
    so one shared path still resolves to one bot. That makes this column both
    halves at once — the routing key *and* the proof the update is genuine —
    which is why it is generated here (`secrets.token_urlsafe`, never chosen by
    the owner), unique, and never returned by any schema.

    **`bot_id` is not what routes**, unlike WhatsApp's `phone_number_id`; it is
    kept because it is free (it is the numeric prefix of the token) and because
    a second business pasting the same bot is a mistake worth catching by name
    rather than by a token comparison.
    """

    __tablename__ = "telegram_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # The bot's own account id — the digits before the colon in the token.
    # `BigInteger` because Telegram ids passed 2³¹ years ago and a bot id is
    # the same space as a user id.
    bot_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    # «@airec_bot», as the owner would type it to find their own bot. Read by
    # people only; nothing routes by it, since a bot can be renamed.
    bot_username: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # **Stored as given, and that is the same deliberate limit `whatsapp_accounts`
    # names.** The database is the trust boundary in this project; one encrypted
    # column here would be a key with nowhere safe to live. It never leaves the
    # server — no schema exposes it, and `TelegramAccountPublic` reports only
    # that a bot is connected.
    bot_token: Mapped[str] = mapped_column(Text, nullable=False)

    # What every update must carry back for us to believe it, and what tells us
    # whose inbox it belongs to. See the class note.
    webhook_secret: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    # Whether Telegram has actually been pointed at us. `False` is an ordinary
    # state rather than a failure: a deployment with no public URL yet can
    # still store the token, and the card says so instead of pretending the
    # channel is live.
    webhook_set_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    business: Mapped[Business] = relationship()

    def __repr__(self) -> str:
        return f"<TelegramAccount {self.bot_username or self.bot_id}>"
