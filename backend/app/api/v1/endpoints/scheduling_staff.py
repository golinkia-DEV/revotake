"""Agenda personal: citas del profesional vinculado al usuario en la tienda actual."""
from datetime import date, datetime, timedelta
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.user import User
from app.models.client import Client
from app.api.v1.endpoints.auth import get_current_user
from app.models.scheduling import (
    Appointment,
    AppointmentStatus,
    Professional,
    Service,
    Branch,
)

router = APIRouter()


async def _professionals_for_user(
    db: AsyncSession, store_id: str, user_id: str
) -> list[Professional]:
    r = await db.execute(
        select(Professional).where(
            Professional.store_id == store_id,
            Professional.user_id == user_id,
            Professional.is_active.is_(True),
        )
    )
    return list(r.scalars().all())


def _appointment_item(
    a: Appointment,
    client_name: str | None,
    service_name: str | None,
    branch_name: str | None,
) -> dict:
    return {
        "id": a.id,
        "branch_id": a.branch_id,
        "professional_id": a.professional_id,
        "service_id": a.service_id,
        "client_id": a.client_id,
        "client_name": client_name,
        "start_time": a.start_time.isoformat(),
        "end_time": a.end_time.isoformat(),
        "status": a.status,
        "payment_mode": a.payment_mode,
        "payment_status": a.payment_status,
        "notes": a.notes,
        "service_name": service_name,
        "branch_name": branch_name,
        "manage_token": a.manage_token,
    }


@router.get("/staff/me")
async def staff_me(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store),
    user: User = Depends(get_current_user),
):
    """Perfil de agenda: profesional(es) vinculados a tu usuario en esta tienda."""
    pros = await _professionals_for_user(db, ctx.store_id, user.id)
    items = [
        {
            "id": p.id,
            "name": p.name,
            "email": p.email,
        }
        for p in pros
    ]
    return {
        "linked": len(pros) > 0,
        "professionals": items,
        "message": None
        if items
        else "Tu cuenta no tiene un perfil de profesional vinculado. Pide a la administración de la tienda que te asocie en Citas → Profesionales.",
    }


@router.get("/staff/appointments")
async def staff_list_appointments(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store),
    user: User = Depends(get_current_user),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    status: Optional[str] = None,
):
    pros = await _professionals_for_user(db, ctx.store_id, user.id)
    if not pros:
        raise HTTPException(
            403,
            detail="No tienes perfil de profesional vinculado a esta tienda.",
        )
    ids = [p.id for p in pros]

    fd = from_date or date.today() - timedelta(days=7)
    td = to_date or date.today() + timedelta(days=60)
    start = datetime(fd.year, fd.month, fd.day)
    end = datetime(td.year, td.month, td.day) + timedelta(days=1)

    q = (
        select(Appointment, Client.name, Service.name, Branch.name)
        .outerjoin(Client, Client.id == Appointment.client_id)
        .outerjoin(Service, Service.id == Appointment.service_id)
        .outerjoin(Branch, Branch.id == Appointment.branch_id)
        .where(
            Appointment.store_id == ctx.store_id,
            Appointment.professional_id.in_(ids),
            Appointment.start_time >= start,
            Appointment.start_time < end,
        )
        .order_by(Appointment.start_time)
    )
    if status:
        q = q.where(Appointment.status == status)

    r = await db.execute(q)
    rows = r.all()
    return {
        "items": [
            _appointment_item(a, cname, sname, bname)
            for a, cname, sname, bname in rows
        ]
    }


class StaffAppointmentPatch(BaseModel):
    status: Optional[Literal["confirmed", "completed", "no_show", "cancelled"]] = None
    notes: Optional[str] = None


@router.patch("/staff/appointments/{appointment_id}")
async def staff_patch_appointment(
    appointment_id: str,
    data: StaffAppointmentPatch,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store),
    user: User = Depends(get_current_user),
):
    pros = await _professionals_for_user(db, ctx.store_id, user.id)
    ids = {p.id for p in pros}
    if not ids:
        raise HTTPException(403, detail="Sin perfil de profesional.")

    a = await db.get(Appointment, appointment_id)
    if not a or a.store_id != ctx.store_id or a.professional_id not in ids:
        raise HTTPException(404, "Cita no encontrada")

    if data.status is not None:
        allowed = {
            AppointmentStatus.CONFIRMED.value,
            AppointmentStatus.COMPLETED.value,
            AppointmentStatus.NO_SHOW.value,
            AppointmentStatus.CANCELLED.value,
        }
        if data.status not in allowed:
            raise HTTPException(400, "Estado no permitido para tu rol")
        a.status = data.status
    if data.notes is not None:
        a.notes = data.notes

    cl_name: str | None = None
    if a.client_id:
        cl = await db.get(Client, a.client_id)
        cl_name = cl.name if cl else None
    sv = await db.get(Service, a.service_id)
    br = await db.get(Branch, a.branch_id)
    return _appointment_item(a, cl_name, sv.name if sv else None, br.name if br else None)
