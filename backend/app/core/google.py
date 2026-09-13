"""Sign in with Google — the protocol half, knowing nothing about our tables.

**Google's token model, not the ID-token button.** The browser opens Google's
consent popup from this app's own button (`google.accounts.oauth2`
`initTokenClient`) and receives an OAuth access token scoped to
`openid email profile`. Google's rendered "Sign in with Google" button would
have handed over a signed ID token instead, but it draws its own button, and
this product's auth pages already have theirs.

**What makes an access token safe to accept is its audience.** Any Google app
can obtain an access token for a user; accepting one without checking who it
was issued to would let a token minted for another app sign into this one —
the "confused deputy" every OAuth guide warns about. So the token is first
asked to `tokeninfo`, which only answers for a genuine, unexpired token, and its
`aud` (and `azp`, where Google sets it) must be *our* client id. Only then is
`userinfo` asked for the profile, and the two must name the same subject.

**No new dependency.** Verifying an ID token locally needs `cryptography` for
RS256; two calls over the `httpx` this project already has need nothing. The
cost is a round trip to Google on each sign-in — a few hundred milliseconds on
an action somebody performs rarely.

Nothing here raises anything but `GoogleAuthFailed`: the reasons are logged,
because a person at the button can do the same one thing about all of them.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.core.errors import GoogleAuthFailed

logger = logging.getLogger("uvicorn.error")

_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


@dataclass(frozen=True, slots=True)
class GoogleIdentity:
    """Who Google says is at the button — already checked, never raw input."""

    sub: str
    email: str
    first_name: str | None
    last_name: str | None


def _fail(reason: str) -> GoogleAuthFailed:
    logger.warning("Google sign-in refused — %s", reason)
    return GoogleAuthFailed()


async def verify_access_token(access_token: str, client_id: str) -> GoogleIdentity:
    """Confirm the token was issued to `client_id` and return the identity."""
    if not access_token:
        raise _fail("empty token")

    try:
        async with httpx.AsyncClient(timeout=settings.google_timeout_seconds) as http:
            info = await http.get(
                settings.google_tokeninfo_url, params={"access_token": access_token}
            )
            if info.status_code != httpx.codes.OK:
                raise _fail(f"tokeninfo answered {info.status_code}")
            claims = info.json()

            # The audience test is the whole of what makes this safe — see the
            # module docstring.
            if claims.get("aud") != client_id:
                raise _fail("token issued to another client")
            if claims.get("azp") not in (None, client_id):
                raise _fail("token authorised for another party")
            if claims.get("iss") not in (None, *_ISSUERS):
                raise _fail("unexpected issuer")

            profile = await http.get(
                settings.google_userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if profile.status_code != httpx.codes.OK:
                raise _fail(f"userinfo answered {profile.status_code}")
            user = profile.json()
    except httpx.HTTPError as exc:
        raise _fail(f"Google unreachable: {exc}") from exc
    except ValueError as exc:  # a body that was not JSON
        raise _fail(f"unreadable answer: {exc}") from exc

    sub = user.get("sub")
    email = (user.get("email") or "").strip().lower()
    # Both calls must be about the same person, or a token was swapped between
    # them.
    if not sub or sub != claims.get("sub"):
        raise _fail("subject mismatch between tokeninfo and userinfo")
    if not email:
        raise _fail("no email on the account")
    # **An unverified Google address proves nothing about the mailbox**, and
    # the address is what an existing account is matched on — so it is refused
    # outright rather than trusted a little.
    if user.get("email_verified") not in (True, "true"):
        raise _fail("email not verified by Google")

    return GoogleIdentity(
        sub=sub,
        email=email,
        first_name=(user.get("given_name") or None),
        last_name=(user.get("family_name") or None),
    )
