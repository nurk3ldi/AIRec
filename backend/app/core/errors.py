from __future__ import annotations

from http import HTTPStatus


class AppError(Exception):
    """Base class for expected, domain-level failures.

    Services raise these instead of `HTTPException` so the service layer stays
    independent of the transport; `app.main` maps them to responses.
    """

    status_code: int = HTTPStatus.BAD_REQUEST
    code: str = "app_error"
    message: str = "Request could not be processed."

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.message)
        if message:
            self.message = message


class EmailAlreadyRegistered(AppError):
    status_code = HTTPStatus.CONFLICT
    code = "email_already_registered"
    message = "This email is already registered."


class UsernameAlreadyTaken(AppError):
    status_code = HTTPStatus.CONFLICT
    code = "username_already_taken"
    message = "This username is already taken."


class InvalidCredentials(AppError):
    status_code = HTTPStatus.UNAUTHORIZED
    code = "invalid_credentials"
    # Deliberately vague: never reveal whether the account exists.
    message = "Incorrect login or password."


class InvalidRefreshToken(AppError):
    status_code = HTTPStatus.UNAUTHORIZED
    code = "invalid_refresh_token"
    message = "Refresh token is invalid, expired, or already used."


class InactiveAccount(AppError):
    status_code = HTTPStatus.FORBIDDEN
    code = "inactive_account"
    message = "This account is disabled."


class NotAuthenticated(AppError):
    status_code = HTTPStatus.UNAUTHORIZED
    code = "not_authenticated"
    message = "Authentication required."


class InvalidResetCode(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "invalid_reset_code"
    # Deliberately generic: wrong code, expired code, and too many attempts
    # all look identical to the caller.
    message = "This code is invalid or has expired."


class InvalidAvatar(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "invalid_avatar"
    message = "That file isn't a valid image."


class EmailNotRegistered(AppError):
    status_code = HTTPStatus.NOT_FOUND
    code = "email_not_registered"
    # By design, unlike login/InvalidCredentials: forgot-password intentionally
    # reveals whether an email is registered, trading that enumeration risk for
    # a clearer "that email isn't in our system" message on the frontend.
    message = "This email is not registered."
