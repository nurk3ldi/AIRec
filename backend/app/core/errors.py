from __future__ import annotations

from http import HTTPStatus


class AppError(Exception):
    """Base class for expected, domain-level failures.

    Services raise these instead of `HTTPException` so the service layer stays
    independent of the transport; `app.main` maps them to responses.
    """

    status_code: int = HTTPStatus.BAD_REQUEST
    code: str = "app_error"
    message: str = "Не удалось обработать запрос."

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.message)
        if message:
            self.message = message


class EmailAlreadyRegistered(AppError):
    status_code = HTTPStatus.CONFLICT
    code = "email_already_registered"
    message = "Этот email уже зарегистрирован."


class UsernameAlreadyTaken(AppError):
    status_code = HTTPStatus.CONFLICT
    code = "username_already_taken"
    message = "Этот логин уже занят."


class InvalidCredentials(AppError):
    status_code = HTTPStatus.UNAUTHORIZED
    code = "invalid_credentials"
    # Deliberately vague: never reveal whether the account exists.
    message = "Неверный логин или пароль."


class InvalidRefreshToken(AppError):
    status_code = HTTPStatus.UNAUTHORIZED
    code = "invalid_refresh_token"
    message = "Сессия недействительна или истекла. Войдите заново."


class InactiveAccount(AppError):
    status_code = HTTPStatus.FORBIDDEN
    code = "inactive_account"
    message = "Аккаунт отключён."


class NotAuthenticated(AppError):
    status_code = HTTPStatus.UNAUTHORIZED
    code = "not_authenticated"
    message = "Требуется вход в систему."


class InvalidResetCode(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "invalid_reset_code"
    # Deliberately generic: wrong code, expired code, and too many attempts
    # all look identical to the caller.
    message = "Код неверный или истёк."


class InvalidEmailCode(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "invalid_email_code"
    # Generic on purpose, like InvalidResetCode: wrong, expired, and
    # out-of-attempts all look the same to the caller.
    message = "Код неверный или истёк."


class NoPendingEmailChange(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "no_pending_email_change"
    message = "Нет запроса на смену email."


class SameEmail(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "same_email"
    message = "Это ваш текущий email."


class InvalidAvatar(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "invalid_avatar"
    message = "Файл не является изображением."


class EmailNotRegistered(AppError):
    status_code = HTTPStatus.NOT_FOUND
    code = "email_not_registered"
    # By design, unlike login/InvalidCredentials: forgot-password intentionally
    # reveals whether an email is registered, trading that enumeration risk for
    # a clearer "that email isn't in our system" message on the frontend.
    message = "Этот email не зарегистрирован."
