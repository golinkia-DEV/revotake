import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EventRSVP(Base):
    """Respuesta de un usuario público a la invitación de un evento de tienda."""

    __tablename__ = "event_rsvps"
    __table_args__ = (
        UniqueConstraint("event_id", "public_user_id", name="uq_event_rsvp"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id: Mapped[str] = mapped_column(
        ForeignKey("store_events.id", ondelete="CASCADE"), index=True
    )
    public_user_id: Mapped[str] = mapped_column(
        ForeignKey("public_users.id", ondelete="CASCADE"), index=True
    )
    # "accepted" | "declined"
    status: Mapped[str] = mapped_column(String(20), default="accepted")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
