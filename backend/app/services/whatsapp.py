from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    WhatsAppNotConnected,
    WhatsAppNumberTaken,
    WhatsAppTokenRequired,
)
from app.core.whatsapp import Delivery
from app.models.user import User
from app.models.whatsapp_account import WhatsAppAccount
from app.repositories.whatsapp import WhatsAppAccountRepository
from app.schemas.conversation import IngestMessageRequest
from app.schemas.whatsapp import ConnectWhatsAppRequest
from app.services.business import BusinessService
from app.services.conversation import ConversationService

logger = logging.getLogger(__name__)


class WhatsAppService:
    """The channel: which number a business answers on, and what arrives on it.

    Two audiences and they do not overlap. `get` / `connect` / `disconnect` are
    the owner's, reached with a bearer token from «Настройки». `handle` is
    Meta's, reached from a webhook with no session at all — which is why it
    takes a parsed `Delivery` and resolves the business itself.

    **It owns no conversation rules.** Everything a message does once it has
    found its inbox — opening a thread, dropping a redelivery, bumping the
    unread count, reopening a closed one — belongs to `ConversationService` and
    stays there, so the day a second channel appears it is another caller of
    the same method rather than a second copy of it.
    """

    def __init__(
        self,
        session: AsyncSession,
        businesses: BusinessService,
        accounts: WhatsAppAccountRepository,
        conversations: ConversationService,
    ) -> None:
        self._session = session
        self._businesses = businesses
        self._accounts = accounts
        self._conversations = conversations

    # --- the owner's side ------------------------------------------------

    async def get(self, user: User) -> WhatsAppAccount | None:
        """What is connected, or nothing. **Not an error when nothing is.**

        «Не подключено» is the state every new account is in, and a 404 for the
        ordinary case would make the settings screen open on an error.
        """
        business = await self._businesses.get_or_create(user)
        return await self._accounts.get_for_business(business.id)

    async def connect(
        self, user: User, data: ConnectWhatsAppRequest
    ) -> WhatsAppAccount:
        """Point a business at a number, or move it to a different one.

        One row per business, so reconnecting **edits** rather than inserting —
        a second row would be a second number silently competing for the same
        inbox. Rotating an expired token is the same call with the same
        `phone_number_id`, which is why nothing here is a special case.

        **An omitted token keeps the stored one.** The API never hands a token
        back, so the field the owner sees is empty every time — and correcting a
        display name must not unplug the channel. Only a first connection has
        nothing to fall back on, which is the one case that refuses.
        """
        business = await self._businesses.get_or_create(user)

        taken = await self._accounts.get_by_phone_number_id(data.phone_number_id)
        if taken is not None and taken.business_id != business.id:
            raise WhatsAppNumberTaken()

        account = await self._accounts.get_for_business(business.id)
        if account is None:
            if not data.access_token:
                raise WhatsAppTokenRequired()
            account = WhatsAppAccount(
                business_id=business.id,
                phone_number_id=data.phone_number_id,
                access_token=data.access_token,
            )
            self._accounts.add(account)
        else:
            account.phone_number_id = data.phone_number_id
            if data.access_token:
                account.access_token = data.access_token

        account.waba_id = data.waba_id
        account.display_phone_number = data.display_phone_number
        account.verified_name = data.verified_name

        await self._session.commit()
        await self._session.refresh(account)
        return account

    async def disconnect(self, user: User) -> None:
        """Forget the number and the token.

        **The conversations stay.** They are the history of what was said, and
        they belong to the business rather than to the connection it was said
        over — unplugging a channel is not a reason to lose the transcript.
        """
        business = await self._businesses.get_or_create(user)
        account = await self._accounts.get_for_business(business.id)
        if account is None:
            raise WhatsAppNotConnected()
        await self._accounts.remove(account)
        await self._session.commit()

    # --- Meta's side -----------------------------------------------------

    async def handle(self, delivery: Delivery) -> None:
        """Everything one webhook body asked for.

        **Nothing here raises on unknown input.** Meta redelivers anything it
        did not get a 200 for, so a message naming a number this deployment has
        never heard of is logged and skipped — that happens routinely while a
        webhook is shared between a staging app and a live one, and retrying it
        forever would be the only lasting consequence.

        The account is looked up once per number rather than once per message:
        a busy minute arrives as one POST carrying several, and they are almost
        always the same number.
        """
        businesses: dict[str, uuid.UUID | None] = {}

        async def business_for(phone_number_id: str) -> uuid.UUID | None:
            if phone_number_id not in businesses:
                account = await self._accounts.get_by_phone_number_id(phone_number_id)
                businesses[phone_number_id] = account.business_id if account else None
            return businesses[phone_number_id]

        for inbound in delivery.messages:
            business_id = await business_for(inbound.phone_number_id)
            if business_id is None:
                logger.warning(
                    "WhatsApp message for an unknown phone_number_id %s — skipped.",
                    inbound.phone_number_id,
                )
                continue

            await self._conversations.ingest_for_business(
                business_id,
                IngestMessageRequest(
                    # `wa_id` is the number without a `+`; putting it back is
                    # what makes the stored value readable, and it is the only
                    # number this channel ever gives us.
                    client_phone=f"+{inbound.wa_id}",
                    body=inbound.body,
                    client_name=inbound.profile_name,
                    external_id=inbound.wa_id,
                    message_external_id=inbound.message_id,
                    sent_at=inbound.sent_at,
                ),
            )

        for receipt in delivery.receipts:
            business_id = await business_for(receipt.phone_number_id)
            if business_id is None:
                continue
            await self._conversations.apply_receipt(business_id, receipt)
