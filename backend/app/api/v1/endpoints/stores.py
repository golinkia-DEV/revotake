import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import StoreContext, require_store, require_store_admin
from app.core.permissions import effective_permissions
from app.models.store import Store, StoreMember, StoreMemberRole
from app.models.store_type import StoreType
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


def _slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-") or "tienda"
    return s[:80]


class StoreCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    store_type_id: str
    slug: Optional[str] = None
    settings_override: dict = {}


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    settings: Optional[dict] = None


def _deep_merge_settings(base: dict, update: dict) -> dict:
    out = dict(base)
    for k, v in update.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _deep_merge_settings(out[k], v)
        else:
            out[k] = v
    return out


@router.get("/")
async def my_stores(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    q = (
        select(Store, StoreMember)
        .join(StoreMember, StoreMember.store_id == Store.id)
        .where(StoreMember.user_id == user.id, Store.is_active.is_(True))
        .order_by(Store.name)
    )
    result = await db.execute(q)
    rows = result.all()
    out = []
    for row in rows:
        store, member = row
        st = await db.get(StoreType, store.store_type_id)
        out.append(
            {
                "id": store.id,
                "name": store.name,
                "slug": store.slug,
                "store_type_id": store.store_type_id,
                "store_type_name": st.name if st else None,
                "role": member.role.value,
                "permissions": sorted(effective_permissions(member)),
                "settings": store.settings,
            }
        )
    return {"items": out}


@router.post("/")
async def create_store(data: StoreCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    st = await db.get(StoreType, data.store_type_id)
    if not st:
        raise HTTPException(status_code=400, detail="Tipo de tienda no válido")
    base = dict(st.default_settings or {})
    if data.settings_override:
        base.update(data.settings_override)
    slug = _slugify(data.slug or data.name)
    n = 0
    base_slug = slug
    while True:
        ex = await db.execute(select(Store.id).where(Store.slug == slug))
        if ex.scalar_one_or_none() is None:
            break
        n += 1
        slug = f"{base_slug}-{n}"
    store = Store(name=data.name.strip(), slug=slug, store_type_id=st.id, settings=base)
    db.add(store)
    await db.flush()
    db.add(StoreMember(user_id=user.id, store_id=store.id, role=StoreMemberRole.ADMIN))
    return {"id": store.id, "name": store.name, "slug": store.slug, "settings": store.settings}


@router.get("/{store_id}")
async def get_store(
    store_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(Store, StoreMember)
        .join(StoreMember, StoreMember.store_id == Store.id)
        .where(StoreMember.user_id == user.id, Store.id == store_id)
    )
    row = r.first()
    if not row:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    store, member = row
    st = await db.get(StoreType, store.store_type_id)
    return {
        "id": store.id,
        "name": store.name,
        "slug": store.slug,
        "store_type_id": store.store_type_id,
        "store_type": {"name": st.name, "slug": st.slug, "description": st.description} if st else None,
        "role": member.role.value,
        "permissions": sorted(effective_permissions(member)),
        "settings": store.settings,
    }


@router.patch("/{store_id}")
async def update_store(
    store_id: str,
    data: StoreUpdate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    if store_id != ctx.store_id:
        raise HTTPException(status_code=400, detail="La tienda no coincide con X-Store-Id")
    store = ctx.store
    if data.name is not None:
        store.name = data.name.strip()
    if data.settings is not None:
        store.settings = _deep_merge_settings(dict(store.settings or {}), data.settings)
    return {"id": store.id, "name": store.name, "settings": store.settings}
