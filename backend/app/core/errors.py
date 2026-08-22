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

    def __init__(self, message: str | None = None, **params: object) -> None:
        super().__init__(message or self.message)
        if message:
            self.message = message
        # `message` is a Russian `str.format` template and `params` are what
        # fills it. They stay apart until the response is rendered, because by
        # then the request's language is known and the same values have to go
        # into whichever wording won — an f-string here would bake the Russian
        # in and leave nothing to translate. See `app/core/i18n.py`.
        self.params = params


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


class AccountDeleted(AppError):
    """Signed in with an account that is inside its deletion grace period.

    Distinct from `InactiveAccount`: this one is the user's own doing and is
    reversible, so the message carries the deadline and the frontend offers to
    restore instead of just refusing.
    """

    status_code = HTTPStatus.FORBIDDEN
    code = "account_deleted"
    message = "Аккаунт удалён."


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


class InvalidCurrentPassword(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "invalid_current_password"
    message = "Неверный текущий пароль."


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


class DeleteConfirmationMismatch(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "delete_confirmation_mismatch"
    message = "Введите ваше имя пользователя, чтобы подтвердить удаление."


class SessionNotFound(AppError):
    status_code = HTTPStatus.NOT_FOUND
    code = "session_not_found"
    message = "Сеанс не найден или уже завершён."


class InvalidImage(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "invalid_image"
    message = "Файл не является изображением."


class ServiceNotFound(AppError):
    status_code = HTTPStatus.NOT_FOUND
    code = "service_not_found"
    message = "Услуга не найдена."


class ServiceInactive(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "service_inactive"
    # Distinct from "not found": the owner hid it on purpose, and the fix is to
    # switch it back on rather than to recreate it.
    message = "Услуга отключена и недоступна для записи."


class AppointmentNotFound(AppError):
    status_code = HTTPStatus.NOT_FOUND
    code = "appointment_not_found"
    message = "Запись не найдена."


class OutsideWorkingHours(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "outside_working_hours"
    message = "В это время бизнес не работает."


class SlotUnavailable(AppError):
    """Every place is taken for the requested time.

    A conflict rather than a bad request: nothing about the request is wrong,
    it simply lost the race — and the caller's next move is to pick another
    time, not to fix a field.
    """

    status_code = HTTPStatus.CONFLICT
    code = "slot_unavailable"
    message = "Это время уже занято."


class BookingTooSoon(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "booking_too_soon"
    message = "Слишком мало времени до начала записи."


class BookingTooFar(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "booking_too_far"
    message = "Так далеко записаться нельзя."


class EmailNotRegistered(AppError):
    status_code = HTTPStatus.NOT_FOUND
    code = "email_not_registered"
    # By design, unlike login/InvalidCredentials: forgot-password intentionally
    # reveals whether an email is registered, trading that enumeration risk for
    # a clearer "that email isn't in our system" message on the frontend.
    message = "Этот email не зарегистрирован."
