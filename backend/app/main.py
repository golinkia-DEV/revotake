import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.api.v1.router import api_router
from app.services.meeting_reminders import process_meeting_reminders
from app.services.appointment_notification_worker import process_scheduling_notifications
from app.services.scheduling_booking import expire_pending_payment_holds

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async def worker_meetings():
        while True:
            try:
                async with AsyncSessionLocal() as session:
                    n = await process_meeting_reminders(session)
                    await session.commit()
                    if n:
                        logger.info("Recordatorios de citas enviados: %s", n)
            except Exception:
                logger.exception("Worker de recordatorios de citas")
            await asyncio.sleep(max(60, settings.MEETING_REMINDER_INTERVAL_SEC))

    async def worker_scheduling():
        while True:
            try:
                async with AsyncSessionLocal() as session:
                    expired = await expire_pending_payment_holds(session)
                    n = await process_scheduling_notifications(session)
                    await session.commit()
                    if expired:
                        logger.info("Citas pending_payment expiradas: %s", expired)
                    if n:
                        logger.info("Notificaciones de agenda enviadas: %s", n)
            except Exception:
                logger.exception("Worker de notificaciones de agenda")
            await asyncio.sleep(max(30, min(120, settings.MEETING_REMINDER_INTERVAL_SEC)))

    task_m = asyncio.create_task(worker_meetings())
    task_s = asyncio.create_task(worker_scheduling())
    yield
    task_m.cancel()
    task_s.cancel()
    for t in (task_m, task_s):
        try:
            await t
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="RevoTake API",
    version="1.0.0",
    description="Business Management Platform with AI",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "revotake-api"}
