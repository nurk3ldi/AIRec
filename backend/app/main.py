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

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError
from app.db.session import engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
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


def _field_message(err: dict[str, object]) -> str:
    # A `raise ValueError(...)` inside a field_validator comes back as a
    # "value_error" with that prefix glued on — strip it so custom messages
    # (e.g. the password charset rule) read the way they were written.
    message = str(err["msg"])
    if err["type"] == "value_error" and message.startswith(_PYDANTIC_VALUE_ERROR_PREFIX):
        return message[len(_PYDANTIC_VALUE_ERROR_PREFIX) :]
    return message


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_body(
            "validation_error",
            "Some fields are invalid.",
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
        content=_error_body("internal_error", "Something went wrong."),
    )


@app.get("/health", tags=["meta"], summary="Liveness probe")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix=settings.api_v1_prefix)

# Uploaded avatars are served straight off disk. Created at import time because
# StaticFiles refuses to mount a directory that doesn't exist yet.
_avatar_dir = Path(settings.avatar_dir)
_avatar_dir.mkdir(parents=True, exist_ok=True)
app.mount(
    settings.avatar_url_prefix,
    StaticFiles(directory=_avatar_dir),
    name="avatars",
)
