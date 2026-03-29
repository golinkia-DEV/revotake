from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.form_link import FormLink
from app.models.ticket import Ticket, TicketStatus
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
async def create_form_link(data: FormLinkCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    expires_at = datetime.utcnow() + timedelta(hours=data.expires_hours)
    form = FormLink(client_id=data.client_id, ticket_id=data.ticket_id, form_schema=data.form_schema, expires_at=expires_at)
    db.add(form)
    await db.commit()
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
        ticket_result = await db.execute(select(Ticket).where(Ticket.id == form.ticket_id))
        ticket = ticket_result.scalar_one_or_none()
        if ticket:
            ticket.status = TicketStatus.DATA_RECEIVED
    await db.commit()
    return {"message": "Response saved successfully"}
