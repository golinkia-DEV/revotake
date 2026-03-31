from dataclasses import dataclass
from typing import FrozenSet

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.core.permissions import (
    effective_permissions,
    is_platform_admin,
    member_branch_scope,
    normalize_store_member_role,
)
from app.models.store import Store, StoreMember, StoreMemberRole
from app.models.user import User, UserRole


@dataclass
class StoreContext:
    store: Store
    member: StoreMember
    permissions: FrozenSet[str]
    branch_scope: FrozenSet[str]
    member_role_normalized: str

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
    perms = effective_permissions(member)
    return StoreContext(
        store=store,
        member=member,
        permissions=perms,
        branch_scope=member_branch_scope(member),
        member_role_normalized=normalize_store_member_role(member.role),
    )


def require_store_permission(*any_of: str):
    """Al menos uno de los permisos debe estar presente (OR)."""

    async def dep(ctx: StoreContext = Depends(require_store)) -> StoreContext:
        if not any(p in ctx.permissions for p in any_of):
            raise HTTPException(status_code=403, detail="Permisos insuficientes para esta acción")
        return ctx

    return dep


async def require_store_admin(ctx: StoreContext = Depends(require_store)) -> StoreContext:
    if ctx.member_role_normalized not in (
        StoreMemberRole.STORE_ADMIN.value,
        StoreMemberRole.BRANCH_ADMIN.value,
    ):
        raise HTTPException(status_code=403, detail="Se requiere gerente de tienda (admin de local)")
    return ctx


async def require_global_admin(user: User = Depends(get_current_user)) -> User:
    if not is_platform_admin(user.role):
        raise HTTPException(status_code=403, detail="Se requiere administrador global")
    return user


def ensure_branch_in_scope(ctx: StoreContext, branch_id: str) -> None:
    if not branch_id:
        return
    if not ctx.branch_scope:
        return
    if branch_id not in ctx.branch_scope:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta sucursal")
