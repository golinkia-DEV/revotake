from sqlalchemy import String, Boolean, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import uuid
from datetime import datetime

class FormLink(Base):
    __tablename__ = "form_links"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    token: Mapped[str] = mapped_column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    client_id: Mapped[str | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"), nullable=True)
    form_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
