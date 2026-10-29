# CLAUDE.md

AIRec is an AI receptionist for small service businesses (salons, barbershops) in Kazakhstan: a client writes to the business's Telegram bot, the assistant answers from the business's real price list and hours, and files booking requests the owner confirms.

Two independent apps, no root `package.json` — run commands from inside each:

- `web/` — React 19 + Vite + Tailwind v4 SPA. Rules: `web/CLAUDE.md`.
- `server/` — FastAPI + SQLAlchemy 2 async + PostgreSQL 18 + Alembic. Rules: `server/CLAUDE.md`.

No test suite exists in either app. No TypeScript.

## What exists

| Area | State |
| --- | --- |
| Auth (password, Google, refresh rotation, sessions, account deletion) | done, end to end |
| `/appointments` — bookings calendar (desktop timetable + phone calendar) | done |
| `/inbox` — conversations, thread, composer, archive, bin | done |
| `/assistant` — business profile, services, working hours, Telegram bot | done |
| `/dashboard` — assistant, limit, confirmations, day cards | partly built; two cards still empty |
| `/notes` — folders + notes | done |
| `/notifications` — empty page; the bell's popover window is the real UI | stub |
| Landing `/` | phone splash only; desktop empty on purpose |
| Telegram channel (webhook or polling, photos, avatars) | done, has UI |
| WhatsApp channel (signed webhook, sending, receipts) | backend done, **no UI** on purpose (Telegram leads) |
| Assistant replies via LLM (Gemini) + `request_booking` tool | done |
| Not built | schedule overrides, clients table, plans/metering, SSE/WebSocket, tests |

## Running locally

Both servers must run:

- Backend on `:8000`: PostgreSQL started first, then `uvicorn app.main:app --reload` from `server/`.
- Frontend on `:3000`: `npm run dev` from `web/`.

The browser only talks to port 3000. Vite's `server.proxy` forwards `/api` and `/media` to `127.0.0.1:8000`, so there is no CORS and opening the LAN URL from a phone just works. That is why `web/.env.local` leaves `VITE_API_URL` commented out — set it only to reach a backend the proxy cannot (a deployed one). Port 3000 is `strictPort` because the backend's `CORS_ORIGINS` names it.

`server/.env` is required (copy `.env.example`; `SECRET_KEY` ≥ 32 chars or the app refuses to boot).

## Working rules

- **Russian is the source language** for UI copy and API messages; Kazakh and English are translations. Write `ru` first.
- **The data layer outlives screens.** Screens get redrawn often; `web/src/lib/` and the backend are what the next version builds on. Don't delete lib code or endpoints because a screen stopped using them.
- **UI work:** use the `ui-ux-pro-max` skill for design guidance and the 21st MCP tools for component reference. Brand colours and font are fixed — treat their palette/font suggestions as reference only, unless a rebrand is asked for.
- Reference images live in `design/` at the repo root (sources, never shipped); runtime images in `web/public/`.
