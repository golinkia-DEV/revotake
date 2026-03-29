import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, JSON, ForeignKey, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StoreMemberRole(str, enum.Enum):
    ADMIN = "admin"
    SELLER = "seller"
    OPERATOR = "operator"


class Store(Base):
    __tablename__ = "stores"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, index=True)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    store_type_id: Mapped[str] = mapped_column(ForeignKey("store_types.id"), index=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    store_type: Mapped["StoreType"] = relationship("StoreType", back_populates="stores")
    members: Mapped[list["StoreMember"]] = relationship("StoreMember", back_populates="store")


class StoreMember(Base):
    __tablename__ = "store_members"
    __table_args__ = (UniqueConstraint("user_id", "store_id", name="uq_user_store"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), index=True)
    role: Mapped[StoreMemberRole] = mapped_column(SAEnum(StoreMemberRole), default=StoreMemberRole.SELLER)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    user: Mapped["User"] = relationship("User", back_populates="store_memberships")
    store: Mapped["Store"] = relationship("Store", back_populates="members")
