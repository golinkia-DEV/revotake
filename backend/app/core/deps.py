from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.models.store import Store, StoreMember, StoreMemberRole
from app.models.user import User


@dataclass
class StoreContext:
    store: Store
    member: StoreMember

    @property
    def store_id(self) -> str:
        return self.store.id


async def require_store(
    x_store_id: str | None = Header(None, alias="X-Store-Id"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StoreContext:
    if not x_store_id:
        raise HTTPException(status_code=400, detail="Falta el header X-Store-Id (selecciona una tienda)")
    r = await db.execute(
        select(StoreMember).where(
            StoreMember.user_id == user.id,
            StoreMember.store_id == x_store_id,
        )
    )
    member = r.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta tienda")
    sr = await db.execute(select(Store).where(Store.id == x_store_id, Store.is_active.is_(True)))
    store = sr.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return StoreContext(store=store, member=member)


async def require_store_admin(ctx: StoreContext = Depends(require_store)) -> StoreContext:
    if ctx.member.role != StoreMemberRole.ADMIN:
        raise HTTPException(status_code=403, detail="Se requiere administrador de la tienda")
    return ctx
