from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.form_link import FormLink
from app.models.ticket import Ticket, TicketStatus
from app.models.client import Client
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

class FormLinkCreate(BaseModel):
    client_id: Optional[str] = None
    ticket_id: Optional[str] = None
    form_schema: dict = {}
    expires_hours: int = 48

class FormResponse(BaseModel):
    response: dict

@router.post("/")
async def create_form_link(data: FormLinkCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    if data.client_id:
        cr = await db.execute(select(Client.id).where(Client.id == data.client_id, Client.store_id == ctx.store_id))
        if cr.scalar_one_or_none() is None:
            raise HTTPException(400, "Cliente no pertenece a esta tienda")
    if data.ticket_id:
        tr = await db.execute(select(Ticket.id).where(Ticket.id == data.ticket_id, Ticket.store_id == ctx.store_id))
        if tr.scalar_one_or_none() is None:
            raise HTTPException(400, "Ticket no pertenece a esta tienda")
    expires_at = datetime.utcnow() + timedelta(hours=data.expires_hours)
    form = FormLink(store_id=ctx.store_id, client_id=data.client_id, ticket_id=data.ticket_id, form_schema=data.form_schema, expires_at=expires_at)
    db.add(form)
    return {"id": form.id, "token": form.token, "expires_at": form.expires_at}

@router.get("/f/{token}")
async def get_form(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FormLink).where(FormLink.token == token))
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(404, "Form not found")
    if datetime.utcnow() > form.expires_at:
        raise HTTPException(410, "Form has expired")
    if form.is_used:
        raise HTTPException(409, "Form already submitted")
    return {"token": token, "form_schema": form.form_schema, "expires_at": form.expires_at}

@router.post("/f/{token}/submit")
async def submit_form(token: str, data: FormResponse, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FormLink).where(FormLink.token == token))
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(404)
    if datetime.utcnow() > form.expires_at:
        raise HTTPException(410, "Form expired")
    if form.is_used:
        raise HTTPException(409, "Already submitted")
    form.response = data.response
    form.is_used = True
    if form.ticket_id:
        ticket_result = await db.execute(select(Ticket).where(Ticket.id == form.ticket_id, Ticket.store_id == form.store_id))
        ticket = ticket_result.scalar_one_or_none()
        if ticket:
            ticket.status = TicketStatus.DATA_RECEIVED
    if form.client_id:
        client_result = await db.execute(select(Client).where(Client.id == form.client_id, Client.store_id == form.store_id))
        client = client_result.scalar_one_or_none()
        if client and isinstance(data.response, dict):
            for key in ("name", "email", "phone", "address", "notes"):
                if data.response.get(key) is not None:
                    setattr(client, key, data.response[key])
            extra = {k: v for k, v in data.response.items() if k not in {"name", "email", "phone", "address", "notes"}}
            if extra:
                merged = dict(client.custom_fields or {})
                merged.update(extra)
                client.custom_fields = merged
    return {"message": "Response saved successfully"}
