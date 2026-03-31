import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, UniqueConstraint, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class ProductSupplier(Base):
    __tablename__ = "product_suppliers"
    __table_args__ = (UniqueConstraint("product_id", "supplier_id", name="uq_product_supplier"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class QuotationRequest(Base):
    __tablename__ = "quotation_requests"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id"), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(40), default="sent")
    email_to: Mapped[str] = mapped_column(String(255))
    email_cc: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
