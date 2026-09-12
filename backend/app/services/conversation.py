from __future__ import annotations

import logging
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import telegram, whatsapp
from app.core.config import settings
from app.core.errors import ConversationNotFound, MessageNotFound
from app.core.telegram import TelegramSendError
from app.core.whatsapp import DeliveryReceipt, WhatsAppSendError
from app.models.conversation import (
    Conversation,
    ConversationChannel,
    ConversationStatus,
)
from app.models.message import STATUS_RANK, Message, MessageAuthor, MessageStatus
from app.models.user import User
from app.repositories.conversation import ConversationRepository, MessageRepository
from app.repositories.telegram import TelegramAccountRepository
from app.repositories.whatsapp import WhatsAppAccountRepository
from app.schemas.conversation import (
    PREVIEW_LENGTH,
    CreateConversationRequest,
    CreateMessageRequest,
    IngestMessageRequest,
    UpdateConversationRequest,
)
from app.services.business import BusinessService

logger = logging.getLogger(__name__)


class ConversationService:
    """The inbox rules, with no knowledge of HTTP.

    It leans on `BusinessService` for the business itself rather than reading
    it again: the lazy creation on first access is that service's job, and a
    second copy of it would be a second thing to keep right.
    """

    def __init__(
        self,
        session: AsyncSession,
        businesses: BusinessService,
        conversations: ConversationRepository,
        messages: MessageRepository,
        accounts: WhatsAppAccountRepository,
        telegram_accounts: TelegramAccountRepository,
    ) -> None:
        self._session = session
        self._businesses = businesses
        self._conversations = conversations
        self._messages = messages
        # Both channels' credentials, because replying means sending and which
        # one to send over is a fact about the thread — see `_deliver`.
        self._accounts = accounts
        self._telegram = telegram_accounts

    # --- reading ---------------------------------------------------------

    async def list(
        self,
        user: User,
        statuses: Sequence[str] | None = None,
        query: str | None = None,
        archived: bool | None = False,
        starred: bool | None = None,
        assistant_enabled: bool | None = None,
        awaiting_reply: bool | None = None,
        active: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Conversation]:
        """The inbox.

        `active` is «сейчас переписываются» and is turned into a window here
        rather than in the repository, because the window's length is a setting
        and settings belong on this side of the layering.
        """
        business = await self._businesses.get_or_create(user)
        since = (
            datetime.now(UTC)
            - timedelta(minutes=settings.conversation_active_minutes)
            if active
            else None
        )
        return await self._conversations.list_for_business(
            business.id,
            statuses=statuses,
            query=query,
            archived=archived,
            starred=starred,
            assistant_enabled=assistant_enabled,
            awaiting_reply=awaiting_reply,
            active_since=since,
            limit=limit,
            offset=offset,
        )

    async def get(
        self, user: User, conversation_id: uuid.UUID, with_messages: bool = False
    ) -> Conversation:
        business = await self._businesses.get_or_create(user)
        found = await self._conversations.get_for_business(
            business.id, conversation_id, with_messages=with_messages
        )
        if found is None:
            raise ConversationNotFound()
        return found

    async def list_messages(
        self,
        user: User,
        conversation_id: uuid.UUID,
        limit: int = 200,
        before: datetime | None = None,
    ) -> Sequence[Message]:
        conversation = await self.get(user, conversation_id)
        return await self._messages.list_for_conversation(
            conversation.id, limit=limit, before=before
        )

    async def unread_count(self, user: User) -> int:
        business = await self._businesses.get_or_create(user)
        return await self._conversations.count_unread(business.id)

    # --- writing ---------------------------------------------------------

    async def create(
        self, user: User, data: CreateConversationRequest
    ) -> Conversation:
        business = await self._businesses.get_or_create(user)
        conversation = Conversation(
            business_id=business.id,
            channel=data.channel.value,
            external_id=data.external_id,
            client_phone=data.client_phone,
            client_name=data.client_name,
            status=ConversationStatus.NEW,
        )
        self._conversations.add(conversation)
        await self._session.commit()
        await self._session.refresh(conversation)
        return conversation

    async def update(
        self,
        user: User,
        conversation_id: uuid.UUID,
        data: UpdateConversationRequest,
    ) -> Conversation:
        """Everything the owner decides about a thread.

        `exclude_unset` is what separates "leave this alone" from "set this to
        null" — the same distinction `PATCH /auth/me` turns on. `archived` and
        `starred` arrive as booleans and are stored as timestamps, so the
        translation happens here and the column keeps knowing *when*.
        """
        conversation = await self.get(user, conversation_id)
        changes = data.model_dump(exclude_unset=True)

        if "client_name" in changes:
            conversation.client_name = changes["client_name"]
        if changes.get("status") is not None:
            conversation.status = changes["status"].value
        if changes.get("assistant_enabled") is not None:
            conversation.assistant_enabled = changes["assistant_enabled"]
        if changes.get("archived") is not None:
            conversation.archived_at = (
                datetime.now(UTC) if changes["archived"] else None
            )
        if changes.get("pinned") is not None:
            conversation.pinned_at = (
                datetime.now(UTC) if changes["pinned"] else None
            )
        if changes.get("starred") is not None:
            conversation.starred_at = (
                datetime.now(UTC) if changes["starred"] else None
            )

        await self._session.commit()
        await self._session.refresh(conversation)
        return conversation

    async def delete(self, user: User, conversation_id: uuid.UUID) -> None:
        """Removes the thread and everything said in it.

        A real delete, not an archive — those are different acts and both
        exist. Archiving is "I have dealt with this" and keeps the history;
        this is for a thread that should not be in the record at all, a test or
        a wrong number. The messages go with it through `ON DELETE CASCADE`.
        """
        conversation = await self.get(user, conversation_id)
        await self._conversations.remove(conversation)
        await self._session.commit()

    async def mark_read(self, user: User, conversation_id: uuid.UUID) -> Conversation:
        """Opening a thread is what clears its unread count.

        Not the assistant answering it: an answered thread is exactly the one
        the owner still wants to know about, which is why nothing in
        `add_message` touches this.
        """
        conversation = await self.get(user, conversation_id)
        conversation.unread_count = 0
        await self._session.commit()
        await self._session.refresh(conversation)
        return conversation

    async def add_message(
        self,
        user: User,
        conversation_id: uuid.UUID,
        data: CreateMessageRequest,
    ) -> Message:
        """Something we say, from the panel or from the assistant.

        **An owner's message switches the assistant off for this thread**, and
        that rule lives here rather than in the route because it must hold
        however the message got made. It is off until somebody switches it back
        on — `PATCH {"assistant_enabled": true}` — and not until the end of the
        day or the end of the conversation, because a person who stepped in
        once is usually the one handling that client now, and a bot resuming on
        a timer would resume in the middle of somebody else's sentence.

        The assistant's own messages do not touch it, obviously: if answering
        switched it off, it could answer exactly once.

        **It is written down first and sent afterwards**, and the order is the
        point: a message WhatsApp refuses is still something the owner typed,
        and a panel that dropped it would lose the words as well as the send.
        What comes back is the row either way, carrying `status` and — when it
        did not go — a `error` saying why, which is what the thread shows under
        the bubble.
        """
        conversation = await self.get(user, conversation_id)
        message = Message(
            conversation_id=conversation.id,
            author=data.author.value,
            body=data.body,
            sent_at=data.sent_at or datetime.now(UTC),
            # Ours, so it has a delivery state; the client's messages keep NULL
            # — see `MessageStatus`.
            status=MessageStatus.PENDING,
        )
        self._messages.add(message)

        if data.author is MessageAuthor.OWNER:
            conversation.assistant_enabled = False
        # A thread nobody had answered has now been answered.
        if conversation.status == ConversationStatus.NEW:
            conversation.status = ConversationStatus.OPEN

        _remember_last(conversation, message)
        await self._session.commit()
        await self._session.refresh(message)

        await self._deliver(conversation, message)
        return message

    async def _deliver(self, conversation: Conversation, message: Message) -> None:
        """Hand the message to its channel and record what happened.

        Runs **after** the row is committed, so the transaction is closed
        before a ten-second HTTP call rather than held open across it. Nothing
        here raises: every way this can fail is a state the message carries, and
        turning a refusal into a 4xx would leave the panel with an error toast
        and no bubble — the opposite of what a messenger does.

        Not connected is one of those states rather than a special case. The
        owner still gets their words in the thread and a line saying they did
        not leave, which is the same shape as "the channel said no".

        **Which channel is read off the thread, not off the business.** A
        business may have both connected, and a reply belongs to the
        conversation it is in — answering a Telegram client over WhatsApp
        because that is what the salon also has would send it to a number that
        may not even be theirs.
        """
        if conversation.channel == ConversationChannel.TELEGRAM:
            await self._deliver_telegram(conversation, message)
        else:
            await self._deliver_whatsapp(conversation, message)

    async def _deliver_whatsapp(
        self, conversation: Conversation, message: Message
    ) -> None:
        account = await self._accounts.get_for_business(conversation.business_id)
        if account is None:
            message.status = MessageStatus.FAILED
            message.error = whatsapp.NOT_CONNECTED
            await self._session.commit()
            return

        try:
            sent_id = await whatsapp.send_text(
                phone_number_id=account.phone_number_id,
                access_token=account.access_token,
                # The channel's own id for the client, which is their number
                # without a `+`. A thread the owner opened by hand has none
                # yet, so the typed number is reduced to digits — the shape
                # WhatsApp wants — until the first reply teaches us the real one.
                to=conversation.external_id or _digits(conversation.client_phone or ""),
                body=message.body,
            )
        except WhatsAppSendError as exc:
            message.status = MessageStatus.FAILED
            message.error = exc.reason
        else:
            message.status = MessageStatus.SENT
            message.error = None
            if sent_id:
                # From here on the delivery receipts have something to find.
                message.external_id = sent_id

        await self._session.commit()

    async def _deliver_telegram(
        self, conversation: Conversation, message: Message
    ) -> None:
        """The same shape, and two differences worth naming.

        **There is no fallback address.** WhatsApp can reduce a typed number to
        the digits it wants, because a number is an address there. A bot can
        only write into a chat that already exists, and `external_id` *is* that
        chat — a thread without one has never been written to us from, so there
        is nowhere to send.

        **`sent` is as far as a Telegram message ever gets.** The API says
        whether it accepted the send and nothing after: no delivered, no read.
        `apply_receipt` has no Telegram counterpart, and inventing one would be
        the app claiming to know something about somebody else's phone.
        """
        account = await self._telegram.get_for_business(conversation.business_id)
        if account is None or not conversation.external_id:
            message.status = MessageStatus.FAILED
            message.error = telegram.NOT_CONNECTED
            await self._session.commit()
            return

        try:
            sent_id = await telegram.send_text(
                token=account.bot_token,
                chat_id=conversation.external_id,
                body=message.body,
            )
        except TelegramSendError as exc:
            message.status = MessageStatus.FAILED
            message.error = exc.reason
        else:
            message.status = MessageStatus.SENT
            message.error = None
            if sent_id:
                message.external_id = sent_id

        await self._session.commit()

    async def delete_message(
        self, user: User, conversation_id: uuid.UUID, message_id: uuid.UUID
    ) -> None:
        """Removes our copy. It does not unsend anything — see `Message`.

        The conversation's copy of "the last message" is rebuilt afterwards,
        because deleting the newest one would otherwise leave the list showing
        a line that no longer exists anywhere.
        """
        conversation = await self.get(user, conversation_id)
        message = await self._messages.get_for_conversation(
            conversation.id, message_id
        )
        if message is None:
            raise MessageNotFound()

        was_last = conversation.last_message_at == message.sent_at
        await self._messages.remove(message)
        await self._session.flush()

        if was_last:
            remaining = await self._messages.list_for_conversation(
                conversation.id, limit=1
            )
            _remember_last(conversation, remaining[-1] if remaining else None)

        await self._session.commit()

    async def ingest(
        self, user: User, data: IngestMessageRequest
    ) -> tuple[Conversation, Message]:
        """A client wrote, said by somebody holding this account's token.

        The owner-authenticated way in, which is what the panel and any manual
        test use. The real channel arrives with a signature and no session, so
        it goes through `ingest_for_business` below — this is a wrapper that
        does nothing but resolve the business, and the rules live under it
        exactly once.
        """
        business = await self._businesses.get_or_create(user)
        return await self.ingest_for_business(business.id, data)

    async def ingest_for_business(
        self, business_id: uuid.UUID, data: IngestMessageRequest
    ) -> tuple[Conversation, Message]:
        """A client wrote. The one entrance for anything inbound.

        It finds the thread or opens one, drops a redelivery on the floor, and
        bumps the unread count — the three things every channel adapter would
        otherwise each have to remember.

        **It takes a business id rather than a user**, and that is what lets a
        webhook use it. A delivery from Meta carries a `phone_number_id` and no
        bearer token, so the business is resolved from the signed body before
        this is reached; asking for a `User` here would mean a webhook had to
        invent one.

        **The dedupe below is read-then-write, so it loses a race — and this is
        the one caller where losing it matters.** Meta redelivers on any doubt,
        and it does not wait for the first attempt to finish: two copies of one
        message can be in flight together, both find nothing, and both insert.
        The second then hits `uq_messages_conversation_id_external_id`, which
        without this would surface as a 500 — and a 500 is exactly what makes
        Meta redeliver again, so the thing meant to make a retry harmless would
        instead be what kept it retrying, indefinitely. The same race opens a
        conversation twice on a client's very first message, against
        `uq_conversations_business_id_channel_external_id`.

        **The answer is to roll back and read again, once.** By then the row the
        other request committed is visible, so the second pass takes the branch
        it should have taken: it finds the conversation instead of creating one,
        and returns the duplicate message instead of appending it. The rollback
        is what makes that safe rather than merely lucky — it discards this
        attempt's unread increment too, so a redelivery cannot count twice.

        A second failure is not a race and is left to raise: two rounds of this
        means something is genuinely wrong, and swallowing it would turn a
        broken constraint into silently dropped messages.

        **A closed thread reopens.** Somebody writing again is the definition
        of not being finished, and leaving it closed would file the message
        where nobody looks.
        """
        try:
            return await self._ingest_once(business_id, data)
        except IntegrityError:
            logger.info(
                "Concurrent delivery for message %s — re-reading and retrying.",
                data.message_external_id,
            )
            await self._session.rollback()
            return await self._ingest_once(business_id, data)

    async def _ingest_once(
        self, business_id: uuid.UUID, data: IngestMessageRequest
    ) -> tuple[Conversation, Message]:
        """One attempt at the above. Never called anywhere else."""
        conversation = await self._conversations.get_by_external(
            business_id,
            data.channel.value,
            data.external_id,
            data.client_phone,
        )

        if conversation is None:
            conversation = Conversation(
                business_id=business_id,
                channel=data.channel.value,
                external_id=data.external_id,
                client_phone=data.client_phone,
                client_username=data.client_username,
                client_name=data.client_name,
                status=ConversationStatus.NEW,
            )
            self._conversations.add(conversation)
            await self._session.flush()
        else:
            # The provider's id is learned the first time it turns up, which is
            # how an owner-opened thread stops being matched by number alone.
            if data.external_id and not conversation.external_id:
                conversation.external_id = data.external_id
            # A name the channel knows and we do not is worth having; one we
            # already have is not overwritten, because the owner may have
            # corrected it.
            if data.client_name and not conversation.client_name:
                conversation.client_name = data.client_name
            # **The handle is overwritten, unlike the name.** Nobody edits it
            # here — it is the channel's own value — and a client who renames
            # themselves on Telegram has changed it, so the newest one is the
            # true one. A number learned late is filled in the same way,
            # because a Telegram client only ever has one by choosing to share
            # their contact card.
            if data.client_username:
                conversation.client_username = data.client_username
            if data.client_phone and not conversation.client_phone:
                conversation.client_phone = data.client_phone

        if data.message_external_id:
            duplicate = await self._messages.get_by_external(
                conversation.id, data.message_external_id
            )
            if duplicate is not None:
                return conversation, duplicate

        message = Message(
            conversation_id=conversation.id,
            author=MessageAuthor.CLIENT,
            body=data.body,
            external_id=data.message_external_id,
            # Already on disk by now — the channel fetched it, because only the
            # channel holds the credential the provider's file endpoint wants.
            media_name=data.media_name,
            sent_at=data.sent_at or datetime.now(UTC),
        )
        self._messages.add(message)

        conversation.unread_count += 1
        if conversation.status == ConversationStatus.CLOSED:
            conversation.status = ConversationStatus.OPEN

        _remember_last(conversation, message)
        await self._session.commit()
        await self._session.refresh(message)
        await self._session.refresh(conversation)
        return conversation, message

    async def apply_receipt(
        self, business_id: uuid.UUID, receipt: DeliveryReceipt
    ) -> None:
        """WhatsApp reporting how far one of ours got.

        Silent about everything it cannot act on. A receipt for a message we
        have no row for is the ordinary case, not an error — a `wamid` we never
        stored, or one from before this account was connected — and a webhook
        that raised on it would be redelivered forever.

        **Receipts arrive out of order**, so a state further along is never
        overwritten by one behind it; `STATUS_RANK` is what decides which is
        which, and `failed` outranks everything because a failure reported
        after a `sent` is the provider correcting itself.
        """
        try:
            status = MessageStatus(receipt.status)
        except ValueError:
            # `deleted`, and whatever Meta adds next. Nothing to record.
            return

        message = await self._messages.get_sent_by_external(
            business_id, receipt.message_id
        )
        if message is None:
            return

        # `MessageStatus` is a `StrEnum`, so the stored string is its own key
        # here; -1 is "nothing recorded yet", which every real state beats.
        current = STATUS_RANK.get(message.status, -1) if message.status else -1
        if STATUS_RANK[status] <= current:
            return

        message.status = status
        message.error = receipt.error if status is MessageStatus.FAILED else None
        await self._session.commit()


def _digits(value: str) -> str:
    """A number in the shape WhatsApp wants: international, no `+`, no spaces.

    Only ever a fallback. The channel's own `wa_id` is already exactly this and
    is what a thread uses once the client has written; this is for the one case
    where the owner opened the thread first and typed the number themselves.
    """
    return "".join(character for character in value if character.isdigit())


def _remember_last(conversation: Conversation, message: Message | None) -> None:
    """Copy the newest message onto the thread — see `Conversation`.

    One function because there are three writers of these three columns, and
    three copies of the same three assignments is exactly the shape that ends
    up with one of them forgetting the preview.
    """
    if message is None:
        conversation.last_message_at = None
        conversation.last_message_author = None
        conversation.last_message_preview = None
        return

    conversation.last_message_at = message.sent_at
    conversation.last_message_author = message.author
    # Cut on whitespace, not mid-word: a preview ending "подтвержда" reads as a
    # broken record rather than as a truncated one.
    body = " ".join(message.body.split())
    conversation.last_message_preview = (
        body if len(body) <= PREVIEW_LENGTH else body[:PREVIEW_LENGTH].rsplit(" ", 1)[0]
    )
