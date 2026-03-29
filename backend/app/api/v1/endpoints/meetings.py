from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from icalendar import Calendar, Event
from app.core.database import get_db
from app.models.meeting import Meeting
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user
import uuid

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
async def list_meetings(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Meeting).order_by(Meeting.start_time))
    meetings = result.scalars().all()
    return {"items": [{"id": m.id, "title": m.title, "client_id": m.client_id, "start_time": m.start_time, "end_time": m.end_time, "meeting_url": m.meeting_url} for m in meetings]}

@router.post("/")
async def create_meeting(data: MeetingCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    meeting = Meeting(**data.model_dump(), organizer_id=current_user.id)
    db.add(meeting)
    await db.commit()
    return {"id": meeting.id, "ics_token": meeting.ics_token}

@router.get("/{meeting_id}/ics")
async def get_ics(meeting_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
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
