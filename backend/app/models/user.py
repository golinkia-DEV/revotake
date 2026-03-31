from sqlalchemy import String, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid, enum
from datetime import datetime

class UserRole(str, enum.Enum):
    """Rol global de plataforma.

    Legacy soportado:
    - admin/seller/operator/client
    Nuevos:
    - platform_admin/platform_operator
    """

    ADMIN = "admin"
    SELLER = "seller"
    OPERATOR = "operator"
    CLIENT = "client"  # Portal cliente: solo sus citas / datos propios (futuro)
    PLATFORM_ADMIN = "platform_admin"
    PLATFORM_OPERATOR = "platform_operator"

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    hashed_password: Mapped[str] = mapped_column(String)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.SELLER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    store_memberships: Mapped[list["StoreMember"]] = relationship("StoreMember", back_populates="user")
