from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.client import Client
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    preferences: dict = {}
    custom_fields: dict = {}

@router.get("/")
async def list_clients(skip: int = 0, limit: int = 50, search: Optional[str] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    count_stmt = select(func.count(Client.id)).where(Client.store_id == ctx.store_id)
    query = select(Client).where(Client.store_id == ctx.store_id)
    if search:
        filt = Client.name.ilike(f"%{search}%")
        count_stmt = count_stmt.where(filt)
        query = query.where(filt)
    total = (await db.execute(count_stmt)).scalar() or 0
    query = query.offset(skip).limit(limit).order_by(Client.created_at.desc())
    result = await db.execute(query)
    clients = result.scalars().all()
    return {"items": [{"id": c.id, "name": c.name, "email": c.email, "phone": c.phone, "created_at": c.created_at} for c in clients], "total": total}

@router.post("/")
async def create_client(data: ClientCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    client = Client(store_id=ctx.store_id, **data.model_dump())
    db.add(client)
    return {"id": client.id, "name": client.name}

@router.get("/{client_id}")
async def get_client(client_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Client).where(Client.id == client_id, Client.store_id == ctx.store_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found")
    return {"id": client.id, "name": client.name, "email": client.email, "phone": client.phone, "address": client.address, "notes": client.notes, "preferences": client.preferences, "custom_fields": client.custom_fields, "created_at": client.created_at}

@router.put("/{client_id}")
async def update_client(client_id: str, data: ClientCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Client).where(Client.id == client_id, Client.store_id == ctx.store_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found")
    for k, v in data.model_dump().items():
        setattr(client, k, v)
    return {"id": client.id, "name": client.name}

@router.delete("/{client_id}")
async def delete_client(client_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Client).where(Client.id == client_id, Client.store_id == ctx.store_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found")
    await db.delete(client)
    return {"message": "Deleted"}
