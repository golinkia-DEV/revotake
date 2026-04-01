"""Agrega alertas de stock, citas próximas y lista de espera en un solo endpoint."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.product import Product
from app.models.scheduling import Appointment, AppointmentStatus, WaitlistEntry
from app.models.client import Client
from app.models.meeting import Meeting

router = APIRouter()


@router.get("/")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store),
):
    sid = ctx.store_id
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    items = []

    # Stock crítico
    critical = await db.execute(
        select(Product.id, Product.name, Product.stock, Product.stock_status)
        .where(Product.store_id == sid, Product.stock_status == "critical")
        .limit(10)
    )
    for pid, pname, stock, _ in critical.all():
        items.append({
            "id": f"stock-critical-{pid}",
            "type": "stock_critical",
            "title": f"Stock crítico: {pname}",
            "body": f"Solo quedan {stock} unidades.",
            "href": "/products",
            "severity": "error",
            "created_at": now.isoformat(),
        })

    # Stock bajo
    low = await db.execute(
        select(Product.id, Product.name, Product.stock)
        .where(Product.store_id == sid, Product.stock_status == "low")
        .limit(5)
    )
    for pid, pname, stock in low.all():
        items.append({
            "id": f"stock-low-{pid}",
            "type": "stock_low",
            "title": f"Stock bajo: {pname}",
            "body": f"{stock} unidades restantes.",
            "href": "/products",
            "severity": "warning",
            "created_at": now.isoformat(),
        })

    # Citas próximas 24h
    t24 = now + timedelta(hours=24)
    appts = await db.execute(
        select(Appointment)
        .where(
            Appointment.store_id == sid,
            Appointment.status == AppointmentStatus.CONFIRMED.value,
            Appointment.start_time >= now,
            Appointment.start_time <= t24,
        )
        .order_by(Appointment.start_time)
        .limit(5)
    )
    for appt in appts.scalars().all():
        items.append({
            "id": f"appt-{appt.id}",
            "type": "appointment_soon",
            "title": "Cita en las próximas 24h",
            "body": appt.start_time.strftime("%d/%m %H:%M"),
            "href": "/scheduling",
            "severity": "info",
            "created_at": now.isoformat(),
        })

    # Reuniones próximas 24h
    meetings = await db.execute(
        select(Meeting.id, Meeting.title, Meeting.start_time)
        .where(
            Meeting.store_id == sid,
            Meeting.start_time >= now,
            Meeting.start_time <= t24,
        )
        .order_by(Meeting.start_time)
        .limit(3)
    )
    for mid, mtitle, mstart in meetings.all():
        items.append({
            "id": f"meeting-{mid}",
            "type": "meeting_soon",
            "title": f"Reunión: {mtitle}",
            "body": mstart.strftime("%d/%m %H:%M"),
            "href": "/calendar",
            "severity": "info",
            "created_at": now.isoformat(),
        })

    # Entradas en lista de espera sin notificar
    waitlist_count_r = await db.execute(
        select(func.count(WaitlistEntry.id)).where(
            WaitlistEntry.store_id == sid,
            WaitlistEntry.status == "waiting",
        )
    )
    wc = waitlist_count_r.scalar_one_or_none() or 0
    if wc > 0:
        items.append({
            "id": "waitlist-pending",
            "type": "waitlist",
            "title": f"{wc} cliente{'s' if wc > 1 else ''} en lista de espera",
            "body": "Hay clientes esperando disponibilidad.",
            "href": "/scheduling",
            "severity": "warning",
            "created_at": now.isoformat(),
        })

    # Cancelaciones reiteradas por clienta (últimos 90 días)
    t90 = now - timedelta(days=90)
    repeated = await db.execute(
        select(Appointment.client_id, func.count(Appointment.id))
        .where(
            Appointment.store_id == sid,
            Appointment.status == AppointmentStatus.CANCELLED.value,
            Appointment.client_id.is_not(None),
            Appointment.start_time >= t90,
        )
        .group_by(Appointment.client_id)
        .having(func.count(Appointment.id) >= 3)
        .limit(5)
    )
    for cid, cnt in repeated.all():
        client_name = (
            await db.execute(select(Client.name).where(Client.id == cid))
        ).scalar_one_or_none() or "Clienta"
        items.append({
            "id": f"repeated-cancel-{cid}",
            "type": "repeat_cancellations",
            "title": f"Cancelaciones reiteradas: {client_name}",
            "body": f"{cnt} cancelaciones en los últimos 90 días.",
            "href": "/calendar",
            "severity": "warning",
            "created_at": now.isoformat(),
        })

    return {"items": items, "total": len(items)}
