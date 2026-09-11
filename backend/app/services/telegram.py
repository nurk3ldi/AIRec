from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import telegram
from app.core.config import settings
from app.core.errors import (
    TelegramBotTaken,
    TelegramNotConnected,
    TelegramTokenInvalid,
)
from app.core.telegram import InboundMessage, TelegramAuthError
from app.models.conversation import ConversationChannel
from app.models.telegram_account import TelegramAccount
from app.models.user import User
from app.repositories.telegram import TelegramAccountRepository
from app.schemas.conversation import IngestMessageRequest
from app.schemas.telegram import ConnectTelegramRequest
from app.services.business import BusinessService
from app.services.conversation import ConversationService

logger = logging.getLogger(__name__)

# Where Telegram is told to send updates. One path for every bot — the secret
# in the header is what tells them apart, see `TelegramAccount`.
WEBHOOK_PATH = "/api/v1/webhooks/telegram"


class TelegramService:
    """The channel: which bot a business answers through, and what arrives on it.

    The same two audiences `WhatsAppService` has and the same split. `get` /
    `connect` / `disconnect` are the owner's, reached with a bearer token from
    «Ассистент». `handle` is Telegram's, reached from a webhook with no session
    at all.

    **It owns no conversation rules either.** Opening a thread, dropping a
    redelivery, bumping the unread count and reopening a closed one belong to
    `ConversationService.ingest_for_business`, which this calls — which is what
    made adding this channel a new file rather than a second copy of those.

    **What it does own that WhatsApp's does not is the webhook itself.**
    Connecting a number to Meta means the owner typing a callback URL into a
    dashboard; connecting a bot means one `setWebhook` call with the token
    already in hand. Doing it here removes that step entirely — and is why
    `webhook_set_at` exists, since a deployment with no public address of its
    own cannot make that call and the card has to say so.
    """

    def __init__(
        self,
        session: AsyncSession,
        businesses: BusinessService,
        accounts: TelegramAccountRepository,
        conversations: ConversationService,
    ) -> None:
        self._session = session
        self._businesses = businesses
        self._accounts = accounts
        self._conversations = conversations

    # --- the owner's side ------------------------------------------------

    async def get(self, user: User) -> TelegramAccount | None:
        """What is connected, or nothing. **Not an error when nothing is.**"""
        business = await self._businesses.get_or_create(user)
        return await self._accounts.get_for_business(business.id)

    async def connect(
        self, user: User, data: ConnectTelegramRequest
    ) -> TelegramAccount:
        """Point a business at a bot, or move it to a different one.

        **The token is checked against Telegram before anything is stored.**
        `getMe` is the only way to know a pasted token is real, and it costs one
        call at the moment the owner is still looking at the field — where the
        alternative is a credential that fails silently on the first reply.
        Its answer is also where `bot_id` and the username come from, so
        nothing else has to be typed.

        One row per business, so reconnecting **edits** rather than inserting.
        Moving to a different bot keeps the row and takes a fresh secret with
        it: the old one belonged to the old bot, and leaving it would mean the
        previous bot could still write into this inbox.
        """
        business = await self._businesses.get_or_create(user)

        try:
            identity = await telegram.get_me(data.bot_token)
        except TelegramAuthError as exc:
            logger.info("Telegram rejected a pasted token: %s", exc)
            raise TelegramTokenInvalid() from exc

        taken = await self._accounts.get_by_bot_id(identity.bot_id)
        if taken is not None and taken.business_id != business.id:
            raise TelegramBotTaken()

        account = await self._accounts.get_for_business(business.id)
        if account is None:
            account = TelegramAccount(
                business_id=business.id,
                bot_id=identity.bot_id,
                bot_token=data.bot_token,
                webhook_secret=_new_secret(),
            )
            self._accounts.add(account)
        else:
            if account.bot_id != identity.bot_id:
                account.bot_id = identity.bot_id
                account.webhook_secret = _new_secret()
            account.bot_token = data.bot_token

        account.bot_username = identity.username
        account.webhook_set_at = await self._register(account)

        await self._session.commit()
        await self._session.refresh(account)
        return account

    async def disconnect(self, user: User) -> None:
        """Forget the bot and its token. **The conversations stay.**

        They are the history of what was said and they belong to the business
        rather than to the connection it was said over.

        Telegram is told to stop sending first, and a failure there is ignored:
        the row is going either way, and an update that still arrives resolves
        to no account and is dropped. See `core.telegram.delete_webhook`.
        """
        business = await self._businesses.get_or_create(user)
        account = await self._accounts.get_for_business(business.id)
        if account is None:
            raise TelegramNotConnected()

        await telegram.delete_webhook(account.bot_token)
        await self._accounts.remove(account)
        await self._session.commit()

    async def _register(self, account: TelegramAccount) -> datetime | None:
        """Point Telegram at us, if this deployment knows where "us" is.

        Returns the moment it was registered, or `None`. **`None` is an
        ordinary state, not a failure**: a laptop has no public address, and
        refusing to store the token there would make the channel impossible to
        set up before deploying. What it must not do is claim the channel is
        live, which is why the answer is recorded rather than assumed.

        A refusal from Telegram is swallowed for the same reason — the token is
        good (`getMe` just said so) and the owner can retry by saving again,
        where raising would throw away a verified credential over a call that
        may simply have timed out.
        """
        # **Polling is the other half of this answer, not a special case of
        # it.** With `TELEGRAM_POLLING` on the server fetches updates instead
        # of being called, so there is no webhook to register and a stale one
        # would take the messages away from the poller — Telegram allows a bot
        # exactly one of the two. Cleared here rather than only in the poller,
        # so connecting a bot while the server runs does not leave a webhook
        # standing until the next restart. `None` is the truth either way: no
        # webhook was set, and `TelegramAccountPublic.polling` is what tells
        # the card the channel still receives.
        if settings.telegram_polling:
            try:
                await telegram.delete_webhook(account.bot_token)
            except Exception:
                logger.warning(
                    "Could not clear the webhook for bot %s while polling.",
                    account.bot_id,
                    exc_info=True,
                )
            return None

        if not settings.public_base_url:
            logger.info(
                "PUBLIC_BASE_URL is unset — Telegram webhook not registered for bot %s.",
                account.bot_id,
            )
            return None

        url = f"{settings.public_base_url.rstrip('/')}{WEBHOOK_PATH}"
        try:
            await telegram.set_webhook(
                token=account.bot_token, url=url, secret=account.webhook_secret
            )
        except Exception:
            logger.warning(
                "Telegram setWebhook failed for bot %s — token kept, webhook off.",
                account.bot_id,
                exc_info=True,
            )
            return None

        return datetime.now(UTC)

    # --- Telegram's side --------------------------------------------------

    async def resolve(self, secret: str | None) -> TelegramAccount | None:
        """Whose inbox an update belongs to — **and whether to believe it**.

        Both at once, because on this channel they are the same question: the
        secret was generated here, never published, and Telegram only knows it
        because `setWebhook` was handed it. A row found by it is proof; no row
        is an update to drop.
        """
        if not secret:
            return None
        return await self._accounts.get_by_webhook_secret(secret)

    async def handle(self, account: TelegramAccount, message: InboundMessage) -> None:
        """One client message, into the inbox that bot answers for.

        Everything it does once it has found that inbox belongs to
        `ConversationService`; this only translates Telegram's words into ours.
        """
        await self._conversations.ingest_for_business(
            account.business_id,
            IngestMessageRequest(
                channel=ConversationChannel.TELEGRAM,
                # The chat id *is* the address here — it is what a reply is
                # sent to, not merely how the thread is recognised.
                external_id=message.chat_id,
                message_external_id=message.message_id,
                client_phone=message.phone,
                client_username=message.username,
                client_name=message.client_name,
                body=message.body,
                sent_at=message.sent_at,
            ),
        )


def _new_secret() -> str:
    """The value that both routes and authenticates an update.

    `token_urlsafe(32)` is 43 characters — inside Telegram's 1–256 limit and
    inside the column's 64 — from the same source every other secret in this
    project comes from. It is never shown to anybody: the owner has no reason
    to know it, and a value on a page is a value in a screenshot.
    """
    return secrets.token_urlsafe(32)
