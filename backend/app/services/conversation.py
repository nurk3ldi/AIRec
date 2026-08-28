from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ConversationNotFound, MessageNotFound
from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, MessageAuthor
from app.models.user import User
from app.repositories.conversation import ConversationRepository, MessageRepository
from app.schemas.conversation import (
    PREVIEW_LENGTH,
    CreateConversationRequest,
    CreateMessageRequest,
    IngestMessageRequest,
    UpdateConversationRequest,
)
from app.services.business import BusinessService


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
    ) -> None:
        self._session = session
        self._businesses = businesses
        self._conversations = conversations
        self._messages = messages

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
        """
        conversation = await self.get(user, conversation_id)
        message = Message(
            conversation_id=conversation.id,
            author=data.author.value,
            body=data.body,
            sent_at=data.sent_at or datetime.now(UTC),
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
        return message

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
        """A client wrote. The one entrance for anything inbound.

        It finds the thread or opens one, drops a redelivery on the floor, and
        bumps the unread count — the three things every channel adapter would
        otherwise each have to remember. A webhook route is a thin wrapper over
        this and nothing more.

        **A closed thread reopens.** Somebody writing again is the definition
        of not being finished, and leaving it closed would file the message
        where nobody looks.
        """
        business = await self._businesses.get_or_create(user)
        conversation = await self._conversations.get_by_external(
            business.id,
            data.channel.value,
            data.external_id,
            data.client_phone,
        )

        if conversation is None:
            conversation = Conversation(
                business_id=business.id,
                channel=data.channel.value,
                external_id=data.external_id,
                client_phone=data.client_phone,
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
