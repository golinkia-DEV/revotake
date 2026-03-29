from sqlalchemy import String, Float, Integer, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid
from datetime import datetime

class Product(Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sku: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    price: Mapped[float] = mapped_column(Float, default=0)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=3)
    stock_status: Mapped[str] = mapped_column(String, default="ok")
    avg_daily_sales: Mapped[float] = mapped_column(Float, default=0)
    days_of_stock: Mapped[float | None] = mapped_column(Float, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    custom_fields: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    sales: Mapped[list["Purchase"]] = relationship("Purchase", back_populates="product")
