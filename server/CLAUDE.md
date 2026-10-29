# server/CLAUDE.md

FastAPI + SQLAlchemy 2.0 async + asyncpg + PostgreSQL 18 + Alembic. Endpoint table and setup: `README.md`. No tests.

## Commands (from `server/`, venv active)

- `pip install -r requirements.txt` — versions pinned (`pyproject.toml` is tooling config only)
- `alembic upgrade head`; `alembic check` fails on model/migration drift
- `uvicorn app.main:app --reload` — docs at `/docs`
- `ruff check .` (RUF001–003 disabled on purpose: Cyrillic is intentional)
- `PYTHONPATH=. python -m app.core.i18n` — checks API message translations (non-zero exit on gaps); run after changing any user-facing message

PostgreSQL runs natively (no Docker), database `airec`, user `postgres`. `.env` uses separate `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`; `settings.database_url` assembles the DSN and `quote_plus`-escapes the password (so `@` or `/` in it can't break the DSN).

## Structure rules

- Direction: `app/api` (HTTP) → `app/services` (rules) → `app/repositories` (queries) → `app/models`. Services never import FastAPI or raise `HTTPException`; they raise `AppError` subclasses (`app/core/errors.py`), mapped to responses in `app/main.py`. All `select()`s live in repositories.
- Every error is `{"error": {"code", "message"}}` (422 adds `fields`). Keep that shape.
- `app/core/config.py` is the only reader of the environment — import `settings`.
- New model → add to `app/models/__init__.py` or autogenerate won't see it. Naming convention is in `app/db/base.py`; don't rename constraints that code matches by name (`uq_users_email`, `uq_users_username_lower`).
- Partial updates: every PATCH schema field is optional and the service reads `model_dump(exclude_unset=True)` / `"x" in changes` — that is what distinguishes "omitted" from "sent as null". Explicit `null` is often meaningful (unhook a service, clear a colour, make a booking open-ended).
- **Every business-owned read is scoped by owner.** `BusinessRepository` has no `get_by_id` on purpose. The only unscoped lookups are webhook routing (`WhatsAppAccountRepository.get_by_phone_number_id` after signature check, `TelegramAccountRepository.get_by_webhook_secret`) and housekeeping sweeps.
- CPU-heavy or blocking work (Argon2, SHA, Pillow, smtplib) runs via `anyio.to_thread`.
- Logs that must be visible go to the `uvicorn.error` logger (no logging config exists).
- Background work: `app/main.py` lifespan purges deleted accounts at startup, runs the conversation bin sweep every `conversation_bin_sweep_hours`, and the Telegram poller if enabled. Each has its own session and logs failures instead of raising.
- `tzdata` is required (no IANA database otherwise on some systems → `ZoneInfoNotFoundError`).

## Messages and language

- Russian source text lives in the code (`AppError.message`, validator `ValueError`s). `app/core/i18n.py` holds `kk`/`en` keyed by the Russian string; `negotiate()` reads `Accept-Language` per request in the exception handlers.
- Editing a Russian message silently breaks its translations → run the i18n check.
- Messages with values are `str.format` templates; pass values as `AppError(..., **params)`, never f-strings.
- Constraints whose wording matters are `field_validator`s raising Russian `ValueError`s, not `Field(min_length=…)` (Pydantic messages are English). `_PYDANTIC_MESSAGES_RU` covers built-ins; `_field_message` strips Pydantic's "Value error, " prefix and special-cases `EmailStr`.
- Emails (`app/core/email.py`) are Russian only. Without `SMTP_HOST`, codes are logged as WARNING instead of sent (dev mode).

## Auth

- Argon2id on a worker thread. Login always verifies against a dummy hash when the user doesn't exist (timing must not reveal accounts) — don't optimise that away.
- Access: 15-min JWT with `sid` = session family. Refresh: opaque, stored as SHA-256, rotates on every use. A session = a token family; exactly one live row per family, enforced by partial unique index `uq_refresh_tokens_live_family`. `family_id`, `remember`, `user_agent`, `ip_address`, `first_seen_at` are carried across rotation.
- Concurrent refresh: `RefreshTokenRepository.revoke` is a conditional UPDATE that reports whether it won. Replay of a rotated token revokes all sessions **unless** it was revoked within `refresh_token_reuse_grace_seconds` *and* its family still has a live token — then it's just a 401.
- `remember` picks refresh lifetime (30 days vs 12 hours). `_issue_tokens(remember=…)` is keyword-only with no default so every caller decides. Schema default is `False` (fail safe).
- Emails lowercase + unique; usernames keep casing, unique on `lower(username)`. Uniqueness races surface as `IntegrityError` mapped to the same 409.
- Password policy: 8–128 chars, charset checked on register/reset only (`validate_password_charset`, shared).
- Password reset: 6-digit codes, SHA-256, 10-min TTL, scoped by user, `attempts` ceiling is the real brute-force defence (no rate limiter exists). Success revokes all sessions. `forgot-password` returns 404 for unknown emails (deliberate trade-off).
- Password change in session: exactly one proof — current password *or* emailed code (model validator). Revokes all sessions including the caller's and returns a new token pair (client must save it).
- Email change: `PATCH /auth/me` has no `email`. Code goes to the new address; `users.email` changes only on confirm, which re-checks availability. `email_verified_at` is set only here (registration never verifies).
- Account deletion: soft (`deleted_at`), 30-day grace, proof = password + typed username (no code path, so a reset code can't delete an account). Separate from `is_active`. `get_current_user` also rejects deleted accounts. Email/username stay taken during grace. `POST /auth/restore` restores and signs in.
- Google (`POST /auth/google`, `app/core/google.py`): access token verified via `tokeninfo` (`aud`/`azp` must equal our `GOOGLE_CLIENT_ID`) then `userinfo` (same `sub`, verified email). No client secret, no extra dependency. Lookup by `users.google_sub`, then by email. New accounts have no password. Linking to an **unverified** password account clears its password and sessions (pre-hijacking defence). Set `is_active=True` explicitly on new rows. Unset `GOOGLE_CLIENT_ID` is a valid state (`GET /auth/providers`).

## Images

`app/core/images.py`: separate stores (`AVATAR_STORE`, `LOGO_STORE`, chat photos in `uploads/chat`) because each dies with a different owner. DB stores filename only; URLs are computed properties. Every upload is re-encoded through Pillow (rejects non-images, strips EXIF). Old files are deleted only after the new row commits; deletion of rows deletes files after commit.

## Business

- One per account (`owner_id` unique), created lazily on first `GET /business`. `timezone` defaults to `Asia/Almaty`, can't be nulled, validated by constructing `ZoneInfo`.
- `PUT /business/services` and `PUT /business/working-hours` replace the whole list in one transaction (match by id within this business; missing → deleted; unknown id → created).
- Working hours: always 7 rows, `weekday` 0 = Monday. `is_24h` flag with null times (never `00:00–00:00`). Overnight spans are rejected, not wrapped. Day coherence is validated on the schema; frontend `lib/schedule.js` mirrors it.
- Working hours, breaks and service durations are on a 15-minute grid (`SLOT_MINUTES`). Booking times written by the owner are not.
- `assistant_enabled` on the business is the global switch, separate from per-thread switches.

## Bookings (`app/services/appointment.py`)

- Statuses: `pending` (assistant), `confirmed`, `completed`, `cancelled`, `no_show`. Only `cancelled` frees time (`BLOCKING_STATUSES`).
- Cancelling is a status; `DELETE` removes a booking that should never have existed. Archiving (`archived_at`) is a view flag: date listings hide archived rows, search shows them, availability always counts them.
- `service_id` optional and `ON DELETE SET NULL`; `service_name`/`price`/`duration_minutes` are snapshots (editing the price list must not rewrite history). Without a service all three are required. Changing `service_id` re-snapshots and counts as a move.
- Open-ended bookings: `ends_at` and `duration_minutes` both NULL. They occupy nothing (`list_blocking(occupying_only=True)`), but `list_in_range` must include them by start. Explicit `null` duration = open-ended; omission = service length if any.
- `ends_at` is stored (indexable overlap), and the service is its only writer.
- All arithmetic in absolute time with `Window`s built over day−1/day/day+1 and merged, so midnight and breaks work.
- Client rules (notice `min_lead_minutes` default 0, horizon, opening hours, capacity) apply to client sources only. Owner (`manual`) bookings skip all of them — the panel warns instead. `GET /appointments/slots?source=` defaults to `manual` like `POST` (the picker must match what create accepts).
- Create/move takes `BusinessRepository.lock` (`SELECT … FOR UPDATE`) before counting occupancy.
- Placement is re-checked only when the time actually changes; capacity when the booking starts occupying something new.
- `?query=` searches name and phone ignoring punctuation; without `from`/`to` it searches the whole history.
- `color`: nullable, closed set `BOOKING_COLORS` (names, not hexes).
- A pending booking with `conversation_id` turning `confirmed`/`cancelled` triggers `schedule_decision` → the assistant tells the client (even if the thread's assistant is off).

## Conversations (`app/services/conversation.py`)

- `MessageAuthor`: `client` / `assistant` / `owner`. **An owner message sets `assistant_enabled = False` on the thread**, in the service so it holds for every path; only an explicit PATCH turns it back on.
- Status `new` → `open` → `closed` (manual). "Live" (`conversation_active_minutes` window) and "awaiting reply" are derived, never stored.
- Last message is denormalised (`last_message_at/author/preview`); `_remember_last` is the single writer (incl. after deletes).
- `archived_at`, `deleted_at` (bin), `starred_at` are timestamps; API takes booleans. Bin listing ignores `archived`; archiving clears `deleted` unless the same PATCH sets it. A new client message un-bins and reopens. `count_unread` skips binned threads.
- `DELETE` = forever, removes message photo files after commit. Bin sweep after `conversation_bin_days` (30) uses `take_expired_bin` with `FOR UPDATE SKIP LOCKED`. `purge_at` is derived, not stored.
- `ingest_for_business` is the single entrance for inbound messages: finds/opens the thread, dedupes by `messages.external_id`, bumps `unread_count`. On `IntegrityError` (concurrent redelivery) it rolls back and retries once.
- `client_phone` is nullable (Telegram usually has none); nothing may assume a phone. `client_username` is overwritten on each message.
- Replies are committed first, then delivered (`_deliver`) outside the transaction; delivery never raises — failures are stored as `messages.status`/`error` (a human sentence). Inbound messages have `status = NULL`.
- Search covers name, `@username`, phone digits and message text.
- `unread_count` clears only on `POST /conversations/{id}/read`.

## Channels

Protocol code in `app/core/<channel>.py` knows nothing of our tables; `app/services/<channel>.py` joins them and owns no conversation rules (it calls `ingest_for_business`). `parse()` never raises and returns `None` for anything unsupported.

**Telegram** (primary):
- `PUT /business/telegram` takes only the bot token; verifies with `getMe` before storing; registers the webhook itself when `PUBLIC_BASE_URL` is set. Don't derive that URL from request headers.
- `webhook_secret` (generated, never returned) is both routing key and proof via `X-Telegram-Bot-Api-Secret-Token`.
- `TELEGRAM_POLLING=true` uses `getUpdates` instead (for dev without a public URL): calls `deleteWebhook` first, one task per bot, offset in memory, advanced before handling, supervisor re-reads bots every 30s. 409 = another poller or a lingering webhook.
- No delivery receipts (messages stop at `sent`), no 24h window, but the client must have pressed Start; `external_id` is the only address.
- Private chats only; edits ignored; photos downloaded (largest size) and re-encoded via `save_photo`, `body` keeps `[фото] caption` for search/preview; other media → placeholder. A shared contact becomes the phone only if it's the sender's own. Client avatars refreshed at most daily (`refresh_avatar`), never raising.

**WhatsApp** (backend only, no UI):
- HMAC signature over raw body bytes, `compare_digest`; unset `WHATSAPP_APP_SECRET` refuses everything. Answer 200 to anything genuinely Meta's (non-200 causes redelivery and eventually disabling). GET is the subscription handshake (plain-text challenge).
- Credentials in `whatsapp_accounts`, token write-only (omitted on PUT = keep).
- Receipts arrive out of order — `STATUS_RANK` decides; `failed` outranks all. Unknown `wamid` is ignored.

## Assistant (`app/services/assistant.py`, `app/core/llm.py`)

- Channels call `schedule_reply(conversation_id, message_id)` after ingest; the reply runs in its own task and session (webhook returns at once). Tasks are held in a module-level set (weak refs otherwise).
- `app/core/llm.py` is the only file that talks to a model; `LLM_PROVIDER` dispatches; only `gemini` exists (REST over `httpx`, key in header, merge consecutive turns, drop `thought` parts). Adding a provider = one function + key. No key = assistant silent (valid state).
- Silence checks run before and after the model call: business switch off, thread switch off, thread binned, or the triggering message is no longer the newest (this coalesces bursts and drops replies the owner overtook). Model errors are logged; the message waits.
- The prompt is built only from DB data (business, active services, hours, current time in the business zone). Owner messages are marked as the administrator's.
- Tool `request_booking` (`app/core/booking_tool.py`): files a `pending` booking with client rules applied, in its own session; refusals return `{ok: false, error}` to the model; one pending request per chat (a second call moves it). Function calls are sent back unchanged (signed by thinking models), up to `MAX_TOOL_ROUNDS`.
