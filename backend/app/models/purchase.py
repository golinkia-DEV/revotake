from sqlalchemy import String, Float, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid
from datetime import datetime

class Purchase(Base):
    __tablename__ = "purchases"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    branch_id: Mapped[str | None] = mapped_column(ForeignKey("branches.id"), nullable=True, index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float)
    total: Mapped[float] = mapped_column(Float)
    sold_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    client: Mapped["Client"] = relationship("Client", back_populates="purchases")
    product: Mapped["Product"] = relationship("Product", back_populates="sales")
