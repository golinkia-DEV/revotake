import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.client import Client
from app.models.meeting import Meeting, MeetingConfirmationStatus
from app.models.store import Store
from app.services.mail import send_html_email

logger = logging.getLogger(__name__)


def reminder_hours_for_store(store: Store) -> int:
    ag = (store.settings or {}).get("agenda") or {}
    v = ag.get("reminder_hours_before")
    if v is not None:
        try:
            return max(1, int(v))
        except (TypeError, ValueError):
            pass
    return max(1, int(settings.MEETING_REMINDER_HOURS_BEFORE))


async def process_meeting_reminders(db: AsyncSession) -> int:
    """Envía recordatorios para citas que entran en la ventana (N horas antes) y aún no tienen recordatorio."""
    now = datetime.utcnow()
    result = await db.execute(
        select(Meeting).where(
            Meeting.reminder_sent_at.is_(None),
            Meeting.confirmation_status == MeetingConfirmationStatus.SCHEDULED.value,
            Meeting.start_time > now,
        )
    )
    meetings = result.scalars().all()
    processed = 0
    base = settings.PUBLIC_API_BASE.rstrip("/")

    for m in meetings:
        store = await db.get(Store, m.store_id)
        if not store or not store.is_active:
            continue
        hours = reminder_hours_for_store(store)
        deadline = m.start_time - timedelta(hours=hours)
        if now < deadline:
            continue

        client_email: str | None = None
        if m.client_id:
            client = await db.get(Client, m.client_id)
            if client and client.email:
                client_email = client.email.strip() or None

        confirm_url = f"{base}/meetings/confirm/{m.confirmation_token}"
        decline_url = f"{base}/meetings/decline/{m.confirmation_token}"

        subject = f"Confirma tu cita: {m.title}"
        html = f"""
        <p>Hola,</p>
        <p>Tienes una cita próxima: <strong>{m.title}</strong>.</p>
        <p>Inicio: {m.start_time.strftime('%Y-%m-%d %H:%M')} (UTC)</p>
        <p>Por favor confirma o indica si no podrás asistir:</p>
        <p>
          <a href="{confirm_url}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Confirmar cita</a>
          &nbsp;
          <a href="{decline_url}" style="display:inline-block;padding:10px 16px;background:#475569;color:#fff;text-decoration:none;border-radius:8px;">No podré asistir</a>
        </p>
        <p style="color:#64748b;font-size:12px;">Si el botón no funciona, copia y pega estos enlaces en el navegador:<br/>
        Confirmar: {confirm_url}<br/>
        Rechazar: {decline_url}</p>
        """

        if client_email:
            ok = send_html_email(client_email, subject, html)
            if not ok:
                logger.warning("No se pudo enviar recordatorio para reunión %s; se reintentará.", m.id)
                continue
        else:
            logger.info(
                "Reunión %s sin email de cliente; se marca recordatorio enviado para seguimiento en panel.",
                m.id,
            )

        m.reminder_sent_at = now
        m.confirmation_status = MeetingConfirmationStatus.AWAITING.value
        processed += 1

    return processed
