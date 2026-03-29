"""Cálculo de slots disponibles: sucursal + profesional + servicio + fecha."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Sequence

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scheduling import (
    Appointment,
    AvailabilityRule,
    AvailabilityRuleType,
    AppointmentStatus,
    Holiday,
    ProfessionalService,
    Service,
    ProfessionalBranch,
)


SLOT_STEP_MINUTES = 15


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _weekday_mon0(d: date) -> int:
    return d.weekday()


async def is_holiday(
    db: AsyncSession,
    store_id: str,
    branch_id: str,
    d: date,
) -> bool:
    q = await db.execute(
        select(Holiday.id).where(
            Holiday.store_id == store_id,
            Holiday.holiday_date == d,
            or_(Holiday.branch_id.is_(None), Holiday.branch_id == branch_id),
        )
    )
    return q.scalar_one_or_none() is not None


async def load_service_for_professional(
    db: AsyncSession,
    store_id: str,
    professional_id: str,
    service_id: str,
) -> Service | None:
    sv = await db.get(Service, service_id)
    if not sv or sv.store_id != store_id or not sv.is_active:
        return None
    ps = await db.execute(
        select(ProfessionalService.id).where(
            ProfessionalService.professional_id == professional_id,
            ProfessionalService.service_id == service_id,
        )
    )
    if ps.scalar_one_or_none() is None:
        return None
    return sv


def _merge_weekly_and_exceptions(
    weekday: int,
    d: date,
    rules: Sequence[AvailabilityRule],
) -> list[tuple[int, int]]:
    """Ventanas en minutos desde medianoche (inicio inclusive, fin exclusive)."""
    exceptions = [
        r
        for r in rules
        if r.rule_type == AvailabilityRuleType.EXCEPTION.value and r.specific_date == d
    ]
    if exceptions:
        ex = exceptions[0]
        if ex.is_closed:
            return []
        if ex.start_time and ex.end_time:
            a, b = _time_to_minutes(ex.start_time), _time_to_minutes(ex.end_time)
            if b > a:
                return [(a, b)]
        return []

    weekly = [
        r
        for r in rules
        if r.rule_type == AvailabilityRuleType.WEEKLY.value
        and r.weekday is not None
        and r.weekday == weekday
    ]
    windows: list[tuple[int, int]] = []
    for r in weekly:
        if r.is_closed:
            continue
        if r.start_time and r.end_time:
            a, b = _time_to_minutes(r.start_time), _time_to_minutes(r.end_time)
            if b > a:
                windows.append((a, b))
    windows.sort(key=lambda x: x[0])
    return windows


async def _get_blocked_intervals(
    db: AsyncSession,
    professional_id: str,
    day_start: datetime,
    day_end: datetime,
) -> list[tuple[datetime, datetime]]:
    active_statuses = (
        AppointmentStatus.CONFIRMED.value,
        AppointmentStatus.PENDING_PAYMENT.value,
        AppointmentStatus.COMPLETED.value,
    )
    now = datetime.utcnow()
    q = await db.execute(
        select(Appointment.start_time, Appointment.end_time).where(
            Appointment.professional_id == professional_id,
            Appointment.status.in_(active_statuses),
            Appointment.start_time < day_end,
            Appointment.end_time > day_start,
            or_(
                Appointment.status != AppointmentStatus.PENDING_PAYMENT.value,
                Appointment.hold_expires_at.is_(None),
                Appointment.hold_expires_at > now,
            ),
        )
    )
    return [(a, b) for a, b in q.all()]


def _intervals_overlap(
    s1: datetime, e1: datetime, s2: datetime, e2: datetime
) -> bool:
    return s1 < e2 and s2 < e1


async def compute_slots(
    db: AsyncSession,
    store_id: str,
    branch_id: str,
    professional_id: str,
    service_id: str,
    on_date: date,
) -> list[str]:
    """ISO UTC de inicio de cada slot disponible."""
    svc = await load_service_for_professional(db, store_id, professional_id, service_id)
    if not svc:
        return []

    pb = await db.execute(
        select(ProfessionalBranch.id).where(
            ProfessionalBranch.professional_id == professional_id,
            ProfessionalBranch.branch_id == branch_id,
        )
    )
    if pb.scalar_one_or_none() is None:
        return []

    if await is_holiday(db, store_id, branch_id, on_date):
        return []

    total_minutes = (
        svc.duration_minutes + svc.buffer_before_minutes + svc.buffer_after_minutes
    )

    rules_r = await db.execute(
        select(AvailabilityRule).where(
            AvailabilityRule.professional_id == professional_id,
            AvailabilityRule.branch_id == branch_id,
        )
    )
    rules = list(rules_r.scalars().all())
    wd = _weekday_mon0(on_date)
    windows = _merge_weekly_and_exceptions(wd, on_date, rules)
    if not windows:
        return []

    day_start = datetime(on_date.year, on_date.month, on_date.day)
    day_end = day_start + timedelta(days=1)

    blocked = await _get_blocked_intervals(db, professional_id, day_start, day_end)

    out: list[str] = []
    for w_min, w_max in windows:
        t = w_min
        while t + total_minutes <= w_max:
            start_min = t
            end_min = t + total_minutes
            start_dt = day_start + timedelta(minutes=start_min)
            end_dt = day_start + timedelta(minutes=end_min)
            ok = True
            for bs, be in blocked:
                if _intervals_overlap(start_dt, end_dt, bs, be):
                    ok = False
                    break
            if ok and start_dt >= datetime.utcnow():
                out.append(start_dt.isoformat() + "Z")
            t += SLOT_STEP_MINUTES
    return out
