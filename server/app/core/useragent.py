"""Turning a User-Agent string into something a person recognises.

Deliberately a handful of substring checks rather than a parsing library: the
only job is to help someone spot *their own* device in a list, and for that
"Chrome, Windows" is as useful as an exact version. Anything unrecognised falls
back to a neutral label instead of showing the raw header.
"""

from __future__ import annotations

from typing import Final

_UNKNOWN: Final = "Неизвестное устройство"

# Order matters: Edge and Opera both claim to be Chrome, and Chrome claims to be
# Safari, so the more specific names have to be tested first.
_BROWSERS: Final[tuple[tuple[str, str], ...]] = (
    ("Edg/", "Edge"),
    ("OPR/", "Opera"),
    ("YaBrowser", "Яндекс.Браузер"),
    ("Firefox/", "Firefox"),
    ("Chrome/", "Chrome"),
    ("Safari/", "Safari"),
)

# Likewise: Android also contains "Linux", and iPadOS reports as Mac in desktop
# mode, so the mobile checks come first.
_PLATFORMS: Final[tuple[tuple[str, str], ...]] = (
    ("Android", "Android"),
    ("iPhone", "iPhone"),
    ("iPad", "iPad"),
    ("Windows", "Windows"),
    ("Mac OS X", "macOS"),
    ("Linux", "Linux"),
)


def _first_match(value: str, table: tuple[tuple[str, str], ...]) -> str | None:
    return next((label for needle, label in table if needle in value), None)


def describe_device(user_agent: str | None) -> str:
    if not user_agent:
        return _UNKNOWN

    browser = _first_match(user_agent, _BROWSERS)
    platform = _first_match(user_agent, _PLATFORMS)

    if browser and platform:
        return f"{browser}, {platform}"
    return browser or platform or _UNKNOWN
