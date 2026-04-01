import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StoreFollower(Base):
    """Relación entre usuario público y tienda que sigue."""

    __tablename__ = "store_followers"
    __table_args__ = (
        UniqueConstraint("public_user_id", "store_id", name="uq_store_follower"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    public_user_id: Mapped[str] = mapped_column(
        ForeignKey("public_users.id", ondelete="CASCADE"), index=True
    )
    store_id: Mapped[str] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
