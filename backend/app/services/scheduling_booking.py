"""Reserva atómica con bloqueo por profesional (PostgreSQL advisory lock)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scheduling import (
    Appointment,
    AppointmentStatus,
    PaymentMode,
    PaymentStatus,
    NotificationJob,
    NotificationJobKind,
    NotificationChannel,
    ProfessionalBranch,
    Professional,
)
from app.services.scheduling_availability import load_service_for_professional
from app.services.work_stations import assign_station_for_booking


async def _lock_professional(db: AsyncSession, professional_id: str, store_id: str) -> None:
    r = await db.execute(
        select(Professional)
        .where(Professional.id == professional_id, Professional.store_id == store_id)
        .with_for_update()
    )
    if r.scalar_one_or_none() is None:
        raise ValueError("Profesional no encontrado")


async def _has_overlap(
    db: AsyncSession,
    professional_id: str,
    start: datetime,
    end: datetime,
    exclude_appointment_id: str | None = None,
) -> bool:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    active = (
        AppointmentStatus.CONFIRMED.value,
        AppointmentStatus.PENDING_PAYMENT.value,
        AppointmentStatus.COMPLETED.value,
    )
    q = select(Appointment.id).where(
        Appointment.professional_id == professional_id,
        Appointment.status.in_(active),
        Appointment.start_time < end,
        Appointment.end_time > start,
        or_(
            Appointment.status != AppointmentStatus.PENDING_PAYMENT.value,
            Appointment.hold_expires_at.is_(None),
            Appointment.hold_expires_at > now,
        ),
    )
    if exclude_appointment_id:
        q = q.where(Appointment.id != exclude_appointment_id)
    r = await db.execute(q)
    return r.scalar_one_or_none() is not None


async def create_appointment_booking(
    db: AsyncSession,
    *,
    store_id: str,
    branch_id: str,
    professional_id: str,
    service_id: str,
    client_id: str | None,
    start_time: datetime,
    payment_mode: str,
    notes: str | None = None,
    hold_minutes: int = 15,
) -> tuple[Appointment, dict[str, Any]]:
    """
    Crea cita; usa lock transaccional en el profesional.
    payment_mode online -> pending_payment + hold; on_site -> confirmed + not_required.
    """
    pb = await db.execute(
        select(ProfessionalBranch.id).where(
            ProfessionalBranch.professional_id == professional_id,
            ProfessionalBranch.branch_id == branch_id,
        )
    )
    if pb.scalar_one_or_none() is None:
        raise ValueError("Profesional no atiende en esta sucursal")

    svc = await load_service_for_professional(db, store_id, professional_id, service_id)
    if not svc:
        raise ValueError("Servicio no disponible para este profesional")

    await _lock_professional(db, professional_id, store_id)

    delta = timedelta(
        minutes=svc.duration_minutes + svc.buffer_before_minutes + svc.buffer_after_minutes
    )
    end_time = start_time + delta

    if await _has_overlap(db, professional_id, start_time, end_time):
        raise ValueError("El horario ya no está disponible")

    station_id = await assign_station_for_booking(
        db,
        branch_id=branch_id,
        professional_id=professional_id,
        start_time=start_time,
        end_time=end_time,
    )

    if payment_mode == PaymentMode.ONLINE.value:
        status = AppointmentStatus.PENDING_PAYMENT.value
        pay_stat = PaymentStatus.PENDING.value
        hold = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=hold_minutes)
    else:
        status = AppointmentStatus.CONFIRMED.value
        pay_stat = PaymentStatus.NOT_REQUIRED.value
        hold = None

    appt = Appointment(
        store_id=store_id,
        branch_id=branch_id,
        professional_id=professional_id,
        service_id=service_id,
        client_id=client_id,
        station_id=station_id,
        start_time=start_time,
        end_time=end_time,
        status=status,
        payment_mode=payment_mode,
        payment_status=pay_stat,
        hold_expires_at=hold,
        notes=notes,
    )
    db.add(appt)
    await db.flush()

    extra: dict[str, Any] = {"checkout": None}
    if payment_mode == PaymentMode.ONLINE.value:
        extra["checkout"] = {
            "mock": True,
            "message": "Integrar Stripe/Mercado Pago: usar POST /scheduling/payments/intent",
            "appointment_id": appt.id,
        }

    return appt, extra


async def cancel_appointment_with_policy(
    db: AsyncSession,
    appointment: "Appointment",
    service: "Service | None",
    actor: str = "public",
) -> dict:
    """
    Cancela una cita verificando la política de cancelación.
    Retorna dict con ok, status, policy_violated, fee_cents.
    """
    from app.models.scheduling import AppointmentStatus, Service

    if appointment.status in (AppointmentStatus.CANCELLED.value, AppointmentStatus.COMPLETED.value):
        return {"ok": False, "error": "La cita no se puede cancelar"}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    policy_violated = False
    fee_cents = 0

    if service and service.cancellation_hours > 0:
        deadline = appointment.start_time - timedelta(hours=service.cancellation_hours)
        if now > deadline:
            policy_violated = True
            fee_cents = service.cancellation_fee_cents or 0

    appointment.status = AppointmentStatus.CANCELLED.value
    return {
        "ok": True,
        "status": appointment.status,
        "policy_violated": policy_violated,
        "fee_cents": fee_cents,
        "cancellation_fee_message": (
            f"Se aplicará un cargo de {fee_cents // 100} por cancelación tardía."
            if policy_violated and fee_cents > 0
            else None
        ),
    }


async def expire_pending_payment_holds(db: AsyncSession) -> int:
    """Libera citas pending_payment con hold vencido."""
    from sqlalchemy import update

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    r = await db.execute(
        update(Appointment)
        .where(
            Appointment.status == AppointmentStatus.PENDING_PAYMENT.value,
            Appointment.hold_expires_at.is_not(None),
            Appointment.hold_expires_at < now,
        )
        .values(status=AppointmentStatus.CANCELLED.value)
    )
    return r.rowcount or 0


async def schedule_reminder_jobs(
    db: AsyncSession,
    store_id: str,
    appointment_id: str,
    start_time: datetime,
    end_time: datetime | None = None,
    suggest_rebooking_days: int = 0,
) -> None:
    """Encola recordatorios 24h y 1h antes, confirmación inmediata, reseña y re-agendamiento."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    t24 = start_time - timedelta(hours=24)
    t1 = start_time - timedelta(hours=1)

    def add_job(kind: str, at: datetime) -> None:
        if at <= now:
            return
        db.add(
            NotificationJob(
                store_id=store_id,
                appointment_id=appointment_id,
                kind=kind,
                channel=NotificationChannel.EMAIL.value,
                scheduled_at=at,
                payload={},
            )
        )

    add_job(NotificationJobKind.REMINDER_24H.value, t24)
    add_job(NotificationJobKind.REMINDER_1H.value, t1)
    db.add(
        NotificationJob(
            store_id=store_id,
            appointment_id=appointment_id,
            kind=NotificationJobKind.BOOKING_CONFIRMATION.value,
            channel=NotificationChannel.EMAIL.value,
            scheduled_at=now,
            payload={},
        )
    )

    # Solicitud de reseña: 2 horas después de que termina la cita
    if end_time:
        review_at = end_time + timedelta(hours=2)
        add_job(NotificationJobKind.POST_VISIT_REVIEW.value, review_at)

    # Sugerencia de re-agendamiento N días después del inicio
    if suggest_rebooking_days > 0:
        rebooking_at = start_time + timedelta(days=suggest_rebooking_days)
        add_job(NotificationJobKind.REBOOKING_SUGGESTION.value, rebooking_at)
