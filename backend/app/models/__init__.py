"""SQLAlchemy models.

Every model must be imported here so that `Base.metadata` is fully populated
before Alembic autogenerate inspects it.
"""

from app.models.refresh_token import RefreshToken
from app.models.user import User

__all__ = ["RefreshToken", "User"]
