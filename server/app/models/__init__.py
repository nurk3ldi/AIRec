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
from app.models.message import Message, MessageAuthor, MessageStatus
from app.models.note import Note
from app.models.note_folder import NoteFolder
from app.models.password_reset_code import PasswordResetCode
from app.models.refresh_token import RefreshToken
from app.models.service import Service
from app.models.telegram_account import TelegramAccount
from app.models.user import User
from app.models.whatsapp_account import WhatsAppAccount
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
    "MessageStatus",
    "Note",
    "NoteFolder",
    "PasswordResetCode",
    "RefreshToken",
    "Service",
    "TelegramAccount",
    "User",
    "WhatsAppAccount",
    "WorkingHours",
]
