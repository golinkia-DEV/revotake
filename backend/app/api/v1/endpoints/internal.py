from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.services.meeting_reminders import process_meeting_reminders
from app.services.appointment_notification_worker import process_scheduling_notifications

router = APIRouter()


@router.post("/run-meeting-reminders")
async def run_meeting_reminders_cron(
    x_cron_secret: str | None = Header(None, alias="X-Cron-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Ejecuta el mismo proceso que el worker en segundo plano. Proteger con CRON_SECRET y llamar desde cron externo si no usas el worker."""
    if not settings.CRON_SECRET or x_cron_secret != settings.CRON_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    n = await process_meeting_reminders(db)
    return {"reminders_sent": n}


@router.post("/run-scheduling-notifications")
async def run_scheduling_notifications_cron(
    x_cron_secret: str | None = Header(None, alias="X-Cron-Secret"),
    db: AsyncSession = Depends(get_db),
):
    if not settings.CRON_SECRET or x_cron_secret != settings.CRON_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    n = await process_scheduling_notifications(db)
    return {"notifications_sent": n}
