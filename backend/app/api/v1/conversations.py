from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import ConversationServiceDep, CurrentUser
from app.models.conversation import ConversationStatus
from app.schemas.conversation import (
    ConversationPublic,
    ConversationWithMessages,
    CreateConversationRequest,
    CreateMessageRequest,
    IngestMessageRequest,
    MessagePublic,
    UpdateConversationRequest,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationPublic], summary="The inbox")
async def list_conversations(
    user: CurrentUser,
    conversations: ConversationServiceDep,
    status_filter: Annotated[
        list[ConversationStatus] | None,
        Query(alias="status", description="Repeat to filter on several at once."),
    ] = None,
    query: Annotated[
        str | None,
        Query(
            max_length=64,
            description=(
                "Client name, phone, or anything said in the thread. "
                "Punctuation in a number is ignored."
            ),
        ),
    ] = None,
    archived: Annotated[
        bool | None,
        Query(description="Default false. Pass null to include both."),
    ] = False,
    starred: Annotated[bool | None, Query(description="«Избранное».")] = None,
    assistant: Annotated[
        bool | None,
        Query(description="Only threads the assistant is on, or only those it is off."),
    ] = None,
    awaiting: Annotated[
        bool | None,
        Query(description="Waiting on us — the last message is the client's."),
    ] = None,
    active: Annotated[
        bool,
        Query(description="Talking right now: a message within the live window."),
    ] = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ConversationPublic]:
    rows = await conversations.list(
        user,
        statuses=[item.value for item in status_filter] if status_filter else None,
        query=query,
        archived=archived,
        starred=starred,
        assistant_enabled=assistant,
        awaiting_reply=awaiting,
        active=active,
        limit=limit,
        offset=offset,
    )
    return [ConversationPublic.model_validate(row) for row in rows]


@router.get(
    "/unread-count",
    response_model=int,
    summary="How many threads have something unread",
)
async def unread_count(
    user: CurrentUser, conversations: ConversationServiceDep
) -> int:
    """Threads, not messages — see `ConversationRepository.count_unread`.

    Declared before `/{conversation_id}` on purpose: FastAPI matches routes in
    order, and a literal path after a parameterised one is never reached.
    """
    return await conversations.unread_count(user)


@router.post(
    "",
    response_model=ConversationPublic,
    status_code=201,
    summary="Open a thread from this side",
)
async def create_conversation(
    payload: CreateConversationRequest,
    user: CurrentUser,
    conversations: ConversationServiceDep,
) -> ConversationPublic:
    return ConversationPublic.model_validate(
        await conversations.create(user, payload)
    )


@router.post(
    "/ingest",
    response_model=MessagePublic,
    status_code=201,
    summary="A client wrote — the one entrance for anything inbound",
)
async def ingest_message(
    payload: IngestMessageRequest,
    user: CurrentUser,
    conversations: ConversationServiceDep,
) -> MessagePublic:
    """Finds the thread or opens one, and drops a redelivery on the floor.

    **Authenticated as the owner for now, which is not where this ends up.** A
    real WhatsApp webhook arrives from Meta with a signature and no bearer
    token, so it will get its own unauthenticated route that verifies that
    signature and resolves the business from the phone number id it carries.
    That route will call `ConversationService.ingest` — this one — rather than
    growing a second copy of the rules.
    """
    _, message = await conversations.ingest(user, payload)
    return MessagePublic.model_validate(message)


@router.get(
    "/{conversation_id}",
    response_model=ConversationWithMessages,
    summary="One thread, with its messages",
)
async def get_conversation(
    conversation_id: uuid.UUID,
    user: CurrentUser,
    conversations: ConversationServiceDep,
) -> ConversationWithMessages:
    return ConversationWithMessages.model_validate(
        await conversations.get(user, conversation_id, with_messages=True)
    )


@router.patch(
    "/{conversation_id}",
    response_model=ConversationPublic,
    summary="Rename, close, archive, star, or switch the assistant back on",
)
async def update_conversation(
    conversation_id: uuid.UUID,
    payload: UpdateConversationRequest,
    user: CurrentUser,
    conversations: ConversationServiceDep,
) -> ConversationPublic:
    return ConversationPublic.model_validate(
        await conversations.update(user, conversation_id, payload)
    )


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a thread outright (archiving is PATCH)",
)
async def delete_conversation(
    conversation_id: uuid.UUID,
    user: CurrentUser,
    conversations: ConversationServiceDep,
) -> None:
    await conversations.delete(user, conversation_id)


@router.post(
    "/{conversation_id}/read",
    response_model=ConversationPublic,
    summary="Mark the thread read",
)
async def mark_read(
    conversation_id: uuid.UUID,
    user: CurrentUser,
    conversations: ConversationServiceDep,
) -> ConversationPublic:
    return ConversationPublic.model_validate(
        await conversations.mark_read(user, conversation_id)
    )


@router.get(
    "/{conversation_id}/messages",
    response_model=list[MessagePublic],
    summary="The transcript, oldest first",
)
async def list_messages(
    conversation_id: uuid.UUID,
    user: CurrentUser,
    conversations: ConversationServiceDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
    before: Annotated[
        datetime | None,
        Query(description="Page backwards: everything sent before this instant."),
    ] = None,
) -> list[MessagePublic]:
    rows = await conversations.list_messages(
        user, conversation_id, limit=limit, before=before
    )
    return [MessagePublic.model_validate(row) for row in rows]


@router.post(
    "/{conversation_id}/messages",
    response_model=MessagePublic,
    status_code=201,
    summary="Reply — an owner's message switches the assistant off",
)
async def create_message(
    conversation_id: uuid.UUID,
    payload: CreateMessageRequest,
    user: CurrentUser,
    conversations: ConversationServiceDep,
) -> MessagePublic:
    """Writes the message down. **It does not send anything yet.**

    There is no outbound channel: sending on WhatsApp means the Business API, a
    registered number and approved templates, none of which exist. What this
    does is record what was said and apply the rule that matters now — see
    `ConversationService.add_message`. The day there is a transport, it goes
    behind this endpoint and every caller stays as it is.
    """
    return MessagePublic.model_validate(
        await conversations.add_message(user, conversation_id, payload)
    )


@router.delete(
    "/{conversation_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove our copy of a message (it does not unsend it)",
)
async def delete_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    user: CurrentUser,
    conversations: ConversationServiceDep,
) -> None:
    await conversations.delete_message(user, conversation_id, message_id)
