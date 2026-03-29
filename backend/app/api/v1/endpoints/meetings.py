from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from icalendar import Calendar, Event
from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.meeting import Meeting
from app.models.client import Client
from app.models.ticket import Ticket
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

class MeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    client_id: Optional[str] = None
    ticket_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    meeting_url: Optional[str] = None
    attendees: dict = {}

@router.get("/")
async def list_meetings(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Meeting).where(Meeting.store_id == ctx.store_id).order_by(Meeting.start_time))
    meetings = result.scalars().all()
    return {"items": [{"id": m.id, "title": m.title, "client_id": m.client_id, "start_time": m.start_time, "end_time": m.end_time, "meeting_url": m.meeting_url, "ics_token": m.ics_token} for m in meetings]}

@router.post("/")
async def create_meeting(data: MeetingCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    if data.client_id:
        cr = await db.execute(select(Client.id).where(Client.id == data.client_id, Client.store_id == ctx.store_id))
        if cr.scalar_one_or_none() is None:
            raise HTTPException(400, "Cliente no pertenece a esta tienda")
    if data.ticket_id:
        tr = await db.execute(select(Ticket.id).where(Ticket.id == data.ticket_id, Ticket.store_id == ctx.store_id))
        if tr.scalar_one_or_none() is None:
            raise HTTPException(400, "Ticket no pertenece a esta tienda")
    meeting = Meeting(store_id=ctx.store_id, **data.model_dump(), organizer_id=current_user.id)
    db.add(meeting)
    return {"id": meeting.id, "ics_token": meeting.ics_token}

@router.get("/ics/{ics_token}")
async def get_ics(ics_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Meeting).where(Meeting.ics_token == ics_token))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404)
    cal = Calendar()
    cal.add("prodid", "-//RevoTake//EN")
    cal.add("version", "2.0")
    event = Event()
    event.add("summary", meeting.title)
    event.add("dtstart", meeting.start_time)
    event.add("dtend", meeting.end_time)
    event.add("description", meeting.description or "")
    if meeting.meeting_url:
        event.add("url", meeting.meeting_url)
    event.add("uid", f"{meeting.id}@revotake")
    cal.add_component(event)
    ics_content = cal.to_ical()
    return Response(content=ics_content, media_type="text/calendar", headers={"Content-Disposition": f"attachment; filename=meeting-{meeting.id}.ics"})
