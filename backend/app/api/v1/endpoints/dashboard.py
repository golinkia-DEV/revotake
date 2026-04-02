from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import StoreContext, require_store_permission
from app.core.permissions import VER_REPORTES
from app.models.client import Client
from app.models.meeting import Meeting
from app.models.product import Product
from app.models.scheduling import (
    Appointment,
    AppointmentStatus,
    Professional,
    Service,
)
from app.models.ticket import Ticket, TicketStatus

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES)),
):
    sid = ctx.store_id
    total_clients = await db.execute(select(func.count(Client.id)).where(Client.store_id == sid))
    total_tickets = await db.execute(select(func.count(Ticket.id)).where(Ticket.store_id == sid))
    open_tickets = await db.execute(
        select(func.count(Ticket.id)).where(Ticket.store_id == sid, Ticket.status != TicketStatus.CLOSED)
    )
    critical_stock = await db.execute(
        select(func.count(Product.id)).where(Product.store_id == sid, Product.stock_status == "critical")
    )
    low_stock = await db.execute(
        select(func.count(Product.id)).where(Product.store_id == sid, Product.stock_status == "low")
    )
    now = _utcnow()
    upcoming_meetings = await db.execute(
        select(func.count(Meeting.id)).where(
            Meeting.store_id == sid,
            Meeting.start_time >= now,
            Meeting.start_time <= now + timedelta(days=7),
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


@router.get("/analytics")
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES)),
    days: int = Query(30, ge=7, le=365, description="Ventana de análisis en días"),
):
    """
    Métricas avanzadas de agenda: ingresos, ocupación, top servicios,
    retención de clientes y distribución por estado.
    """
    sid = ctx.store_id
    now = _utcnow()
    since = now - timedelta(days=days)
    prev_since = since - timedelta(days=days)

    # ── Citas en el período ──────────────────────────────────────────────────
    r = await db.execute(
        select(
            Appointment.status,
            Appointment.charged_price_cents,
            Appointment.start_time,
            Appointment.service_id,
            Appointment.professional_id,
            Appointment.client_id,
        ).where(
            Appointment.store_id == sid,
            Appointment.start_time >= since,
            Appointment.start_time < now,
        )
    )
    rows = r.fetchall()

    completed = [row for row in rows if row.status == AppointmentStatus.COMPLETED.value]
    confirmed = [row for row in rows if row.status == AppointmentStatus.CONFIRMED.value]
    cancelled = [row for row in rows if row.status == AppointmentStatus.CANCELLED.value]

    # ── Ingresos ─────────────────────────────────────────────────────────────
    revenue_cents = sum((r.charged_price_cents or 0) for r in completed)

    # Ingresos período anterior (comparativa)
    r_prev = await db.execute(
        select(func.sum(Appointment.charged_price_cents)).where(
            Appointment.store_id == sid,
            Appointment.status == AppointmentStatus.COMPLETED.value,
            Appointment.start_time >= prev_since,
            Appointment.start_time < since,
        )
    )
    prev_revenue_cents = r_prev.scalar() or 0
    revenue_pct_change = (
        round((revenue_cents - prev_revenue_cents) / prev_revenue_cents * 100, 1)
        if prev_revenue_cents > 0
        else None
    )

    # ── Ingresos por día ─────────────────────────────────────────────────────
    revenue_by_day: dict[str, int] = {}
    for row in completed:
        day = row.start_time.strftime("%Y-%m-%d")
        revenue_by_day[day] = revenue_by_day.get(day, 0) + (row.charged_price_cents or 0)

    # Llenar días sin datos
    daily_revenue = []
    for i in range(days):
        d = (since + timedelta(days=i)).strftime("%Y-%m-%d")
        daily_revenue.append({"date": d, "revenue_cents": revenue_by_day.get(d, 0)})

    # ── Citas por día ────────────────────────────────────────────────────────
    appts_by_day: dict[str, dict[str, int]] = {}
    for row in rows:
        day = row.start_time.strftime("%Y-%m-%d")
        if day not in appts_by_day:
            appts_by_day[day] = {"completed": 0, "confirmed": 0, "cancelled": 0}
        if row.status == AppointmentStatus.COMPLETED.value:
            appts_by_day[day]["completed"] += 1
        elif row.status == AppointmentStatus.CONFIRMED.value:
            appts_by_day[day]["confirmed"] += 1
        elif row.status == AppointmentStatus.CANCELLED.value:
            appts_by_day[day]["cancelled"] += 1

    daily_appointments = []
    for i in range(days):
        d = (since + timedelta(days=i)).strftime("%Y-%m-%d")
        counts = appts_by_day.get(d, {"completed": 0, "confirmed": 0, "cancelled": 0})
        daily_appointments.append({"date": d, **counts})

    # ── Top servicios ────────────────────────────────────────────────────────
    svc_counts: dict[str, int] = {}
    svc_revenue: dict[str, int] = {}
    for row in rows:
        if row.service_id:
            svc_counts[row.service_id] = svc_counts.get(row.service_id, 0) + 1
        if row.status == AppointmentStatus.COMPLETED.value and row.service_id:
            svc_revenue[row.service_id] = svc_revenue.get(row.service_id, 0) + (row.charged_price_cents or 0)

    top_svc_ids = sorted(svc_counts, key=lambda k: svc_counts[k], reverse=True)[:5]
    top_services = []
    for svc_id in top_svc_ids:
        svc = await db.get(Service, svc_id)
        top_services.append(
            {
                "service_id": svc_id,
                "name": svc.name if svc else svc_id,
                "bookings": svc_counts[svc_id],
                "revenue_cents": svc_revenue.get(svc_id, 0),
            }
        )

    # ── Ocupación por profesional ────────────────────────────────────────────
    prof_counts: dict[str, int] = {}
    for row in rows:
        if row.professional_id and row.status in (
            AppointmentStatus.COMPLETED.value,
            AppointmentStatus.CONFIRMED.value,
        ):
            prof_counts[row.professional_id] = prof_counts.get(row.professional_id, 0) + 1

    prof_occupancy = []
    for prof_id, count in sorted(prof_counts.items(), key=lambda x: -x[1])[:8]:
        prof = await db.get(Professional, prof_id)
        prof_occupancy.append(
            {
                "professional_id": prof_id,
                "name": prof.name if prof else prof_id,
                "appointments": count,
            }
        )

    # ── Retención de clientes ────────────────────────────────────────────────
    client_ids_period = {row.client_id for row in rows if row.client_id}

    # Clientes con citas anteriores al período
    r_prev_clients = await db.execute(
        select(Appointment.client_id).where(
            Appointment.store_id == sid,
            Appointment.start_time < since,
            Appointment.client_id.isnot(None),
            Appointment.status.in_(
                [AppointmentStatus.COMPLETED.value, AppointmentStatus.CONFIRMED.value]
            ),
        )
    )
    prev_client_ids = {row.client_id for row in r_prev_clients.fetchall()}

    returning_clients = len(client_ids_period & prev_client_ids)
    new_clients = len(client_ids_period - prev_client_ids)

    # ── Tasa de cancelación ──────────────────────────────────────────────────
    total_appts = len(rows)
    cancellation_rate = round(len(cancelled) / total_appts * 100, 1) if total_appts > 0 else 0

    return {
        "period_days": days,
        "since": since.strftime("%Y-%m-%d"),
        "until": now.strftime("%Y-%m-%d"),
        # Resumen
        "summary": {
            "total_appointments": total_appts,
            "completed": len(completed),
            "confirmed": len(confirmed),
            "cancelled": len(cancelled),
            "revenue_cents": revenue_cents,
            "revenue_pct_change": revenue_pct_change,
            "cancellation_rate": cancellation_rate,
            "new_clients": new_clients,
            "returning_clients": returning_clients,
        },
        # Series temporales
        "daily_revenue": daily_revenue,
        "daily_appointments": daily_appointments,
        # Rankings
        "top_services": top_services,
        "prof_occupancy": prof_occupancy,
    }
