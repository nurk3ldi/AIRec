from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Select, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.models.conversation import Conversation
from app.models.message import Message


class ConversationRepository:
    """Every method is scoped by `business_id`, like the other repositories
    here: there is deliberately no fetch-by-id-alone, so no route can be one
    refactor away from reading another account's inbox."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_for_business(
        self,
        business_id: uuid.UUID,
        conversation_id: uuid.UUID,
        with_messages: bool = False,
    ) -> Conversation | None:
        stmt = select(Conversation).where(
            Conversation.business_id == business_id,
            Conversation.id == conversation_id,
        )
        if with_messages:
            # `selectinload`, not a join: a thread's messages are a collection,
            # and joining would return the conversation once per message for
            # the ORM to fold back together.
            stmt = stmt.options(
                selectinload(Conversation.messages)
            ).execution_options(populate_existing=True)
        return await self._session.scalar(stmt)

    async def get_by_external(
        self,
        business_id: uuid.UUID,
        channel: str,
        external_id: str | None,
        client_phone: str,
    ) -> Conversation | None:
        """The thread an inbound message belongs to.

        **Two ways to recognise it, in that order.** The provider's own id is
        the reliable one and is tried first. A number is the fallback, for the
        case the id cannot cover: a thread the owner opened from this side
        before the channel had ever heard of it, which by definition has no
        `external_id` yet. Matching on the number alone would be wrong as a
        primary rule — a client who changes their WhatsApp keeps the number and
        gets a new thread — but as a fallback it is what stops the owner's own
        conversation being duplicated the first time the client replies.
        """
        base = select(Conversation).where(
            Conversation.business_id == business_id,
            Conversation.channel == channel,
        )
        if external_id:
            found = await self._session.scalar(
                base.where(Conversation.external_id == external_id)
            )
            if found is not None:
                return found

        return await self._session.scalar(
            base.where(
                Conversation.client_phone == client_phone,
                Conversation.external_id.is_(None),
            ).order_by(Conversation.created_at.desc())
        )

    async def list_for_business(
        self,
        business_id: uuid.UUID,
        statuses: Sequence[str] | None = None,
        query: str | None = None,
        archived: bool | None = False,
        starred: bool | None = None,
        assistant_enabled: bool | None = None,
        awaiting_reply: bool | None = None,
        active_since: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Conversation]:
        """The inbox, filtered.

        Every filter is optional and `None` means "do not ask" — which is not
        the same as `False`. `archived` is the one that carries a default, and
        the default is `False` rather than `None`: an inbox that silently
        included everything ever put away would grow without bound, and the one
        caller who wants them says so.

        `active_since` is what "talking right now" is made of. It is a window
        over `last_message_at` rather than a stored flag, because a stored one
        would need something to turn it off again and nothing ever would — see
        `ConversationStatus`.

        Ordered by the last message, newest first, with `created_at` behind it
        so a thread that has no messages yet still has a definite place instead
        of drifting between pages.
        """
        stmt = select(Conversation).where(Conversation.business_id == business_id)

        if statuses is not None:
            stmt = stmt.where(Conversation.status.in_(statuses))
        if archived is not None:
            stmt = stmt.where(
                Conversation.archived_at.isnot(None)
                if archived
                else Conversation.archived_at.is_(None)
            )
        if starred is not None:
            stmt = stmt.where(
                Conversation.starred_at.isnot(None)
                if starred
                else Conversation.starred_at.is_(None)
            )
        if assistant_enabled is not None:
            stmt = stmt.where(Conversation.assistant_enabled.is_(assistant_enabled))
        if awaiting_reply is not None:
            stmt = _apply_awaiting(stmt, awaiting_reply)
        if active_since is not None:
            stmt = stmt.where(Conversation.last_message_at >= active_since)
        if query:
            stmt = stmt.where(_matches(query))

        stmt = stmt.order_by(
            Conversation.last_message_at.desc().nullslast(),
            Conversation.created_at.desc(),
        )
        return (
            await self._session.scalars(stmt.limit(limit).offset(offset))
        ).all()

    async def count_unread(self, business_id: uuid.UUID) -> int:
        """How many threads have something unread in them.

        Threads and not messages: the badge on «Диалоги» answers "how many
        conversations need me", and a client who sent nine messages in a row is
        still one conversation to open.
        """
        stmt = select(func.count()).where(
            Conversation.business_id == business_id,
            Conversation.archived_at.is_(None),
            Conversation.unread_count > 0,
        )
        return int(await self._session.scalar(stmt) or 0)

    def add(self, conversation: Conversation) -> None:
        self._session.add(conversation)

    async def remove(self, conversation: Conversation) -> None:
        await self._session.delete(conversation)


class MessageRepository:
    """Messages are reached through their conversation, never on their own.

    There is no `get(message_id)` for the same reason the other repositories
    have no unscoped fetch: the conversation is what carries the business, so a
    message looked up without it is a message nobody has checked the owner of.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_conversation(
        self,
        conversation_id: uuid.UUID,
        limit: int = 200,
        before: datetime | None = None,
    ) -> Sequence[Message]:
        """A thread, oldest first.

        `before` pages *backwards* — into the past — because that is the only
        direction a transcript is ever read out of order: you open it at the
        bottom and go up. The rows are fetched newest-first so the limit takes
        the right end of the thread, then reversed, so the caller always gets
        them in reading order.
        """
        stmt = select(Message).where(Message.conversation_id == conversation_id)
        if before is not None:
            stmt = stmt.where(Message.sent_at < before)
        rows = (
            await self._session.scalars(
                stmt.order_by(Message.sent_at.desc(), Message.created_at.desc()).limit(
                    limit
                )
            )
        ).all()
        return list(reversed(rows))

    async def get_for_conversation(
        self, conversation_id: uuid.UUID, message_id: uuid.UUID
    ) -> Message | None:
        stmt = select(Message).where(
            Message.conversation_id == conversation_id,
            Message.id == message_id,
        )
        return await self._session.scalar(stmt)

    async def get_by_external(
        self, conversation_id: uuid.UUID, external_id: str
    ) -> Message | None:
        """What makes a redelivered webhook harmless — see `Message`."""
        stmt = select(Message).where(
            Message.conversation_id == conversation_id,
            Message.external_id == external_id,
        )
        return await self._session.scalar(stmt)

    def add(self, message: Message) -> None:
        self._session.add(message)

    async def remove(self, message: Message) -> None:
        await self._session.delete(message)


def _apply_awaiting(stmt: Select[tuple[Conversation]], waiting: bool) -> Select:
    """"Waiting on us" as a query, from the same fact the model derives it from.

    A thread with no messages at all is not waiting on anyone, which the
    `EXISTS` is there to say: without it a brand-new empty conversation would
    match "not awaiting" and quietly join the answered pile.
    """
    from app.models.message import MessageAuthor

    has_messages = exists().where(Message.conversation_id == Conversation.id)
    is_client = Conversation.last_message_author == MessageAuthor.CLIENT
    return stmt.where(has_messages & (is_client if waiting else ~is_client))


def _matches(query: str) -> ColumnElement[bool]:
    """Name, number or anything said in the thread.

    The first two are the same rule the calendar's search uses — a number is
    stored the way it was typed and nobody searching retypes the spaces, so
    both sides are reduced to digits before comparing. The third is what an
    inbox needs and a calendar does not: half of what you remember about a
    conversation is a word from inside it, and the client may never have given
    a name at all.
    """
    text = f"%{query.strip().lower()}%"
    conditions = [
        func.lower(Conversation.client_name).like(text),
        exists().where(
            Message.conversation_id == Conversation.id,
            func.lower(Message.body).like(text),
        ),
    ]

    digits = "".join(character for character in query if character.isdigit())
    if digits:
        bare_phone = func.regexp_replace(Conversation.client_phone, r"\D", "", "g")
        conditions.append(bare_phone.like(f"%{digits}%"))

    return or_(*conditions)
