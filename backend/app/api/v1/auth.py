from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import AuthServiceDep, CurrentUser
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
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


@router.get("/me", response_model=UserPublic, summary="The signed-in user")
async def me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)
