from __future__ import annotations

import io
import uuid
from dataclasses import dataclass
from pathlib import Path

from anyio import to_thread
from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import InvalidImage

# Pillow's own decompression-bomb guard is the real defence against a small
# file that expands into gigabytes; keep it well under the default.
Image.MAX_IMAGE_PIXELS = 40_000_000

_OUTPUT_FORMAT = "PNG"
_OUTPUT_SUFFIX = ".png"


@dataclass(frozen=True, slots=True)
class ImageStore:
    """Where one kind of uploaded image lives.

    Avatars and business logos get separate directories and URL prefixes rather
    than sharing one: they have different lifetimes (an avatar dies with its
    user, a logo with its business), and mixing them would make a cleanup pass
    over either one dangerous.
    """

    directory: Path
    url_prefix: str

    def path(self) -> Path:
        self.directory.mkdir(parents=True, exist_ok=True)
        return self.directory


AVATAR_STORE = ImageStore(Path(settings.avatar_dir), settings.avatar_url_prefix)
LOGO_STORE = ImageStore(Path(settings.logo_dir), settings.logo_url_prefix)


def _process_and_save_sync(store: ImageStore, raw: bytes) -> str:
    try:
        with Image.open(io.BytesIO(raw)) as image:
            # `verify()` invalidates the handle, so reopen to actually use it.
            image.verify()
        with Image.open(io.BytesIO(raw)) as image:
            image = image.convert("RGB")
            size = settings.image_size_px
            # The client crops to a square already; this is the guarantee, not
            # a convenience — a non-square upload would otherwise skew the
            # frame the UI draws it in.
            image = image.resize((size, size), Image.LANCZOS)

            filename = f"{uuid.uuid4().hex}{_OUTPUT_SUFFIX}"
            # Re-encoding rather than storing the bytes as sent is what strips
            # EXIF and any payload smuggled inside a valid-looking image.
            image.save(store.path() / filename, format=_OUTPUT_FORMAT)
            return filename
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImage from exc


async def save_image(store: ImageStore, raw: bytes) -> str:
    """Validate, normalise, and store an image. Returns the stored filename.

    Pillow decoding and disk writes are blocking, so they run on a worker
    thread — same reasoning as Argon2 in `core/security.py`.
    """
    if not raw:
        raise InvalidImage("Загруженный файл пуст.")
    if len(raw) > settings.image_max_bytes:
        megabytes = settings.image_max_bytes // (1024 * 1024)
        raise InvalidImage(f"Изображение должно быть меньше {megabytes} МБ.")
    return await to_thread.run_sync(_process_and_save_sync, store, raw)


def _delete_sync(store: ImageStore, filename: str) -> None:
    # missing_ok: a row pointing at an already-deleted file must not break
    # the request that's trying to clean it up.
    (store.path() / filename).unlink(missing_ok=True)


async def delete_image(store: ImageStore, filename: str | None) -> None:
    if not filename:
        return
    await to_thread.run_sync(_delete_sync, store, filename)


def image_url(store: ImageStore, filename: str | None) -> str | None:
    if not filename:
        return None
    return f"{store.url_prefix}/{filename}"
