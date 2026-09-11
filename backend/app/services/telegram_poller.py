from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import telegram
from app.core.telegram import TelegramSendError
from app.models.telegram_account import TelegramAccount
from app.repositories.telegram import TelegramAccountRepository
from app.services.telegram import TelegramService

# **`uvicorn.error` rather than this module's own name**, which is the same
# choice `app/main.py`'s startup lines make and for the same reason: nothing in
# this project configures logging, so an app logger propagates to a root with no
# handler and says nothing at all. This one has to be visible — it is how anyone
# knows a message arrived, or that Telegram is refusing to hand them over.
logger = logging.getLogger("uvicorn.error")

# How long Telegram holds a `getUpdates` call open while nothing arrives. Thirty
# seconds is its own suggestion and the number every client library uses: long
# enough that an idle bot is two requests a minute, short enough that a proxy
# or a laptop's sleep does not sit on a socket everyone has forgotten about.
POLL_WAIT = 30

# How long before the list of bots is read again, so a bot connected while the
# server is running starts being polled without a restart. Thirty seconds is a
# local `SELECT` on a table with one row per business; it is not worth making
# this cleverer until something says so.
REFRESH_SECONDS = 30

# What to wait after a failed call before trying again. Telegram answers 409
# while a webhook is still registered or another process is polling the same
# bot, and hammering either of those is how a token gets rate-limited — this is
# long enough to be polite and short enough that a fixed problem is picked up
# while somebody is still looking at the screen.
BACKOFF_SECONDS = 5


class TelegramPoller:
    """Updates fetched rather than delivered, for a machine Telegram cannot reach.

    **A bot has no server of its own.** The token @BotFather hands out names an
    inbox on Telegram's side; the code that answers is this backend, and
    Telegram has to get an update into it somehow. A webhook is the way that
    scales — one request per message, no idle traffic — and it needs a public
    HTTPS address, which a laptop does not have. This is the other way: the
    server asks, long-polling `getUpdates`, and nothing outside has to be able
    to reach in.

    **It is a development affordance, and the alternative is a tunnel.** ngrok
    works and needs installing, and its URL changes on every restart, which
    means `PUBLIC_BASE_URL` edited and every bot re-saved each time. Polling
    needs none of that and costs two requests a minute per bot. `deleteWebhook`
    is called before the first poll because Telegram allows exactly one of the
    two per bot and answers 409 to `getUpdates` while a webhook stands.

    **What arrives goes through the same door as a webhook's.** `parse` reads
    the update and `TelegramService.handle` puts it in the inbox — the same two
    calls `POST /webhooks/telegram` makes, in the same order. Nothing here
    knows what a conversation is, and switching a deployment to webhooks
    changes how a message arrives and nothing about what happens to it.
    """

    def __init__(self, session_factory: Callable[[], AsyncSession]) -> None:
        self._sessions = session_factory
        # Where each bot's reading has got to: `update_id + 1` of the last one
        # taken. Held in memory rather than stored, because Telegram already
        # holds it — an offset that is never sent means the same updates are
        # redelivered on the next call, so the worst a restart costs is the
        # handful still in the queue arriving twice, which the message dedupe
        # in `ConversationService.ingest_for_business` already drops.
        self._offsets: dict[int, int] = {}

    async def run(self) -> None:
        """Keep one pump per connected bot, for as long as the app is up.

        **A supervisor rather than one loop over all the bots**, because a poll
        blocks for half a minute: done in sequence, five bots would mean a
        message waiting two and a half minutes for its turn. Each gets its own
        task, and this loop only decides which tasks should exist.

        A bot whose token changed is restarted rather than left holding the old
        one, and a bot that disconnected has its task cancelled — the same
        reading of the table answers both.
        """
        pumps: dict[int, tuple[str, asyncio.Task[None]]] = {}
        try:
            while True:
                try:
                    bots = await self._bots()
                except Exception:
                    logger.warning("Could not read the bot list.", exc_info=True)
                    bots = {bot_id: token for bot_id, (token, _) in pumps.items()}

                for bot_id, token in bots.items():
                    current = pumps.get(bot_id)
                    if current is not None:
                        if current[0] == token and not current[1].done():
                            continue
                        current[1].cancel()
                    pumps[bot_id] = (
                        token,
                        asyncio.create_task(self._pump(bot_id, token)),
                    )

                for bot_id in [key for key in pumps if key not in bots]:
                    logger.info("Bot %s disconnected — polling stopped.", bot_id)
                    pumps.pop(bot_id)[1].cancel()
                    self._offsets.pop(bot_id, None)

                await asyncio.sleep(REFRESH_SECONDS)
        finally:
            # Cancelled at shutdown, and the children have to go with it: a task
            # nobody awaits is a socket held open past the event loop's last
            # breath, which is where "Task was destroyed but it is pending!"
            # comes from.
            for _, task in pumps.values():
                task.cancel()

    async def _bots(self) -> dict[int, str]:
        """Every connected bot as `bot_id -> token`.

        Read into a plain dict and the session closed at once: the pumps run
        for as long as the app does, and holding a `TelegramAccount` across
        that would be holding a database connection with it.
        """
        async with self._sessions() as session:
            rows = await session.execute(
                select(TelegramAccount.bot_id, TelegramAccount.bot_token)
            )
            return {bot_id: token for bot_id, token in rows.all()}

    async def _pump(self, bot_id: int, token: str) -> None:
        """One bot, asked over and over for what has arrived.

        The webhook goes first — see the class note. A failure there is
        logged and not fatal: if there was no webhook the call was a no-op
        anyway, and if there was one `getUpdates` will say so with a 409 and
        this loop will keep trying.
        """
        logger.info("Polling Telegram for bot %s.", bot_id)
        try:
            await telegram.delete_webhook(token)
        except Exception:
            logger.warning(
                "Could not clear the webhook for bot %s before polling.",
                bot_id,
                exc_info=True,
            )

        while True:
            try:
                updates = await telegram.get_updates(
                    token=token,
                    offset=self._offsets.get(bot_id),
                    wait_seconds=POLL_WAIT,
                )
            except TelegramSendError as exc:
                logger.warning("getUpdates failed for bot %s: %s", bot_id, exc.reason)
                await asyncio.sleep(BACKOFF_SECONDS)
                continue
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.warning(
                    "getUpdates raised for bot %s.", bot_id, exc_info=True
                )
                await asyncio.sleep(BACKOFF_SECONDS)
                continue

            for update in updates:
                update_id = update.get("update_id")
                if isinstance(update_id, int):
                    # Advanced before the message is handled, deliberately. An
                    # update this build cannot store is one it will never be
                    # able to store, and leaving the offset behind would mean
                    # Telegram redelivering it every thirty seconds for as long
                    # as the server runs — a loop that never drains and never
                    # gets to the messages behind it. The failure is logged
                    # instead, which is the same trade the webhook makes when
                    # it answers 200 to something it could not parse.
                    self._offsets[bot_id] = update_id + 1

                message = telegram.parse(update)
                if message is None:
                    continue

                try:
                    await self._deliver(bot_id, message)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.warning(
                        "Could not store a Telegram message for bot %s.",
                        bot_id,
                        exc_info=True,
                    )

    async def _deliver(self, bot_id: int, message: telegram.InboundMessage) -> None:
        """One message into the inbox its bot answers for.

        **A session per message, not one per pump.** These live as long as the
        app does, and a connection checked out for hours is a connection the
        pool has lost; a message is also exactly the unit that should commit or
        roll back on its own.
        """
        async with self._sessions() as session:
            accounts = TelegramAccountRepository(session)
            account = await accounts.get_by_bot_id(bot_id)
            if account is None:
                # Disconnected between the poll and now. The supervisor will
                # stop this pump on its next pass; the message is dropped,
                # which is what a webhook would do with it too.
                return

            channel = _service(session)
            await channel.handle(account, message)


def _service(session: AsyncSession) -> TelegramService:
    """The same service the routes get, assembled without FastAPI.

    `app/api/deps.py` builds this out of `Depends`, which needs a request —
    there is none here. The wiring is repeated rather than the service being
    reshaped to have two constructors: it is four lines, and the alternative is
    a dependency graph that has to know it is sometimes not in a request.
    """
    from app.api.deps import get_business_service, get_conversation_service

    return TelegramService(
        session=session,
        businesses=get_business_service(session),
        accounts=TelegramAccountRepository(session),
        conversations=get_conversation_service(session),
    )
