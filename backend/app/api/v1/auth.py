from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile, status

from app.api.deps import AuthServiceDep, CurrentUser
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
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
async def register(payload: RegisterRequest, auth: AuthServiceDep) -> AuthResponse:
    user, tokens = await auth.register(payload)
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
async def login(payload: LoginRequest, auth: AuthServiceDep) -> AuthResponse:
    user, tokens = await auth.authenticate(payload.identifier, payload.password)
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
    return MessageResponse(message="We've sent a code to your email.")


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset a password using the emailed code",
)
async def reset_password(
    payload: ResetPasswordRequest, auth: AuthServiceDep
) -> MessageResponse:
    await auth.reset_password(payload.email, payload.code, payload.new_password)
    return MessageResponse(message="Password reset. You can now log in.")


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
