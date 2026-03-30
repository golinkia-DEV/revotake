"""Vista unificada para la Agenda: citas del día, reuniones y tickets activos con responsables."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.core.permissions import VER_AGENDA_TIENDA
from app.models.client import Client
from app.models.meeting import Meeting
from app.models.scheduling import Appointment, Branch, Professional, Service, WorkStation
from app.models.ticket import Ticket, TicketStatus
from app.models.user import User

router = APIRouter()

DEFAULT_TZ = "America/Santiago"

# Citas consideradas "en curso" para la franja horaria (excl. canceladas / no show)
_APPT_ACTIVE_STATUSES = frozenset({"pending_payment", "confirmed"})


def _naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _appt_row(
    a: Appointment,
    prof_name: str | None,
    svc_name: str | None,
    client_name: str | None,
    branch_name: str | None,
    station_name: str | None,
    in_progress: bool,
    svc_price_cents: int | None = None,
    allow_price_override: bool | None = None,
) -> dict[str, Any]:
    return {
        "id": a.id,
        "start_time": a.start_time.isoformat(),
        "end_time": a.end_time.isoformat(),
        "status": a.status,
        "professional_id": a.professional_id,
        "professional_name": prof_name or "",
        "service_name": svc_name or "",
        "client_name": client_name or "",
        "branch_name": branch_name or "",
        "station_name": station_name or "",
        "ticket_id": a.ticket_id,
        "in_progress": in_progress,
        "service_price_cents": int(svc_price_cents) if svc_price_cents is not None else 0,
        "allow_price_override": True if allow_price_override is None else bool(allow_price_override),
    }


def _meeting_row(m: Meeting, organizer_name: str | None, organizer_email: str | None) -> dict[str, Any]:
    return {
        "id": m.id,
        "title": m.title,
        "client_id": m.client_id,
        "start_time": m.start_time.isoformat(),
        "end_time": m.end_time.isoformat(),
        "meeting_url": m.meeting_url,
        "ics_token": m.ics_token,
        "confirmation_status": m.confirmation_status,
        "organizer_name": organizer_name or "",
        "organizer_email": organizer_email or "",
    }


def _ticket_row(t: Ticket, assignee_name: str | None) -> dict[str, Any]:
    return {
        "id": t.id,
        "title": t.title,
        "type": t.type.value if hasattr(t.type, "value") else str(t.type),
        "status": t.status.value if hasattr(t.status, "value") else str(t.status),
        "priority": t.priority,
        "client_id": t.client_id,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "assigned_to": t.assigned_to,
        "assignee_name": assignee_name or "",
        "extra_data": t.extra_data or {},
    }


@router.get("/agenda-hub")
async def agenda_hub(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store),
):
    """
    Resumen operativo del día (zona horaria Chile por defecto) y trabajo en curso:
    citas con profesional y cliente, reuniones con organizador, tickets abiertos con responsable.
    """
    tz_name = DEFAULT_TZ
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc
        tz_name = "UTC"

    now_local = datetime.now(tz)
    day_start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end_local = day_start_local + timedelta(days=1)
    day_start_utc = _naive_utc(day_start_local.astimezone(timezone.utc))
    day_end_utc = _naive_utc(day_end_local.astimezone(timezone.utc))
    now_utc = _naive_utc(now_local.astimezone(timezone.utc))

    can_scheduling = VER_AGENDA_TIENDA in ctx.permissions

    appointments_in_progress: list[dict[str, Any]] = []
    appointments_rest_today: list[dict[str, Any]] = []

    if can_scheduling:
        q_appt = (
            select(
                Appointment,
                Professional.name,
                Service.name,
                Client.name,
                Branch.name,
                WorkStation.name,
                Service.price_cents,
                Service.allow_price_override,
            )
            .outerjoin(Professional, Professional.id == Appointment.professional_id)
            .outerjoin(Service, Service.id == Appointment.service_id)
            .outerjoin(Client, Client.id == Appointment.client_id)
            .outerjoin(Branch, Branch.id == Appointment.branch_id)
            .outerjoin(WorkStation, WorkStation.id == Appointment.station_id)
            .where(
                Appointment.store_id == ctx.store_id,
                Appointment.start_time >= day_start_utc,
                Appointment.start_time < day_end_utc,
                Appointment.status.in_(_APPT_ACTIVE_STATUSES),
            )
            .order_by(Appointment.start_time)
        )
        r_appt = await db.execute(q_appt)
        for row in r_appt.all():
            a, pname, sname, cname, bname, stname, price_c, allow_po = row
            in_prog = a.start_time <= now_utc < a.end_time
            item = _appt_row(a, pname, sname, cname, bname, stname, in_prog, price_c, allow_po)
            if in_prog:
                appointments_in_progress.append(item)
            else:
                appointments_rest_today.append(item)

    u_org = aliased(User)
    q_meet = (
        select(Meeting, u_org.name, u_org.email)
        .outerjoin(u_org, u_org.id == Meeting.organizer_id)
        .where(
            Meeting.store_id == ctx.store_id,
            Meeting.start_time >= day_start_utc,
            Meeting.start_time < day_end_utc,
        )
        .order_by(Meeting.start_time)
    )
    r_meet = await db.execute(q_meet)
    meetings_today = [_meeting_row(m, oname, oemail) for m, oname, oemail in r_meet.all()]

    u_asg = aliased(User)
    q_tix = (
        select(Ticket, u_asg.name)
        .outerjoin(u_asg, u_asg.id == Ticket.assigned_to)
        .where(
            Ticket.store_id == ctx.store_id,
            Ticket.status != TicketStatus.CLOSED,
        )
        .order_by(Ticket.updated_at.desc())
        .limit(80)
    )
    r_tix = await db.execute(q_tix)
    active_tickets = [_ticket_row(t, aname) for t, aname in r_tix.all()]

    return {
        "timezone": tz_name,
        "now_local_iso": now_local.isoformat(),
        "appointments_in_progress": appointments_in_progress,
        "appointments_rest_today": appointments_rest_today,
        "meetings_today": meetings_today,
        "active_tickets": active_tickets,
        "scheduling_included": can_scheduling,
    }
