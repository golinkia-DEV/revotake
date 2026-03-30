"""Agenda personal: citas del profesional vinculado al usuario en la tienda actual."""
from datetime import date, datetime, timedelta
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import StoreContext, require_store, require_store_permission
from app.core.permissions import VER_AGENDA_PROPIA, VER_CLIENTES_PROPIOS, VER_REPORTES_COMISIONES
from app.models.user import User
from app.models.client import Client
from app.api.v1.endpoints.auth import get_current_user
from app.models.scheduling import (
    Appointment,
    AppointmentStatus,
    Professional,
    ProfessionalService,
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
            "phone": p.phone,
        }
        for p in pros
    ]
    return {
        "linked": len(pros) > 0,
        "professionals": items,
        "message": None
        if items
        else "Tu cuenta no tiene un perfil de profesional vinculado. Pedí a la tienda que te invite desde Crear profesional o que te asocie en la agenda.",
    }


@router.get("/staff/appointments")
async def staff_list_appointments(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_PROPIA)),
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
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_PROPIA)),
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


@router.get("/staff/my-clients")
async def staff_my_clients(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CLIENTES_PROPIOS)),
    user: User = Depends(get_current_user),
    limit: int = Query(200, ge=1, le=500),
):
    """Clientes con al menos una cita contigo (según permiso ver_clientes_propios)."""
    pros = await _professionals_for_user(db, ctx.store_id, user.id)
    if not pros:
        raise HTTPException(403, detail="No tienes perfil de profesional vinculado.")
    pids = [p.id for p in pros]

    sub_last = (
        select(
            Appointment.client_id.label("cid"),
            func.max(Appointment.start_time).label("last_at"),
        )
        .where(
            Appointment.store_id == ctx.store_id,
            Appointment.professional_id.in_(pids),
            Appointment.client_id.isnot(None),
        )
        .group_by(Appointment.client_id)
        .subquery()
    )
    r = await db.execute(
        select(Client, sub_last.c.last_at)
        .join(sub_last, Client.id == sub_last.c.cid)
        .where(Client.store_id == ctx.store_id)
        .order_by(sub_last.c.last_at.desc())
        .limit(limit)
    )
    out = []
    for cl, last_at in r.all():
        out.append(
            {
                "id": cl.id,
                "name": cl.name,
                "email": cl.email,
                "phone": cl.phone,
                "last_appointment_at": last_at.isoformat() if last_at else None,
            }
        )
    return {"items": out}


@router.get("/staff/my-production")
async def staff_my_production(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES_COMISIONES)),
    user: User = Depends(get_current_user),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
):
    """Producción estimada: citas completadas × comisión % por servicio (configurada al dar de alta)."""
    pros = await _professionals_for_user(db, ctx.store_id, user.id)
    if not pros:
        raise HTTPException(403, detail="No tienes perfil de profesional vinculado.")
    pids = [p.id for p in pros]

    fd = from_date or date.today() - timedelta(days=90)
    td = to_date or date.today()
    start = datetime(fd.year, fd.month, fd.day)
    end = datetime(td.year, td.month, td.day) + timedelta(days=1)

    q = (
        select(Appointment, Service.price_cents, ProfessionalService.commission_percent)
        .outerjoin(Service, Service.id == Appointment.service_id)
        .outerjoin(
            ProfessionalService,
            and_(
                ProfessionalService.professional_id == Appointment.professional_id,
                ProfessionalService.service_id == Appointment.service_id,
            ),
        )
        .where(
            Appointment.store_id == ctx.store_id,
            Appointment.professional_id.in_(pids),
            Appointment.status == AppointmentStatus.COMPLETED.value,
            Appointment.start_time >= start,
            Appointment.start_time < end,
        )
    )
    r = await db.execute(q)
    rows = r.all()

    revenue_cents = 0
    commission_cents = 0
    by_service: dict[str, dict] = {}

    for a, list_price, pct in rows:
        base = int(a.charged_price_cents if a.charged_price_cents is not None else (list_price or 0))
        revenue_cents += base
        rate = float(pct or 0) / 100.0
        com = int(round(base * rate))
        commission_cents += com
        sid = a.service_id or ""
        if sid not in by_service:
            by_service[sid] = {"service_id": sid, "completed_count": 0, "revenue_cents": 0, "commission_cents": 0}
        by_service[sid]["completed_count"] += 1
        by_service[sid]["revenue_cents"] += base
        by_service[sid]["commission_cents"] += com

    svc_names: dict[str, str] = {}
    for sid in by_service:
        if not sid:
            continue
        s = await db.get(Service, sid)
        if s:
            svc_names[sid] = s.name

    breakdown = []
    for sid, row in by_service.items():
        breakdown.append(
            {
                **row,
                "service_name": svc_names.get(sid, sid or "—"),
            }
        )
    breakdown.sort(key=lambda x: x["commission_cents"], reverse=True)

    product_pct = None
    if len(pids) == 1:
        pr0 = await db.get(Professional, pids[0])
        if pr0 and pr0.product_commission_percent is not None:
            product_pct = float(pr0.product_commission_percent)

    return {
        "from_date": fd.isoformat(),
        "to_date": td.isoformat(),
        "revenue_cents_completed": revenue_cents,
        "commission_cents_estimated": commission_cents,
        "product_commission_percent_config": product_pct,
        "note": "Las comisiones por servicio usan el % definido al crear el profesional. Ventas de productos aún no se asocian por profesional en el sistema.",
        "by_service": breakdown,
    }
