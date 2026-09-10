from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Request, Response, status

from app.api.deps import CurrentUser, TelegramServiceDep
from app.core import telegram
from app.schemas.telegram import ConnectTelegramRequest, TelegramAccountPublic

logger = logging.getLogger(__name__)

router = APIRouter(tags=["telegram"])


# --- the owner's side: /business/telegram --------------------------------
#
# Under `/business` for the same reason WhatsApp is: a channel belongs to the
# salon, not to whoever is signed in.


def _public(account) -> TelegramAccountPublic:
    """The row as a page may see it.

    `webhook_active` is computed here rather than stored as a boolean, because
    the column keeps *when* — see `TelegramAccount.webhook_set_at` — and the
    card only needs the yes or no.
    """
    return TelegramAccountPublic(
        bot_id=account.bot_id,
        bot_username=account.bot_username,
        connected_at=account.connected_at,
        webhook_active=account.webhook_set_at is not None,
    )


@router.get(
    "/business/telegram",
    response_model=TelegramAccountPublic | None,
    summary="Which Telegram bot this business answers through, if any",
)
async def get_telegram(
    user: CurrentUser, channel: TelegramServiceDep
) -> TelegramAccountPublic | None:
    """`null` when nothing is connected, which is not an error."""
    account = await channel.get(user)
    return _public(account) if account else None


@router.put(
    "/business/telegram",
    response_model=TelegramAccountPublic,
    summary="Connect a bot, move to another, or paste a regenerated token",
)
async def connect_telegram(
    payload: ConnectTelegramRequest,
    user: CurrentUser,
    channel: TelegramServiceDep,
) -> TelegramAccountPublic:
    """A `PUT`, because a business has one connection and this sets it.

    Unlike WhatsApp's, the token is **not** optional here: Telegram hands the
    whole credential back through @BotFather whenever it is asked, so an empty
    field has no "keep the stored one" to mean — there is nothing else on this
    card to edit without it.
    """
    return _public(await channel.connect(user, payload))


@router.delete(
    "/business/telegram",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Disconnect the bot (the conversations stay)",
)
async def disconnect_telegram(user: CurrentUser, channel: TelegramServiceDep) -> None:
    await channel.disconnect(user)


# --- Telegram's side: /webhooks/telegram ---------------------------------
#
# **No authentication, and it must stay that way.** Telegram sends no bearer
# token; what stands in for a session is the secret it echoes back in
# `X-Telegram-Bot-Api-Secret-Token`, which is checked below before anything is
# read — and which is also what says whose inbox this is.


@router.post(
    "/webhooks/telegram",
    status_code=status.HTTP_200_OK,
    summary="Inbound messages from Telegram",
    include_in_schema=False,
)
async def receive_webhook(request: Request, channel: TelegramServiceDep) -> Response:
    """**Answer 200 to anything carrying a secret we issued, always.**

    Telegram retries what it did not get a 200 for and backs off a webhook that
    keeps failing, so the only thing that may refuse is a missing or unknown
    secret. A body we cannot make sense of is acknowledged and dropped: a retry
    would not make it any more readable.

    **There is no signature to check and no raw-bytes rule here**, unlike
    WhatsApp. Telegram authenticates with a shared secret in a header rather
    than an HMAC over the body, so the body may be parsed normally — the thing
    that must not be re-derived is the secret, and it never touches the body at
    all.
    """
    account = await channel.resolve(request.headers.get(telegram.SECRET_HEADER))
    if account is None:
        logger.warning("Telegram webhook rejected: unknown or missing secret.")
        return Response(status_code=status.HTTP_403_FORBIDDEN)

    try:
        payload = json.loads(await request.body())
    except ValueError:
        logger.warning("Telegram webhook body was not JSON — acknowledged and dropped.")
        return Response(status_code=status.HTTP_200_OK)

    if not isinstance(payload, dict):
        return Response(status_code=status.HTTP_200_OK)

    message = telegram.parse(payload)
    if message is not None:
        await channel.handle(account, message)
    return Response(status_code=status.HTTP_200_OK)
