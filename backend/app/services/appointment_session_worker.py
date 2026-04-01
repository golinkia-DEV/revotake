"""Sincroniza tickets de atención con la línea de tiempo de la cita."""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.scheduling import Appointment, AppointmentStatus, Professional, Service
from app.models.ticket import Ticket, TicketStatus, TicketType

logger = logging.getLogger(__name__)


STATUS_ORDER = {
    TicketStatus.NEW: 0,
    TicketStatus.QUALIFIED: 1,
    TicketStatus.MEETING_SCHEDULED: 2,
    TicketStatus.DATA_RECEIVED: 3,
    TicketStatus.SOLD: 4,
    TicketStatus.FOLLOW_UP: 5,
    TicketStatus.NO_RESPONSE: 6,
    TicketStatus.CLOSED: 7,
}


def _target_ticket_status(appt: Appointment, now: datetime) -> TicketStatus | None:
    if appt.status in (AppointmentStatus.CANCELLED.value, AppointmentStatus.NO_SHOW.value):
        return TicketStatus.NO_RESPONSE
    if appt.status == AppointmentStatus.COMPLETED.value:
        return TicketStatus.SOLD

    # Para citas activas/pago pendiente, movemos por ventana temporal.
    if appt.start_time <= now < appt.end_time:
        return TicketStatus.MEETING_SCHEDULED
    if now >= appt.end_time:
        return TicketStatus.DATA_RECEIVED

    minutes_to_start = (appt.start_time - now).total_seconds() / 60
    if minutes_to_start <= 20:
        return TicketStatus.QUALIFIED
    return TicketStatus.NEW


async def ensure_appointment_session_tickets(db: AsyncSession, limit: int = 80) -> int:
    """
    Crea ticket automático para citas cercanas/en curso cuando aún no existe ficha.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    lookahead = now + timedelta(minutes=20)
    recent_start = now - timedelta(minutes=10)
    q = (
        select(Appointment, Client, Service, Professional)
        .outerjoin(Client, Client.id == Appointment.client_id)
        .join(Service, Service.id == Appointment.service_id)
        .join(Professional, Professional.id == Appointment.professional_id)
        .where(
            Appointment.status.in_(
                [AppointmentStatus.CONFIRMED.value, AppointmentStatus.PENDING_PAYMENT.value]
            ),
            Appointment.ticket_id.is_(None),
            Appointment.start_time <= lookahead,
            Appointment.end_time > recent_start,
        )
        .order_by(Appointment.start_time)
        .limit(limit)
    )
    r = await db.execute(q)
    rows = list(r.all())
    created = 0
    for appt, cl, svc, prof in rows:
        client_name = cl.name if cl else "Cliente"
        svc_name = svc.name if svc else "Servicio"
        assigned = prof.user_id if prof else None
        list_price = svc.price_cents if svc else 0
        title = f"Atención: {client_name} — {svc_name}"
        target_status = _target_ticket_status(appt, now) or TicketStatus.NEW
        extra = {
            "appointment_id": appt.id,
            "service_id": appt.service_id,
            "professional_id": appt.professional_id,
            "list_price_cents": list_price,
            "estimated_duration_minutes": int(max(1, (appt.end_time - appt.start_time).total_seconds() // 60)),
            "allow_price_override": bool(svc.allow_price_override) if svc else True,
            "product_id": svc.product_id if svc else None,
            "auto_workflow_enabled": True,
            "session_started_at": now.isoformat(),
        }
        ticket = Ticket(
            store_id=appt.store_id,
            title=title[:500],
            description=f"Cita en curso. Precio lista servicio: {list_price} {svc.currency if svc else 'CLP'}.",
            type=TicketType.TASK,
            status=target_status,
            priority="high",
            client_id=appt.client_id,
            assigned_to=assigned,
            extra_data=extra,
            due_date=appt.end_time,
        )
        db.add(ticket)
        await db.flush()
        appt.ticket_id = ticket.id
        created += 1
    if created:
        logger.info("Tickets de sesión creados para citas en curso: %s", created)
    return created


async def sync_appointment_ticket_workflow(db: AsyncSession, limit: int = 200) -> int:
    """
    Mueve automáticamente el ticket por etapas según el tiempo de la cita:
    - new -> qualified -> meeting_scheduled -> data_received
    - sold cuando la cita está completada
    - no_response cuando se cancela o no_show
    Solo avanza etapas (no retrocede), para respetar ajustes manuales del equipo.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    q = (
        select(Appointment, Ticket)
        .join(Ticket, Ticket.id == Appointment.ticket_id)
        .where(
            Appointment.ticket_id.is_not(None),
            Ticket.type == TicketType.TASK,
            Ticket.status != TicketStatus.CLOSED,
        )
        .order_by(Appointment.start_time.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    moved = 0
    for appt, ticket in rows:
        extra = ticket.extra_data or {}
        if extra.get("auto_workflow_enabled") is False:
            continue
        target = _target_ticket_status(appt, now)
        if not target:
            continue
        current = ticket.status
        if STATUS_ORDER.get(target, -1) > STATUS_ORDER.get(current, -1):
            ticket.status = target
            moved += 1
    if moved:
        logger.info("Tickets movidos automáticamente por tiempo de servicio: %s", moved)
    return moved


async def process_appointment_sessions(db: AsyncSession) -> int:
    created = await ensure_appointment_session_tickets(db)
    moved = await sync_appointment_ticket_workflow(db)
    return created + moved
