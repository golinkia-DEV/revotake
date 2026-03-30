from sqlalchemy import String, Float, Integer, JSON, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid
from datetime import datetime


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("store_id", "sku", name="uq_product_store_sku"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    name: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sku: Mapped[str | None] = mapped_column(String, nullable=True)
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
    branch_stocks: Mapped[list["ProductBranchStock"]] = relationship(
        "ProductBranchStock",
        back_populates="product",
        cascade="all, delete-orphan",
    )


class ProductBranchStock(Base):
    """Cantidad y parámetros de reposición por sede (sucursal) dentro de la tienda."""

    __tablename__ = "product_branch_stocks"
    __table_args__ = (UniqueConstraint("product_id", "branch_id", name="uq_product_branch_stock"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    # Si es null, se usa lead_time_days del producto para umbrales en esa sede.
    lead_time_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    product: Mapped["Product"] = relationship("Product", back_populates="branch_stocks")
