from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.ticket import Ticket, TicketType, TicketStatus
from app.models.client import Client
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

class TicketCreate(BaseModel):
    title: str
    description: Optional[str] = None
    type: TicketType = TicketType.LEAD
    status: TicketStatus = TicketStatus.NEW
    priority: str = "medium"
    client_id: Optional[str] = None
    assigned_to: Optional[str] = None
    extra_data: dict = {}
    due_date: Optional[datetime] = None

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[TicketType] = None
    status: Optional[TicketStatus] = None
    priority: Optional[str] = None
    client_id: Optional[str] = None
    assigned_to: Optional[str] = None
    extra_data: Optional[dict] = None
    due_date: Optional[datetime] = None

async def _ensure_client_store(db: AsyncSession, client_id: str, store_id: str) -> bool:
    r = await db.execute(select(Client.id).where(Client.id == client_id, Client.store_id == store_id))
    return r.scalar_one_or_none() is not None

@router.get("/")
async def list_tickets(status: Optional[TicketStatus] = None, type: Optional[TicketType] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    query = select(Ticket).where(Ticket.store_id == ctx.store_id)
    if status:
        query = query.where(Ticket.status == status)
    if type:
        query = query.where(Ticket.type == type)
    query = query.order_by(Ticket.created_at.desc())
    result = await db.execute(query)
    tickets = result.scalars().all()
    return {"items": [{"id": t.id, "title": t.title, "type": t.type, "status": t.status, "priority": t.priority, "client_id": t.client_id, "due_date": t.due_date, "created_at": t.created_at} for t in tickets]}

@router.get("/kanban")
async def kanban_board(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Ticket).where(Ticket.store_id == ctx.store_id).order_by(Ticket.created_at.desc()))
    tickets = result.scalars().all()
    board = {}
    for status in TicketStatus:
        board[status.value] = [{"id": t.id, "title": t.title, "type": t.type, "status": t.status, "priority": t.priority, "client_id": t.client_id, "due_date": t.due_date} for t in tickets if t.status == status]
    return board


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id, Ticket.store_id == ctx.store_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    return {
        "id": ticket.id,
        "title": ticket.title,
        "description": ticket.description,
        "type": ticket.type,
        "status": ticket.status,
        "priority": ticket.priority,
        "client_id": ticket.client_id,
        "assigned_to": ticket.assigned_to,
        "extra_data": ticket.extra_data,
        "due_date": ticket.due_date,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
    }


@router.post("/")
async def create_ticket(data: TicketCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    if data.client_id and not await _ensure_client_store(db, data.client_id, ctx.store_id):
        raise HTTPException(400, "Cliente no pertenece a esta tienda")
    ticket = Ticket(store_id=ctx.store_id, **data.model_dump())
    db.add(ticket)
    return {"id": ticket.id, "title": ticket.title, "status": ticket.status}

@router.put("/{ticket_id}")
async def update_ticket(ticket_id: str, data: TicketUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id, Ticket.store_id == ctx.store_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    payload = data.model_dump(exclude_none=True)
    if payload.get("client_id") and not await _ensure_client_store(db, payload["client_id"], ctx.store_id):
        raise HTTPException(400, "Cliente no pertenece a esta tienda")
    for k, v in payload.items():
        setattr(ticket, k, v)
    return {"id": ticket.id, "status": ticket.status}

@router.delete("/{ticket_id}")
async def delete_ticket(ticket_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id, Ticket.store_id == ctx.store_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(404)
    await db.delete(ticket)
    return {"message": "Deleted"}
