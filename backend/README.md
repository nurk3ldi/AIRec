# AIRec Backend

FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL 18. Currently implements authentication:
registration, login, token refresh with rotation, logout, and the current-user endpoint.

## Setup

No Docker — PostgreSQL 18 runs natively (installed from postgresql.org), with its
own data directory local to this project.

```bash
cd backend

python -m venv .venv
.venv\Scripts\activate            # Windows;  source .venv/bin/activate on Unix
pip install -r requirements.txt

copy .env.example .env            # then set SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

One-time database setup (PowerShell; adjust the PostgreSQL path to your install):

```powershell
$PGBIN = "C:\Program Files\PostgreSQL\18\bin"
& "$PGBIN\initdb.exe" -D .pgdata -U postgres -A trust -E UTF8 --locale=C
& "$PGBIN\pg_ctl.exe" -D .pgdata -l .pglog start
& "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -c "CREATE ROLE airec LOGIN PASSWORD 'airec';"
& "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -c "CREATE DATABASE airec OWNER airec;"
```

Then every time you work on the backend:

```powershell
$PGBIN = "C:\Program Files\PostgreSQL\18\bin"
& "$PGBIN\pg_ctl.exe" -D .pgdata -l .pglog start   # if not already running
alembic upgrade head                                # only needed after a fresh initdb
uvicorn app.main:app --reload                        # http://127.0.0.1:8000/docs
```

`pg_ctl ... stop` shuts the database back down. It isn't a Windows service, so it
does not survive a reboot — start it again with the command above.

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
| `pg_ctl -D .pgdata start` / `stop` | Start / stop the local PostgreSQL process |

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
| `GET` | `/auth/me` | Current user; needs `Authorization: Bearer <access>` |
| `GET` | `/health` | Liveness probe |

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
