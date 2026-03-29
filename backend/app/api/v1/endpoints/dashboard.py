from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.client import Client
from app.models.ticket import Ticket, TicketStatus
from app.models.product import Product
from app.models.meeting import Meeting
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db), ctx: StoreContext = Depends(require_store)):
    sid = ctx.store_id
    total_clients = await db.execute(select(func.count(Client.id)).where(Client.store_id == sid))
    total_tickets = await db.execute(select(func.count(Ticket.id)).where(Ticket.store_id == sid))
    open_tickets = await db.execute(select(func.count(Ticket.id)).where(Ticket.store_id == sid, Ticket.status != TicketStatus.CLOSED))
    critical_stock = await db.execute(select(func.count(Product.id)).where(Product.store_id == sid, Product.stock_status == "critical"))
    low_stock = await db.execute(select(func.count(Product.id)).where(Product.store_id == sid, Product.stock_status == "low"))
    upcoming_meetings = await db.execute(
        select(func.count(Meeting.id)).where(
            Meeting.store_id == sid,
            Meeting.start_time >= datetime.utcnow(),
            Meeting.start_time <= datetime.utcnow() + timedelta(days=7),
        )
    )
    return {
        "total_clients": total_clients.scalar(),
        "total_tickets": total_tickets.scalar(),
        "open_tickets": open_tickets.scalar(),
        "critical_stock_alerts": critical_stock.scalar(),
        "low_stock_alerts": low_stock.scalar(),
        "upcoming_meetings_7d": upcoming_meetings.scalar(),
    }
