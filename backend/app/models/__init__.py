"""SQLAlchemy models.

Every model must be imported here so that `Base.metadata` is fully populated
before Alembic autogenerate inspects it.
"""

from app.models.appointment import (
    Appointment,
    AppointmentSource,
    AppointmentStatus,
)
from app.models.business import Business
from app.models.conversation import (
    Conversation,
    ConversationChannel,
    ConversationStatus,
)
from app.models.email_change_code import EmailChangeCode
from app.models.message import Message, MessageAuthor
from app.models.password_reset_code import PasswordResetCode
from app.models.refresh_token import RefreshToken
from app.models.service import Service
from app.models.user import User
from app.models.working_hours import WorkingHours

__all__ = [
    "Appointment",
    "AppointmentSource",
    "AppointmentStatus",
    "Business",
    "Conversation",
    "ConversationChannel",
    "ConversationStatus",
    "EmailChangeCode",
    "Message",
    "MessageAuthor",
    "PasswordResetCode",
    "RefreshToken",
    "Service",
    "User",
    "WorkingHours",
]
