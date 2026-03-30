"""Puestos de trabajo (sillones/salas): semilla desde wizard, asignación al reservar."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scheduling import (
    Appointment,
    AppointmentStatus,
    ProfessionalBranch,
    WorkStation,
)


async def seed_work_stations_from_store_settings(
    db: AsyncSession,
    *,
    store_id: str,
    branch_id: str,
    store_settings: dict[str, Any] | None,
) -> int:
    """
    Crea sillones/salas iniciales según settings.local_structure si la sede aún no tiene puestos.
    Retorna cantidad de filas creadas.
    """
    ex = await db.execute(select(WorkStation.id).where(WorkStation.branch_id == branch_id).limit(1))
    if ex.scalar_one_or_none():
        return 0
    loc = (store_settings or {}).get("local_structure") or {}
    try:
        chairs = max(0, min(200, int(loc.get("chair_count") or 0)))
    except (TypeError, ValueError):
        chairs = 0
    try:
        rooms = max(0, min(100, int(loc.get("room_count") or 0)))
    except (TypeError, ValueError):
        rooms = 0
    n = 0
    for i in range(chairs):
        db.add(
            WorkStation(
                store_id=store_id,
                branch_id=branch_id,
                name=f"Sillón {i + 1}",
                kind="chair",
                sort_order=i,
                is_active=True,
            )
        )
        n += 1
    for j in range(rooms):
        db.add(
            WorkStation(
                store_id=store_id,
                branch_id=branch_id,
                name=f"Sala {j + 1}",
                kind="room",
                sort_order=chairs + j,
                is_active=True,
            )
        )
        n += 1
    if n:
        await db.flush()
    return n


async def station_time_free(
    db: AsyncSession,
    station_id: str,
    start: datetime,
    end: datetime,
    exclude_appointment_id: str | None = None,
) -> bool:
    now = datetime.utcnow()
    active = (
        AppointmentStatus.CONFIRMED.value,
        AppointmentStatus.PENDING_PAYMENT.value,
        AppointmentStatus.COMPLETED.value,
    )
    q = select(Appointment.id).where(
        Appointment.station_id == station_id,
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
    return r.scalar_one_or_none() is None


async def normalize_professional_branch_station(
    db: AsyncSession,
    *,
    branch_id: str,
    station_mode: str | None,
    default_station_id: str | None,
) -> tuple[str, str | None]:
    """Devuelve (mode, station_id) coherentes con la sede."""
    m = (station_mode or "none").lower()
    if m not in ("none", "fixed", "dynamic"):
        m = "none"
    if m == "none":
        return "none", None
    if m == "fixed":
        if not default_station_id:
            return "dynamic", None
        ws = await db.get(WorkStation, default_station_id)
        if not ws or ws.branch_id != branch_id or not ws.is_active:
            return "dynamic", None
        return "fixed", ws.id
    return "dynamic", None


async def assign_station_for_booking(
    db: AsyncSession,
    *,
    branch_id: str,
    professional_id: str,
    start_time: datetime,
    end_time: datetime,
) -> str | None:
    """
    Según vínculo profesional–sede: none → sin puesto; fixed → default_station si libre;
    dynamic → primer puesto libre. Sin puestos en la sede → None (no falla la reserva).
    """
    r = await db.execute(
        select(ProfessionalBranch).where(
            ProfessionalBranch.professional_id == professional_id,
            ProfessionalBranch.branch_id == branch_id,
        )
    )
    pb = r.scalar_one_or_none()
    if not pb:
        return None
    mode = (pb.station_mode or "none").lower()

    if mode == "none":
        return None

    if mode == "fixed" and pb.default_station_id:
        ws = await db.get(WorkStation, pb.default_station_id)
        if ws and ws.branch_id == branch_id and ws.is_active:
            if await station_time_free(db, ws.id, start_time, end_time):
                return ws.id
            raise ValueError(
                "El puesto fijo (sillón/sala) asignado a este profesional ya está ocupado en ese horario"
            )
        mode = "dynamic"

    if mode != "dynamic":
        return None

    st_r = await db.execute(
        select(WorkStation)
        .where(
            WorkStation.branch_id == branch_id,
            WorkStation.is_active.is_(True),
        )
        .order_by(WorkStation.sort_order, WorkStation.name)
    )
    stations = st_r.scalars().all()
    if not stations:
        return None
    for st in stations:
        if await station_time_free(db, st.id, start_time, end_time):
            return st.id
    raise ValueError("No hay sillón o sala libre en esa sede para el horario elegido")
