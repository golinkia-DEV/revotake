from sqlalchemy import String, Text, JSON, ForeignKey, Enum as SAEnum, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid, enum
from datetime import datetime

class TicketType(str, enum.Enum):
    LEAD = "lead"
    MEETING = "meeting"
    ORDER = "order"
    INCIDENT = "incident"
    TASK = "task"

class TicketStatus(str, enum.Enum):
    NEW = "new"
    QUALIFIED = "qualified"
    MEETING_SCHEDULED = "meeting_scheduled"
    DATA_RECEIVED = "data_received"
    SOLD = "sold"
    FOLLOW_UP = "follow_up"
    NO_RESPONSE = "no_response"
    CLOSED = "closed"

class Ticket(Base):
    __tablename__ = "tickets"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[TicketType] = mapped_column(SAEnum(TicketType), default=TicketType.LEAD)
    status: Mapped[TicketStatus] = mapped_column(SAEnum(TicketStatus), default=TicketStatus.NEW)
    priority: Mapped[str] = mapped_column(String, default="medium")
    client_id: Mapped[str | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
    client: Mapped["Client"] = relationship("Client", back_populates="tickets")
