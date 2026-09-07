from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.whatsapp_account import WhatsAppAccount


class WhatsAppAccountRepository:
    """The number a business answers on.

    **This is the one repository in the project with a lookup that is not
    scoped by owner**, and the reason is the webhook: a delivery from Meta
    carries a `phone_number_id` and no session, so resolving the business *is*
    the authentication step. That is safe here in a way `get_by_id` never is,
    because the id was not supplied by a caller who might have guessed it — it
    arrived inside a body whose HMAC signature was checked against the app
    secret before this is ever reached.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_for_business(self, business_id: uuid.UUID) -> WhatsAppAccount | None:
        stmt = select(WhatsAppAccount).where(
            WhatsAppAccount.business_id == business_id
        )
        return await self._session.scalar(stmt)

    async def get_by_phone_number_id(
        self, phone_number_id: str
    ) -> WhatsAppAccount | None:
        """How an inbound delivery finds the inbox it belongs to.

        Unique across the deployment, so this is one row or none — two
        businesses claiming one number is a mistyped id and the index refuses it
        rather than routing a stranger's messages into somebody's panel.
        """
        stmt = select(WhatsAppAccount).where(
            WhatsAppAccount.phone_number_id == phone_number_id
        )
        return await self._session.scalar(stmt)

    def add(self, account: WhatsAppAccount) -> None:
        self._session.add(account)

    async def remove(self, account: WhatsAppAccount) -> None:
        await self._session.delete(account)
