"""Procesa cola notification_jobs: email (SMS/WhatsApp con mismo hook)."""
import logging
from datetime import datetime, timezone

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
    WaitlistEntry,
)
from app.models.store import Store
from app.services.mail import send_html_email

logger = logging.getLogger(__name__)


async def process_scheduling_notifications(db: AsyncSession, limit: int = 50) -> int:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
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
        store_name = store.name

        manage_url = f"{settings.FRONTEND_URL.rstrip('/')}/book/manage/{appt.manage_token}"
        book_url = f"{settings.FRONTEND_URL.rstrip('/')}/book/{store.slug}"

        if job.kind == NotificationJobKind.BOOKING_CONFIRMATION.value:
            cancellation_policy = ""
            if svc and svc.cancellation_hours > 0:
                fee_text = (
                    f" Se aplicará un cargo de {svc.cancellation_fee_cents // 100} {svc.currency}."
                    if svc.cancellation_fee_cents > 0
                    else ""
                )
                cancellation_policy = (
                    f"<p><em>Política de cancelación: cancela con al menos "
                    f"{svc.cancellation_hours} horas de antelación sin costo.{fee_text}</em></p>"
                )
            deposit_text = ""
            if svc and svc.deposit_required_cents > 0:
                deposit_text = (
                    f"<p><strong>Depósito requerido:</strong> "
                    f"{svc.deposit_required_cents // 100} {svc.currency} al llegar.</p>"
                )
            subject = f"Cita confirmada: {svc_name}"
            html = f"""
            <p>Hola {client_name},</p>
            <p>Tu cita para <strong>{svc_name}</strong> con {prof_name}
            {f" en {branch_name}" if branch_name else ""} quedó registrada en {store_name}.</p>
            <p><strong>Inicio:</strong> {appt.start_time.strftime("%Y-%m-%d %H:%M")} UTC</p>
            {deposit_text}
            {cancellation_policy}
            <p><a href="{manage_url}">Gestionar o cancelar tu cita</a></p>
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
        elif job.kind == NotificationJobKind.POST_VISIT_REVIEW.value:
            subject = f"¿Cómo estuvo tu visita? — {store_name}"
            html = f"""
            <p>Hola {client_name},</p>
            <p>Esperamos que tu experiencia con <strong>{svc_name}</strong>
            {f"con {prof_name}" if prof_name else ""} haya sido excelente.</p>
            <p>Tu opinión nos ayuda a mejorar. ¿Nos dejas una reseña?</p>
            <p><a href="{manage_url}">Evaluar mi experiencia</a></p>
            <p>¡Gracias por visitarnos!</p>
            <p><em>{store_name}</em></p>
            """
        elif job.kind == NotificationJobKind.REBOOKING_SUGGESTION.value:
            subject = f"Es hora de tu próxima cita — {svc_name}"
            html = f"""
            <p>Hola {client_name},</p>
            <p>Han pasado unos días desde tu última visita para <strong>{svc_name}</strong>.</p>
            <p>¿Quieres agendar tu próxima cita? Tenemos disponibilidad esperándote.</p>
            <p><a href="{book_url}">Reservar ahora</a></p>
            <p><em>{store_name}</em></p>
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


async def notify_waitlist_for_slot(
    db: AsyncSession,
    store_id: str,
    professional_id: str,
    service_id: str,
    branch_id: str,
    freed_date: datetime,
    limit: int = 3,
) -> int:
    """Notifica hasta `limit` entradas en la lista de espera cuando se libera un slot."""
    from app.models.scheduling import WaitlistEntry
    from app.models.store import Store

    freed_date_only = freed_date.date()
    r = await db.execute(
        select(WaitlistEntry)
        .where(
            WaitlistEntry.professional_id == professional_id,
            WaitlistEntry.service_id == service_id,
            WaitlistEntry.branch_id == branch_id,
            WaitlistEntry.desired_date == freed_date_only,
            WaitlistEntry.status == "waiting",
        )
        .order_by(WaitlistEntry.created_at)
        .limit(limit)
    )
    entries = list(r.scalars().all())
    if not entries:
        return 0

    store = await db.get(Store, store_id)
    svc = await db.get(Service, service_id)
    svc_name = svc.name if svc else "Servicio"
    store_name = store.name if store else ""
    book_url = f"{settings.FRONTEND_URL.rstrip('/')}/book/{store.slug}" if store else ""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    notified = 0

    for entry in entries:
        if not entry.client_email:
            entry.status = "notified"
            entry.notified_at = now
            notified += 1
            continue
        subject = f"¡Hay disponibilidad! — {svc_name}"
        html = f"""
        <p>Hola {entry.client_name},</p>
        <p>Se liberó un espacio para <strong>{svc_name}</strong>
        el <strong>{freed_date_only.strftime("%d/%m/%Y")}</strong> en {store_name}.</p>
        <p>Reserva ahora antes de que se ocupe:</p>
        <p><a href="{book_url}">Agendar mi cita</a></p>
        """
        ok = send_html_email(entry.client_email, subject, html)
        if ok:
            entry.status = "notified"
            entry.notified_at = now
            notified += 1

    return notified
