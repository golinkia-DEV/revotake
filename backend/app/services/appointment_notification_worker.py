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
from app.services import email_templates as tmpl

logger = logging.getLogger(__name__)


def _store_color(store: Store) -> str:
    try:
        sp = (store.settings or {}).get("store_profile") or {}
        br = sp.get("branding") or {}
        color = br.get("primary_color", "")
        if color and color.startswith("#") and len(color) in (4, 7):
            return color
    except Exception:
        pass
    return "#7C3AED"


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

        store_color = _store_color(store)

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
        prof_name = prof.name if prof else ""
        branch_name = branch.name if branch else ""
        store_name = store.name
        currency = svc.currency if svc else "CLP"

        manage_url = f"{settings.FRONTEND_URL.rstrip('/')}/book/manage/{appt.manage_token}"
        book_url = f"{settings.FRONTEND_URL.rstrip('/')}/book/{store.slug}"
        start_fmt = appt.start_time.strftime("%d/%m/%Y %H:%M")

        subject: str
        html: str

        kind = job.kind

        if kind == NotificationJobKind.BOOKING_CONFIRMATION.value:
            subject, html = tmpl.booking_confirmation(
                client_name=client_name,
                store_name=store_name,
                store_color=store_color,
                service_name=svc_name,
                professional_name=prof_name,
                branch_name=branch_name,
                start_time_fmt=start_fmt,
                deposit_cents=svc.deposit_required_cents if svc else 0,
                currency=currency,
                cancellation_hours=svc.cancellation_hours if svc else 0,
                cancellation_fee_cents=svc.cancellation_fee_cents if svc else 0,
                manage_url=manage_url,
            )

        elif kind == NotificationJobKind.REMINDER_24H.value:
            subject, html = tmpl.reminder(
                client_name=client_name,
                store_name=store_name,
                store_color=store_color,
                service_name=svc_name,
                professional_name=prof_name,
                start_time_fmt=start_fmt,
                hours_before=24,
                manage_url=manage_url,
            )

        elif kind == NotificationJobKind.REMINDER_1H.value:
            subject, html = tmpl.reminder(
                client_name=client_name,
                store_name=store_name,
                store_color=store_color,
                service_name=svc_name,
                professional_name=prof_name,
                start_time_fmt=start_fmt,
                hours_before=1,
                manage_url=manage_url,
            )

        elif kind == NotificationJobKind.POST_VISIT_REVIEW.value:
            subject, html = tmpl.post_visit_review(
                client_name=client_name,
                store_name=store_name,
                store_color=store_color,
                service_name=svc_name,
                professional_name=prof_name,
                manage_url=manage_url,
            )

        elif kind == NotificationJobKind.REBOOKING_SUGGESTION.value:
            subject, html = tmpl.rebooking_suggestion(
                client_name=client_name,
                store_name=store_name,
                store_color=store_color,
                service_name=svc_name,
                book_url=book_url,
            )

        else:
            subject = f"Notificación — {store_name}"
            html = f"<p>{svc_name} — {start_fmt}</p><p><a href='{manage_url}'>Gestionar</a></p>"

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
    store_color = _store_color(store) if store else "#7C3AED"
    book_url = f"{settings.FRONTEND_URL.rstrip('/')}/book/{store.slug}" if store else ""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    notified = 0

    for entry in entries:
        if not entry.client_email:
            entry.status = "notified"
            entry.notified_at = now
            notified += 1
            continue

        subject, html = tmpl.waitlist_slot_available(
            client_name=entry.client_name,
            store_name=store_name,
            store_color=store_color,
            service_name=svc_name,
            date_fmt=freed_date_only.strftime("%d/%m/%Y"),
            book_url=book_url,
        )
        ok = send_html_email(entry.client_email, subject, html)
        if ok:
            entry.status = "notified"
            entry.notified_at = now
            notified += 1

    return notified
