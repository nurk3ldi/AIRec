from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status
from fastapi.responses import PlainTextResponse

from app.api.deps import CurrentUser, WhatsAppServiceDep
from app.core import whatsapp
from app.schemas.whatsapp import ConnectWhatsAppRequest, WhatsAppAccountPublic

logger = logging.getLogger(__name__)

router = APIRouter(tags=["whatsapp"])


# --- the owner's side: /business/whatsapp --------------------------------
#
# Under `/business` because that is what a channel connection belongs to — the
# salon, not the person signed in — and it is where the settings screen already
# reads everything else about it from.


@router.get(
    "/business/whatsapp",
    response_model=WhatsAppAccountPublic | None,
    summary="Which WhatsApp number this business answers on, if any",
)
async def get_whatsapp(
    user: CurrentUser, channel: WhatsAppServiceDep
) -> WhatsAppAccountPublic | None:
    """`null` when nothing is connected, which is not an error.

    Every new account is in that state, and answering a 404 for the ordinary
    case would make the settings screen open on a failure.
    """
    account = await channel.get(user)
    return WhatsAppAccountPublic.model_validate(account) if account else None


@router.put(
    "/business/whatsapp",
    response_model=WhatsAppAccountPublic,
    summary="Connect a number, move to another, or rotate an expired token",
)
async def connect_whatsapp(
    payload: ConnectWhatsAppRequest,
    user: CurrentUser,
    channel: WhatsAppServiceDep,
) -> WhatsAppAccountPublic:
    """A `PUT`, because a business has one connection and this sets it.

    Connecting for the first time, pointing at a different number and pasting a
    fresh token are the same act with the same body — a `POST` that sometimes
    created and sometimes edited would be the same thing under a verb that
    promised otherwise.
    """
    return WhatsAppAccountPublic.model_validate(await channel.connect(user, payload))


@router.delete(
    "/business/whatsapp",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Disconnect the number (the conversations stay)",
)
async def disconnect_whatsapp(
    user: CurrentUser, channel: WhatsAppServiceDep
) -> None:
    await channel.disconnect(user)


# --- Meta's side: /webhooks/whatsapp -------------------------------------
#
# **No authentication, and it must stay that way.** Meta sends a signature and
# no bearer token; what stands in for a session is the HMAC over the raw body,
# checked below before anything is read.


@router.get(
    "/webhooks/whatsapp",
    response_class=PlainTextResponse,
    summary="Meta's one-time subscription handshake",
    include_in_schema=False,
)
async def verify_webhook(
    mode: Annotated[str | None, Query(alias="hub.mode")] = None,
    token: Annotated[str | None, Query(alias="hub.verify_token")] = None,
    challenge: Annotated[str | None, Query(alias="hub.challenge")] = None,
) -> Response:
    """Echo the challenge back, in plain text, if the token is ours.

    Meta asks this once — when the webhook URL is first saved in the dashboard
    — and never again. The reply has to be the bare challenge with no JSON
    around it, which is why this route sets its own response class.
    """
    if mode == "subscribe" and whatsapp.verify_token_ok(token) and challenge:
        return PlainTextResponse(challenge)
    logger.warning("WhatsApp webhook verification refused (mode=%s).", mode)
    return PlainTextResponse("", status_code=status.HTTP_403_FORBIDDEN)


@router.post(
    "/webhooks/whatsapp",
    status_code=status.HTTP_200_OK,
    summary="Inbound messages and delivery receipts from Meta",
    include_in_schema=False,
)
async def receive_webhook(
    request: Request, channel: WhatsAppServiceDep
) -> Response:
    """**Answer 200 to anything that is genuinely Meta's, always.**

    Meta redelivers every delivery it did not get a 200 for, with widening
    backoff, and disables a webhook that keeps failing. So the only thing that
    may refuse here is a bad signature — a body we cannot make sense of is
    acknowledged and dropped, because a retry would not make it any more
    readable and the alternative is the same payload arriving for days.

    The signature is checked against the **raw bytes**: re-serialising the JSON
    changes whitespace and key order, and the digest is over what was sent.
    """
    raw = await request.body()
    if not whatsapp.signature_ok(raw, request.headers.get(whatsapp.SIGNATURE_HEADER)):
        logger.warning("WhatsApp webhook rejected: bad or missing signature.")
        return Response(status_code=status.HTTP_403_FORBIDDEN)

    try:
        payload = json.loads(raw)
    except ValueError:
        logger.warning("WhatsApp webhook body was not JSON — acknowledged and dropped.")
        return Response(status_code=status.HTTP_200_OK)

    if not isinstance(payload, dict):
        return Response(status_code=status.HTTP_200_OK)

    await channel.handle(whatsapp.parse(payload))
    return Response(status_code=status.HTTP_200_OK)
