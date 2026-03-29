from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.models.client import Client
from app.models.ticket import Ticket, TicketStatus
from app.models.product import Product
from app.models.meeting import Meeting
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    total_clients = await db.execute(select(func.count(Client.id)))
    total_tickets = await db.execute(select(func.count(Ticket.id)))
    open_tickets = await db.execute(select(func.count(Ticket.id)).where(Ticket.status != TicketStatus.CLOSED))
    critical_stock = await db.execute(select(func.count(Product.id)).where(Product.stock_status == "critical"))
    upcoming_meetings = await db.execute(select(func.count(Meeting.id)).where(Meeting.start_time >= datetime.utcnow(), Meeting.start_time <= datetime.utcnow() + timedelta(days=7)))
    return {
        "total_clients": total_clients.scalar(),
        "total_tickets": total_tickets.scalar(),
        "open_tickets": open_tickets.scalar(),
        "critical_stock_alerts": critical_stock.scalar(),
        "upcoming_meetings_7d": upcoming_meetings.scalar()
    }
