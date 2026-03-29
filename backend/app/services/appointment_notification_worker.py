"""Procesa cola notification_jobs: email (SMS/WhatsApp con mismo hook)."""
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.client import Client
from app.models.scheduling import (
    Appointment,
    NotificationJob,
    NotificationJobKind,
    Service,
    Professional,
    Branch,
)
from app.models.store import Store
from app.services.mail import send_html_email

logger = logging.getLogger(__name__)


async def process_scheduling_notifications(db: AsyncSession, limit: int = 50) -> int:
    now = datetime.utcnow()
    r = await db.execute(
        select(NotificationJob)
        .where(NotificationJob.sent_at.is_(None), NotificationJob.scheduled_at <= now)
        .order_by(NotificationJob.scheduled_at)
        .limit(limit)
    )
    jobs = list(r.scalars().all())
    sent = 0
    for job in jobs:
        appt = await db.get(Appointment, job.appointment_id)
        if not appt:
            job.sent_at = now
            job.last_error = "appointment_missing"
            sent += 1
            continue

        store = await db.get(Store, appt.store_id)
        if not store or not store.is_active:
            job.sent_at = now
            job.last_error = "store_inactive"
            sent += 1
            continue

        client_email: str | None = None
        client_name = "Cliente"
        if appt.client_id:
            cl = await db.get(Client, appt.client_id)
            if cl and cl.email:
                client_email = cl.email.strip() or None
                client_name = cl.name

        svc = await db.get(Service, appt.service_id)
        prof = await db.get(Professional, appt.professional_id)
        branch = await db.get(Branch, appt.branch_id)
        svc_name = svc.name if svc else "Servicio"
        prof_name = prof.name if prof else "Profesional"
        branch_name = branch.name if branch else ""

        manage_url = f"{settings.FRONTEND_URL.rstrip('/')}/book/manage/{appt.manage_token}"

        if job.kind == NotificationJobKind.BOOKING_CONFIRMATION.value:
            subject = f"Cita registrada: {svc_name}"
            html = f"""
            <p>Hola {client_name},</p>
            <p>Tu cita para <strong>{svc_name}</strong> con {prof_name}
            {f" en {branch_name}" if branch_name else ""} quedó registrada.</p>
            <p><strong>Inicio:</strong> {appt.start_time.strftime("%Y-%m-%d %H:%M")} UTC</p>
            <p><a href="{manage_url}">Gestionar o cancelar</a></p>
            """
        elif job.kind == NotificationJobKind.REMINDER_24H.value:
            subject = f"Recordatorio: cita mañana — {svc_name}"
            html = f"""
            <p>Hola {client_name},</p>
            <p>Te recordamos tu cita con {prof_name}: <strong>{svc_name}</strong>.</p>
            <p><strong>Inicio:</strong> {appt.start_time.strftime("%Y-%m-%d %H:%M")} UTC</p>
            <p><a href="{manage_url}">Confirmar o cancelar</a></p>
            """
        elif job.kind == NotificationJobKind.REMINDER_1H.value:
            subject = f"Recordatorio: tu cita en 1 hora — {svc_name}"
            html = f"""
            <p>Hola {client_name},</p>
            <p>Tu cita con {prof_name} comienza en aproximadamente una hora.</p>
            <p><strong>{svc_name}</strong> — {appt.start_time.strftime("%H:%M")} UTC</p>
            <p><a href="{manage_url}">Abrir gestión</a></p>
            """
        else:
            subject = "Notificación de cita"
            html = f"<p>{svc_name} — {appt.start_time}</p><p><a href='{manage_url}'>Gestionar</a></p>"

        ok = True
        if client_email:
            ok = send_html_email(client_email, subject, html)
        else:
            logger.info("Cita %s sin email; marcamos job %s como enviado.", appt.id, job.id)

        if ok or not client_email:
            job.sent_at = now
            job.attempts = job.attempts + 1
            sent += 1
        else:
            job.attempts = job.attempts + 1
            job.last_error = "email_failed"

    return sent
