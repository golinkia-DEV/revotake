import enum
from sqlalchemy import String, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import uuid
from datetime import datetime


class MeetingConfirmationStatus(str, enum.Enum):
    """scheduled: sin recordatorio aún · awaiting: recordatorio enviado, sin respuesta · confirmed/declined."""

    SCHEDULED = "scheduled"
    AWAITING = "awaiting"
    CONFIRMED = "confirmed"
    DECLINED = "declined"


class Meeting(Base):
    __tablename__ = "meetings"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_id: Mapped[str | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"), nullable=True)
    organizer_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    start_time: Mapped[datetime] = mapped_column(DateTime)
    end_time: Mapped[datetime] = mapped_column(DateTime)
    meeting_url: Mapped[str | None] = mapped_column(String, nullable=True)
    ics_token: Mapped[str] = mapped_column(String, default=lambda: str(uuid.uuid4()))
    confirmation_token: Mapped[str] = mapped_column(String, default=lambda: str(uuid.uuid4()), unique=True, index=True)
    confirmation_status: Mapped[str] = mapped_column(
        String(32), default=MeetingConfirmationStatus.SCHEDULED.value, index=True
    )
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    attendees: Mapped[dict] = mapped_column(JSON, default=dict)
    ics_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
