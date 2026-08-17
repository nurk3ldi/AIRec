# AIRec Backend

FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL 18. Currently implements authentication:
registration, login, token refresh with rotation, logout, the current-user endpoint,
and a 6-digit-code email password reset.

## Setup

No Docker — PostgreSQL 18 runs natively (installed from postgresql.org) as the
Windows service its installer registers, so it starts with the machine and needs
no manual `pg_ctl` step.

```bash
cd backend

python -m venv .venv
.venv\Scripts\activate            # Windows;  source .venv/bin/activate on Unix
pip install -r requirements.txt

copy .env.example .env            # then set SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

One-time database setup, in **pgAdmin**: right-click *Databases* → *Create* →
*Database…*, name it `airec`, owner `postgres`, Save. Then fill in the `DB_*`
values in `.env` (`DB_PASSWORD` is the postgres password from the installer) and
create the schema:

```powershell
alembic upgrade head
```

Then every time you work on the backend — the database is already running as a
Windows service, so there is nothing to start:

```powershell
uvicorn app.main:app --reload   # http://127.0.0.1:8000/docs
```

The connection is configured as separate `DB_HOST` / `DB_PORT` / `DB_NAME` /
`DB_USER` / `DB_PASSWORD` values rather than one URL; `Settings.database_url`
assembles the DSN and URL-quotes the password, so special characters in it can't
corrupt the connection string.

In VS Code, select `backend/.venv` as the interpreter, otherwise the editor reports
the dependencies as missing even though they are installed.

## Commands

| Command | What it does |
| --- | --- |
| `uvicorn app.main:app --reload` | Dev server with autoreload |
| `alembic upgrade head` | Apply migrations |
| `alembic downgrade -1` | Roll back one migration |
| `alembic revision --autogenerate -m "..."` | New migration from model changes |
| `alembic check` | Fail if models and migrations have drifted |
| `ruff check .` / `ruff format .` | Lint / format |
| `Get-Service postgresql-x64-18` | Check the database service (starts with Windows) |

No test suite yet.

## API

All routes are under `/api/v1`. Interactive docs at `/docs`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account, returns user + token pair (201) |
| `GET` | `/auth/username-availability?username=` | Live check for the signup form (no auth) |
| `POST` | `/auth/login` | Sign in with **email or username** in `identifier` |
| `POST` | `/auth/refresh` | Trade a refresh token for a fresh pair |
| `POST` | `/auth/logout` | Revoke one refresh token (204, idempotent) |
| `POST` | `/auth/forgot-password` | Email a 6-digit reset code (always a generic 200, no auth) |
| `POST` | `/auth/reset-password` | `{email, code, new_password}` → resets password, revokes all sessions |
| `GET` | `/auth/me` | Current user; needs `Authorization: Bearer <access>` |
| `PATCH` | `/auth/me` | Partial profile update (first/last name, username) — **not email** |
| `POST` | `/auth/me/password-change` | Emails a 6-digit code to the account's own address |
| `POST` | `/auth/me/password-change/confirm` | `{new_password}` plus **either** `current_password` **or** `code` → sets it, revokes every session, returns a fresh pair |
| `GET` | `/auth/me/email-change` | `{pending_email}` — the address awaiting confirmation, or null |
| `DELETE` | `/auth/me/email-change` | Abandon a pending change (idempotent) |
| `POST` | `/auth/me/email-change` | `{new_email}` → emails a 6-digit code to that address |
| `POST` | `/auth/me/email-change/confirm` | `{code}` → applies the pending change |
| `POST` | `/auth/restore` | `{identifier, password}` → undoes a deletion still inside its grace period |
| `POST` | `/auth/me/delete` | `{current_password, confirmation}` → schedules deletion, signs out everywhere |
| `GET` | `/auth/me/sessions` | Devices currently signed in, with `is_current` |
| `DELETE` | `/auth/me/sessions` | Sign out every device except this one |
| `DELETE` | `/auth/me/sessions/{id}` | Sign out one device |
| `POST` | `/auth/me/avatar` | Upload an avatar (`multipart/form-data`, field `file`) |
| `DELETE` | `/auth/me/avatar` | Remove the current avatar |
| `GET` | `/health` | Liveness probe |

### Business

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/business` | The caller's business, created empty on first access |
| `PATCH` | `/business` | Partial update of the business profile |
| `POST` | `/business/logo` | Upload a logo (`multipart/form-data`, field `file`) |
| `DELETE` | `/business/logo` | Remove the current logo |
| `GET` | `/business/services` | The price list, in the owner's order |
| `PUT` | `/business/services` | Replace the whole price list in one transaction |
| `GET` | `/business/working-hours` | The week; seven rows, created with defaults on first access |
| `PUT` | `/business/working-hours` | Replace the week's opening hours |

### Appointments

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/appointments?from=&to=&status=&query=` | Bookings overlapping a span of **local** days; `query` matches client name or phone (punctuation ignored) and, alone, searches all history |
| `GET` | `/appointments/slots?service_id=&day=&source=` | Start times that service still fits into. `source=manual` (default, the owner) ignores notice and horizon; `source=whatsapp` applies both |
| `POST` | `/appointments` | Book a time (201) |
| `GET` | `/appointments/{id}` | One booking |
| `PATCH` | `/appointments/{id}` | Edit, reschedule, or change status |
| `DELETE` | `/appointments/{id}` | Cancel — sets the status, never deletes the row |

Uploaded images are served as static files from `/media/avatars/<name>.png` and
`/media/logos/<name>.png`.

Every failure comes back in one shape, so the frontend only needs one parser:

```json
{ "error": { "code": "invalid_credentials", "message": "Incorrect login or password." } }
```

422 responses add a `fields` array of `{field, message}`.

## Design notes

- **Layering** — `api` (HTTP) → `services` (rules) → `repositories` (queries) → `models`.
  Services raise `AppError` subclasses and never import FastAPI; `app/main.py` maps
  those to responses.
- **Passwords** — Argon2id, hashed on a worker thread so a login never stalls the
  event loop. Login always runs a verification, even for an unknown account, so
  response time can't be used to enumerate users. Hashes are re-hashed on login when
  the parameters fall behind current defaults.
- **Tokens** — short-lived JWT access token (15 min, stateless) plus an opaque
  refresh token stored only as a SHA-256 digest, which is what makes logout and
  revocation real. Refresh tokens rotate on every use; presenting an already-rotated
  token is treated as theft and revokes every session for that user.
- **Identity** — emails are stored lower-cased with a plain unique index; usernames
  keep their typed casing but are unique case-insensitively via a
  `lower(username)` unique index, which also backs the login lookup.
- **Concurrency** — registration pre-checks for a friendly error, but the unique
  indexes are the real guarantee: a racing duplicate surfaces as `IntegrityError`
  and is mapped back to the same 409.
- **Avatars** — the client crops to a square before uploading, but the server
  never trusts that: `app/core/avatar.py` re-decodes every upload with Pillow
  (rejecting anything that isn't a real image), resizes to a fixed square, and
  re-encodes to PNG under a random filename. Re-encoding is what strips EXIF and
  any payload smuggled inside an otherwise-valid image. Replacing or deleting an
  avatar removes the previous file, but only *after* the row commits, so a failed
  write can't orphan the user's existing picture.
- **Password reset** — unlike login, `/auth/forgot-password` deliberately reveals
  whether an email is registered (404 `email_not_registered` if not), trading
  that enumeration risk for a clearer error on the frontend. A 6-digit code
  (too little entropy to trust a digest alone)
  is protected by a per-code attempt counter instead: 5 wrong tries and even the
  right code stops working, since there's no rate-limiting middleware to lean on.
  Codes are single-use and scoped to one user before any hash comparison happens,
  so two users can't collide into each other's code. A successful reset revokes
  every refresh token for that account. With no `SMTP_HOST` configured (the
  `.env.example` default), the code is logged to the console instead of emailed —
  set `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` in `.env` to send real email.
