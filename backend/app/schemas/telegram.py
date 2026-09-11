from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConnectTelegramRequest(BaseModel):
    """One field: the token @BotFather hands over.

    **Nothing else is asked for, and that is the point of this channel.**
    Connecting WhatsApp means pasting four ids out of Meta's dashboard and then
    typing a callback URL back into it. A bot token already contains the bot's
    id, `getMe` supplies its username, and `setWebhook` is a call we can make
    ourselves — so everything else on that card is something the server can
    find out.
    """

    # «123456789:AA…» — the digits are the bot's id, the rest is the secret.
    # Stripped because a value copied out of a chat arrives with a trailing
    # space often enough that the alternative is a token that silently fails.
    bot_token: str = Field(max_length=128)

    @field_validator("bot_token")
    @classmethod
    def _required(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Заполните это поле.")
        if ":" not in stripped:
            # The shape is checked here and the token itself at `getMe`. This
            # catches the common paste — a bot *username* instead of its token
            # — before spending a network call on it.
            raise ValueError("Похоже, это не токен бота. Скопируйте его из @BotFather.")
        return stripped


class TelegramAccountPublic(BaseModel):
    """The connection, as the settings screen sees it.

    **Neither the token nor the webhook secret is here.** The first is a
    password to somebody's bot; the second is what proves an update is genuine,
    so putting it on a page would hand anyone who saw it the ability to write
    into that inbox.

    `webhook_active` is the one thing worth reporting beyond «подключён»: a
    deployment with no public address stores the token and cannot register a
    webhook, and a card that showed a live channel there would be lying.
    """

    model_config = ConfigDict(from_attributes=True)

    bot_id: int
    bot_username: str | None = None
    connected_at: datetime
    webhook_active: bool = False
    # **Whether updates arrive the other way**, which is the same question the
    # field above asks and the reason both are here: a card needs to know that
    # the channel *receives*, and on a machine with no public address it does
    # so by being polled. See `app/services/telegram_poller.py`. It is a fact
    # about the deployment rather than about the row, which is why it is filled
    # in the route from `settings` and stored nowhere.
    polling: bool = False
