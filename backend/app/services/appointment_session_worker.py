"""Abre fichas (tickets) al iniciar la hora de la cita y mantiene contexto para alertas de cierre."""
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.scheduling import Appointment, AppointmentStatus, Professional, Service
from app.models.ticket import Ticket, TicketStatus, TicketType

logger = logging.getLogger(__name__)


async def ensure_appointment_session_tickets(db: AsyncSession, limit: int = 80) -> int:
    """
    Citas confirmadas cuya hora de inicio ya pasó y aún no termina la franja (inicio <= now < fin):
    crea un ticket en Operaciones si aún no hay ticket vinculado.
    """
    now = datetime.utcnow()
    q = (
        select(Appointment, Client, Service, Professional)
        .outerjoin(Client, Client.id == Appointment.client_id)
        .join(Service, Service.id == Appointment.service_id)
        .join(Professional, Professional.id == Appointment.professional_id)
        .where(
            Appointment.status == AppointmentStatus.CONFIRMED.value,
            Appointment.ticket_id.is_(None),
            Appointment.start_time <= now,
            Appointment.end_time > now,
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
        extra = {
            "appointment_id": appt.id,
            "service_id": appt.service_id,
            "professional_id": appt.professional_id,
            "list_price_cents": list_price,
            "allow_price_override": bool(svc.allow_price_override) if svc else True,
            "product_id": svc.product_id if svc else None,
            "session_started_at": now.isoformat(),
        }
        ticket = Ticket(
            store_id=appt.store_id,
            title=title[:500],
            description=f"Cita en curso. Precio lista servicio: {list_price} {svc.currency if svc else 'CLP'}.",
            type=TicketType.TASK,
            status=TicketStatus.DATA_RECEIVED,
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


async def process_appointment_sessions(db: AsyncSession) -> int:
    return await ensure_appointment_session_tickets(db)
