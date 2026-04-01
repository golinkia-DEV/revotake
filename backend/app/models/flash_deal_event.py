import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FlashDealEvent(Base):
    """Eventos de analítica pública de ofertas flash (embudo y series temporales)."""

    __tablename__ = "flash_deal_events"
    __table_args__ = (
        Index("ix_flash_deal_events_store_created", "store_id", "created_at"),
        Index("ix_flash_deal_events_type", "event_type"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    deal_id: Mapped[str | None] = mapped_column(
        ForeignKey("flash_deals.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # section_view: cliente vio el bloque de ofertas (sin deal concreto)
    # apply_click: clic en "Tomar esta oferta"
    # claim: reserva completada con la oferta
    event_type: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
