from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from http import HTTPStatus
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError
from app.db.session import engine

logger = logging.getLogger(__name__)

# Uvicorn configures this logger (it's the one printing "Application startup
# complete"), so startup lines land in the terminal in the same format. A plain
# module logger would be swallowed — the root logger defaults to WARNING.
startup_logger = logging.getLogger("uvicorn.error")


async def _purge_deleted_accounts() -> None:
    """Remove accounts whose grace period has expired.

    Run at startup because this project has no scheduler. That makes the 30 days
    real without extra infrastructure, but it also means the purge only happens
    when the server restarts — point a cron at `AuthService.purge_deleted_accounts`
    when there is somewhere to run one.
    """
    from app.api.deps import build_auth_service
    from app.db.session import session_factory

    try:
        async with session_factory() as session:
            removed = await build_auth_service(session).purge_deleted_accounts()
    except Exception as exc:  # never let housekeeping stop the server booting
        startup_logger.error("Purge of deleted accounts FAILED — %s", exc)
        return

    if removed:
        startup_logger.info(
            "Purged %d account(s) past the deletion grace period", removed
        )


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    startup_logger.info("Server started — %s", settings.app_name)

    # Reported rather than raised: a dead database shouldn't turn startup into a
    # traceback, and saying "connected" without checking would be a lie.
    target = (
        f"{settings.db_user}@{settings.db_host}:"
        f"{settings.db_port}/{settings.db_name}"
    )
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as exc:  # any driver error is worth showing, not raising
        startup_logger.error("Database connection FAILED — %s: %s", target, exc)
    else:
        startup_logger.info("Database connected — %s", target)
        await _purge_deleted_accounts()

    yield
    # Close pooled connections so shutdown doesn't leave sockets behind.
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error_body(code: str, message: str, **extra: object) -> dict[str, object]:
    """One error envelope for every failure, so the frontend parses one shape."""
    return {"error": {"code": code, "message": message, **extra}}


@app.exception_handler(AppError)
async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
    headers = (
        {"WWW-Authenticate": "Bearer"}
        if exc.status_code == HTTPStatus.UNAUTHORIZED
        else None
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(exc.code, exc.message),
        headers=headers,
    )


_PYDANTIC_VALUE_ERROR_PREFIX = "Value error, "

# Pydantic's own messages are English and can't be localised in place, so the
# handful a client can actually trigger are mapped here. Anything validated by
# our own `field_validator` already raises Russian and never reaches this map.
_PYDANTIC_MESSAGES_RU = {
    "missing": "Обязательное поле.",
    "string_type": "Ожидается текст.",
    "string_too_short": "Слишком короткое значение.",
    "string_too_long": "Слишком длинное значение.",
    "json_invalid": "Некорректный формат запроса.",
}
_EMAIL_ERROR_PREFIX = "value is not a valid email address"


def _field_message(err: dict[str, object]) -> str:
    message = str(err["msg"])
    error_type = str(err["type"])

    # EmailStr reports through "value_error" like our own validators do, so it
    # has to be matched on text rather than type.
    if message.startswith(_EMAIL_ERROR_PREFIX):
        return "Некорректный email."

    # A `raise ValueError(...)` inside a field_validator comes back as a
    # "value_error" with that prefix glued on — strip it so custom messages
    # (e.g. the password charset rule) read the way they were written.
    if error_type == "value_error" and message.startswith(_PYDANTIC_VALUE_ERROR_PREFIX):
        return message[len(_PYDANTIC_VALUE_ERROR_PREFIX) :]

    return _PYDANTIC_MESSAGES_RU.get(error_type, message)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_body(
            "validation_error",
            "Некоторые поля заполнены неверно.",
            fields=[
                {
                    "field": ".".join(str(part) for part in err["loc"][1:]),
                    "message": _field_message(err),
                }
                for err in exc.errors()
            ],
        ),
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    # Log the detail, return none of it — internals must not leak to clients.
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_body("internal_error", "Что-то пошло не так."),
    )


@app.get("/health", tags=["meta"], summary="Liveness probe")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix=settings.api_v1_prefix)

# Uploaded images are served straight off disk. The directories are created at
# import time because StaticFiles refuses to mount one that doesn't exist yet.
for _prefix, _directory, _name in (
    (settings.avatar_url_prefix, settings.avatar_dir, "avatars"),
    (settings.logo_url_prefix, settings.logo_dir, "logos"),
):
    _path = Path(_directory)
    _path.mkdir(parents=True, exist_ok=True)
    app.mount(_prefix, StaticFiles(directory=_path), name=_name)
