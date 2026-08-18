from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile, status

from app.api.deps import AuthServiceDep, ClientInfoDep, CurrentUser, TokenClaims
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    ConfirmEmailChangeRequest,
    DeleteAccountRequest,
    EmailChangeRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    PendingEmailChange,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SessionPublic,
    UpdateProfileRequest,
    UsernameAvailability,
    UserPublic,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account and sign in",
)
async def register(
    payload: RegisterRequest, auth: AuthServiceDep, client: ClientInfoDep
) -> AuthResponse:
    user, tokens = await auth.register(payload, client=client)
    return AuthResponse(user=UserPublic.model_validate(user), tokens=tokens)


@router.get(
    "/username-availability",
    response_model=UsernameAvailability,
    summary="Check whether a username is free, for live signup-form feedback",
)
async def username_availability(
    auth: AuthServiceDep,
    username: Annotated[str, Query(min_length=1, max_length=32)],
) -> UsernameAvailability:
    available = await auth.check_username_available(username)
    return UsernameAvailability(available=available)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Sign in with an email or a username",
)
async def login(
    payload: LoginRequest, auth: AuthServiceDep, client: ClientInfoDep
) -> AuthResponse:
    user, tokens = await auth.authenticate(
        payload.identifier,
        payload.password,
        remember=payload.remember,
        client=client,
    )
    return AuthResponse(user=UserPublic.model_validate(user), tokens=tokens)


@router.post(
    "/refresh",
    response_model=AuthResponse,
    summary="Exchange a refresh token for a new pair",
)
async def refresh(payload: RefreshRequest, auth: AuthServiceDep) -> AuthResponse:
    user, tokens = await auth.refresh(payload.refresh_token)
    return AuthResponse(user=UserPublic.model_validate(user), tokens=tokens)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the current refresh token",
)
async def logout(payload: RefreshRequest, auth: AuthServiceDep) -> None:
    await auth.logout(payload.refresh_token)


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Email a 6-digit password reset code",
)
async def forgot_password(
    payload: ForgotPasswordRequest, auth: AuthServiceDep
) -> MessageResponse:
    await auth.forgot_password(payload.email)
    return MessageResponse(message="Код отправлен на вашу почту.")


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset a password using the emailed code",
)
async def reset_password(
    payload: ResetPasswordRequest, auth: AuthServiceDep
) -> MessageResponse:
    await auth.reset_password(payload.email, payload.code, payload.new_password)
    return MessageResponse(message="Пароль изменён. Теперь вы можете войти.")


@router.post(
    "/restore",
    response_model=AuthResponse,
    summary="Undo a deletion that is still inside its grace period",
)
async def restore_account(
    payload: LoginRequest, auth: AuthServiceDep, client: ClientInfoDep
) -> AuthResponse:
    user, tokens = await auth.restore_account(
        payload.identifier,
        payload.password,
        remember=payload.remember,
        client=client,
    )
    return AuthResponse(user=UserPublic.model_validate(user), tokens=tokens)


@router.get("/me", response_model=UserPublic, summary="The signed-in user")
async def me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)


@router.patch(
    "/me",
    response_model=UserPublic,
    summary="Update the signed-in user's profile",
)
async def update_me(
    payload: UpdateProfileRequest, user: CurrentUser, auth: AuthServiceDep
) -> UserPublic:
    updated = await auth.update_profile(user, payload)
    return UserPublic.model_validate(updated)


@router.get(
    "/me/email-change",
    response_model=PendingEmailChange,
    summary="The address awaiting confirmation, if any",
)
async def pending_email_change(
    user: CurrentUser, auth: AuthServiceDep
) -> PendingEmailChange:
    return PendingEmailChange(pending_email=await auth.get_pending_email_change(user))


@router.delete(
    "/me/email-change",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Abandon a pending email change",
)
async def cancel_email_change(user: CurrentUser, auth: AuthServiceDep) -> None:
    await auth.cancel_email_change(user)


@router.post(
    "/me/email-change",
    response_model=MessageResponse,
    summary="Email a 6-digit code to a new address to confirm a change",
)
async def request_email_change(
    payload: EmailChangeRequest, user: CurrentUser, auth: AuthServiceDep
) -> MessageResponse:
    await auth.request_email_change(user, payload.new_email)
    return MessageResponse(message="Код отправлен на новый адрес.")


@router.post(
    "/me/email-change/confirm",
    response_model=UserPublic,
    summary="Apply the pending email change using the emailed code",
)
async def confirm_email_change(
    payload: ConfirmEmailChangeRequest, user: CurrentUser, auth: AuthServiceDep
) -> UserPublic:
    updated = await auth.confirm_email_change(user, payload.code)
    return UserPublic.model_validate(updated)


@router.post(
    "/me/password-change",
    response_model=MessageResponse,
    summary="Email a 6-digit code to authorise a password change",
)
async def request_password_change(
    user: CurrentUser, auth: AuthServiceDep
) -> MessageResponse:
    await auth.request_password_change(user)
    return MessageResponse(message="Код отправлен на вашу почту.")


@router.post(
    "/me/password-change/confirm",
    response_model=AuthResponse,
    summary=(
        "Set a new password, proved by the current one or a mailed code; "
        "revokes every session and re-issues this one"
    ),
)
async def confirm_password_change(
    payload: ChangePasswordRequest,
    user: CurrentUser,
    claims: TokenClaims,
    auth: AuthServiceDep,
) -> AuthResponse:
    updated, tokens = await auth.change_password(
        user,
        payload.new_password,
        current_password=payload.current_password,
        code=payload.code,
        # So the re-issued pair inherits this session's "Запомнить меня"
        # instead of quietly being granted a longer life than the one it
        # replaces.
        current_session_id=claims.session_id,
    )
    return AuthResponse(user=UserPublic.model_validate(updated), tokens=tokens)


@router.post(
    "/me/delete",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Schedule the account for deletion and sign out everywhere",
)
async def delete_account(
    payload: DeleteAccountRequest, user: CurrentUser, auth: AuthServiceDep
) -> None:
    await auth.delete_account(user, payload.current_password, payload.confirmation)


@router.get(
    "/me/sessions",
    response_model=list[SessionPublic],
    summary="Devices currently signed in to this account",
)
async def list_sessions(
    user: CurrentUser, claims: TokenClaims, auth: AuthServiceDep
) -> list[SessionPublic]:
    return await auth.list_sessions(user, claims.session_id)


@router.delete(
    "/me/sessions",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out every device except this one",
)
async def revoke_other_sessions(
    user: CurrentUser, claims: TokenClaims, auth: AuthServiceDep
) -> None:
    await auth.revoke_other_sessions(user, claims.session_id)


@router.delete(
    "/me/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out one device",
)
async def revoke_session(
    session_id: uuid.UUID, user: CurrentUser, auth: AuthServiceDep
) -> None:
    await auth.revoke_session(user, session_id)


@router.post(
    "/me/avatar",
    response_model=UserPublic,
    summary="Upload a new avatar (already cropped square by the client)",
)
async def upload_avatar(
    user: CurrentUser,
    auth: AuthServiceDep,
    file: Annotated[UploadFile, File()],
) -> UserPublic:
    updated = await auth.set_avatar(user, await file.read())
    return UserPublic.model_validate(updated)


@router.delete(
    "/me/avatar",
    response_model=UserPublic,
    summary="Remove the current avatar",
)
async def delete_avatar_route(user: CurrentUser, auth: AuthServiceDep) -> UserPublic:
    updated = await auth.clear_avatar(user)
    return UserPublic.model_validate(updated)
