from sqlalchemy import String, Text, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid
from datetime import datetime

class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (Index("ix_clients_store_name", "store_id", "name"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    name: Mapped[str] = mapped_column(String, index=True)
    paternal_last_name: Mapped[str | None] = mapped_column(String, nullable=True)
    maternal_last_name: Mapped[str | None] = mapped_column(String, nullable=True)
    birth_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    rut: Mapped[str | None] = mapped_column(String(30), index=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    custom_fields: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
    tickets: Mapped[list["Ticket"]] = relationship("Ticket", back_populates="client")
    purchases: Mapped[list["Purchase"]] = relationship("Purchase", back_populates="client")
