from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import InactiveAccount, NotAuthenticated
from app.core.security import decode_access_token
from app.db.session import get_session
from app.models.user import User
from app.repositories.email_change import EmailChangeRepository
from app.repositories.password_reset import PasswordResetRepository
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.services.auth import AuthService

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# auto_error=False so a missing header raises our own error shape, not FastAPI's.
_bearer_scheme = HTTPBearer(auto_error=False, description="Access token")
CredentialsDep = Annotated[
    HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)
]


def get_auth_service(session: SessionDep) -> AuthService:
    return AuthService(
        session=session,
        users=UserRepository(session),
        tokens=RefreshTokenRepository(session),
        password_resets=PasswordResetRepository(session),
        email_changes=EmailChangeRepository(session),
    )


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def get_current_user(
    session: SessionDep, credentials: CredentialsDep
) -> User:
    if credentials is None:
        raise NotAuthenticated

    try:
        user_id = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise NotAuthenticated("Access token is invalid or expired.") from exc

    user = await UserRepository(session).get_by_id(user_id)
    if user is None:
        # Token signature is valid but the account is gone.
        raise NotAuthenticated
    if not user.is_active:
        raise InactiveAccount

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
