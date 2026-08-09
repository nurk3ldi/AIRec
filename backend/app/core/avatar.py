from __future__ import annotations

import io
import uuid
from pathlib import Path

from anyio import to_thread
from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import InvalidAvatar

# Pillow's own decompression-bomb guard is the real defence against a small
# file that expands into gigabytes; keep it well under the default.
Image.MAX_IMAGE_PIXELS = 40_000_000

_OUTPUT_FORMAT = "PNG"
_OUTPUT_SUFFIX = ".png"


def _storage_dir() -> Path:
    directory = Path(settings.avatar_dir)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _process_and_save_sync(raw: bytes) -> str:
    try:
        with Image.open(io.BytesIO(raw)) as image:
            # `verify()` invalidates the handle, so reopen to actually use it.
            image.verify()
        with Image.open(io.BytesIO(raw)) as image:
            image = image.convert("RGB")
            size = settings.avatar_size_px
            # The client crops to a square already; this is the guarantee, not
            # a convenience — a non-square upload would otherwise skew the
            # circular frame the whole UI draws it in.
            image = image.resize((size, size), Image.LANCZOS)

            filename = f"{uuid.uuid4().hex}{_OUTPUT_SUFFIX}"
            # Re-encoding rather than storing the bytes as sent is what strips
            # EXIF and any payload smuggled inside a valid-looking image.
            image.save(_storage_dir() / filename, format=_OUTPUT_FORMAT)
            return filename
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidAvatar from exc


async def save_avatar(raw: bytes) -> str:
    """Validate, normalise, and store an avatar. Returns the stored filename.

    Pillow decoding and disk writes are blocking, so they run on a worker
    thread — same reasoning as Argon2 in `core/security.py`.
    """
    if not raw:
        raise InvalidAvatar("The uploaded file is empty.")
    if len(raw) > settings.avatar_max_bytes:
        megabytes = settings.avatar_max_bytes // (1024 * 1024)
        raise InvalidAvatar(f"Image must be smaller than {megabytes} MB.")
    return await to_thread.run_sync(_process_and_save_sync, raw)


def _delete_sync(filename: str) -> None:
    # missing_ok: a row pointing at an already-deleted file must not break
    # the request that's trying to clean it up.
    (_storage_dir() / filename).unlink(missing_ok=True)


async def delete_avatar(filename: str | None) -> None:
    if not filename:
        return
    await to_thread.run_sync(_delete_sync, filename)


def avatar_url(filename: str | None) -> str | None:
    if not filename:
        return None
    return f"{settings.avatar_url_prefix}/{filename}"
