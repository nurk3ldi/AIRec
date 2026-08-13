from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import InactiveAccount, NotAuthenticated
from app.core.security import AccessTokenClaims, decode_access_token
from app.db.session import get_session
from app.models.user import User
from app.repositories.business import BusinessRepository
from app.repositories.email_change import EmailChangeRepository
from app.repositories.password_reset import PasswordResetRepository
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.services.auth import AuthService, ClientInfo
from app.services.business import BusinessService

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# auto_error=False so a missing header raises our own error shape, not FastAPI's.
_bearer_scheme = HTTPBearer(auto_error=False, description="Access token")
CredentialsDep = Annotated[
    HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)
]


def build_auth_service(session: AsyncSession) -> AuthService:
    """Wire a service against any session — the dependency below for requests,
    and startup housekeeping for its own."""
    return AuthService(
        session=session,
        users=UserRepository(session),
        tokens=RefreshTokenRepository(session),
        password_resets=PasswordResetRepository(session),
        email_changes=EmailChangeRepository(session),
    )


def get_auth_service(session: SessionDep) -> AuthService:
    return build_auth_service(session)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def get_business_service(session: SessionDep) -> BusinessService:
    return BusinessService(session=session, businesses=BusinessRepository(session))


BusinessServiceDep = Annotated[BusinessService, Depends(get_business_service)]


def get_token_claims(credentials: CredentialsDep) -> AccessTokenClaims:
    """Decode once and share, so a route that needs both the user and the
    session it came from doesn't verify the same signature twice."""
    if credentials is None:
        raise NotAuthenticated

    try:
        return decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise NotAuthenticated("Access token is invalid or expired.") from exc


TokenClaims = Annotated[AccessTokenClaims, Depends(get_token_claims)]


def get_client_info(request: Request) -> ClientInfo:
    """Reads the caller's device details here, at the edge, so the service layer
    keeps taking plain values and stays free of FastAPI."""
    return ClientInfo(
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )


ClientInfoDep = Annotated[ClientInfo, Depends(get_client_info)]


async def get_current_user(session: SessionDep, claims: TokenClaims) -> User:
    user = await UserRepository(session).get_by_id(claims.user_id)
    if user is None:
        # Token signature is valid but the account is gone.
        raise NotAuthenticated
    if user.deleted_at is not None:
        # Deleting revokes every refresh token, but the access token that did
        # the deleting stays valid for its remaining minutes — this is what
        # stops it being used in the meantime.
        raise NotAuthenticated
    if not user.is_active:
        raise InactiveAccount

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
