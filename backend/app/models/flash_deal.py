import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FlashDeal(Base):
    """Oferta flash: slot libre de un profesional con descuento aplicado."""

    __tablename__ = "flash_deals"
    __table_args__ = (
        Index("ix_flash_deals_is_active", "is_active"),
        Index("ix_flash_deals_slot_start", "slot_start_time"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)  # genera ix_flash_deals_store_id
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"))
    professional_id: Mapped[str] = mapped_column(ForeignKey("professionals.id", ondelete="CASCADE"))
    service_id: Mapped[str] = mapped_column(ForeignKey("scheduling_services.id", ondelete="CASCADE"))

    discount_percent: Mapped[int] = mapped_column(Integer)
    original_price_cents: Mapped[int] = mapped_column(Integer, default=0)

    slot_start_time: Mapped[datetime] = mapped_column(DateTime)
    slot_end_time: Mapped[datetime] = mapped_column(DateTime)

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    appointment_id: Mapped[str | None] = mapped_column(
        ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_by: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
