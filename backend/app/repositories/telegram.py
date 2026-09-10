from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram_account import TelegramAccount


class TelegramAccountRepository:
    """The bot a business answers through.

    **The second repository with a lookup that is not scoped by owner**, for
    the same reason as `WhatsAppAccountRepository`: an update from Telegram
    carries no session, so resolving the business *is* the authentication step.

    It is safe here for a stronger reason than it is there, and worth knowing
    the difference. WhatsApp resolves by `phone_number_id` — a value that
    identifies but does not prove, so the HMAC over the body is what has to be
    checked first. A Telegram update is resolved by `webhook_secret`, which is
    a value we generated, never published, and Telegram only knows because we
    handed it to `setWebhook`. Finding a row by it *is* the proof; there is
    nothing else to check.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_for_business(self, business_id: uuid.UUID) -> TelegramAccount | None:
        stmt = select(TelegramAccount).where(
            TelegramAccount.business_id == business_id
        )
        return await self._session.scalar(stmt)

    async def get_by_bot_id(self, bot_id: int) -> TelegramAccount | None:
        """Whether this bot already answers for somebody.

        Unique across the deployment: a bot has exactly one webhook, so two
        businesses connecting the same one would not share it — the second
        would take the first one's messages away.
        """
        stmt = select(TelegramAccount).where(TelegramAccount.bot_id == bot_id)
        return await self._session.scalar(stmt)

    async def get_by_webhook_secret(self, secret: str) -> TelegramAccount | None:
        """How an inbound update finds the inbox it belongs to.

        See the class note: the secret both routes and authenticates, so a hit
        here is the whole of the check.
        """
        stmt = select(TelegramAccount).where(TelegramAccount.webhook_secret == secret)
        return await self._session.scalar(stmt)

    def add(self, account: TelegramAccount) -> None:
        self._session.add(account)

    async def remove(self, account: TelegramAccount) -> None:
        await self._session.delete(account)
