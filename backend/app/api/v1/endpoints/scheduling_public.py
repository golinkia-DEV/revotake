"""Reserva pública por slug de tienda (sin JWT)."""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.store import Store
from app.models.client import Client
from app.models.scheduling import (
    Branch,
    Professional,
    ProfessionalBranch,
    ProfessionalService,
    Service,
    Appointment,
    AppointmentStatus,
    PaymentMode,
)
from app.services.scheduling_availability import compute_slots
from app.services.scheduling_booking import create_appointment_booking, schedule_reminder_jobs
from app.services.scheduling_audit import log_appointment_action

router = APIRouter()


async def _store_by_slug(db: AsyncSession, slug: str) -> Store:
    r = await db.execute(select(Store).where(Store.slug == slug, Store.is_active.is_(True)))
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Tienda no encontrada")
    return s


@router.get("/{store_slug}/meta")
async def public_meta(store_slug: str, db: AsyncSession = Depends(get_db)):
    store = await _store_by_slug(db, store_slug)
    return {"store_id": store.id, "name": store.name, "slug": store.slug}


@router.get("/{store_slug}/services")
async def public_services(store_slug: str, db: AsyncSession = Depends(get_db)):
    store = await _store_by_slug(db, store_slug)
    r = await db.execute(
        select(Service).where(Service.store_id == store.id, Service.is_active.is_(True)).order_by(Service.name)
    )
    items = r.scalars().all()
    return {
        "items": [
            {
                "id": s.id,
                "name": s.name,
                "slug": s.slug,
                "duration_minutes": s.duration_minutes,
                "price_cents": s.price_cents,
                "currency": s.currency,
            }
            for s in items
        ]
    }


@router.get("/{store_slug}/branches")
async def public_branches(store_slug: str, db: AsyncSession = Depends(get_db)):
    store = await _store_by_slug(db, store_slug)
    r = await db.execute(
        select(Branch).where(Branch.store_id == store.id, Branch.is_active.is_(True)).order_by(Branch.name)
    )
    items = r.scalars().all()
    return {"items": [{"id": b.id, "name": b.name, "slug": b.slug, "timezone": b.timezone} for b in items]}


@router.get("/{store_slug}/professionals")
async def public_professionals(
    store_slug: str,
    branch_id: str,
    service_id: str,
    db: AsyncSession = Depends(get_db),
):
    store = await _store_by_slug(db, store_slug)
    br = await db.get(Branch, branch_id)
    if not br or br.store_id != store.id:
        raise HTTPException(400, "Sucursal inválida")
    sv = await db.get(Service, service_id)
    if not sv or sv.store_id != store.id:
        raise HTTPException(400, "Servicio inválido")

    q = (
        select(Professional)
        .join(ProfessionalBranch, ProfessionalBranch.professional_id == Professional.id)
        .join(ProfessionalService, ProfessionalService.professional_id == Professional.id)
        .where(
            Professional.store_id == store.id,
            Professional.is_active.is_(True),
            ProfessionalBranch.branch_id == branch_id,
            ProfessionalService.service_id == service_id,
        )
        .order_by(Professional.name)
    )
    r = await db.execute(q)
    pros = r.scalars().unique().all()
    return {"items": [{"id": p.id, "name": p.name, "email": p.email} for p in pros]}


@router.get("/{store_slug}/slots")
async def public_slots(
    store_slug: str,
    branch_id: str,
    professional_id: str,
    service_id: str,
    on_date: date,
    db: AsyncSession = Depends(get_db),
):
    store = await _store_by_slug(db, store_slug)
    slots = await compute_slots(
        db,
        store_id=store.id,
        branch_id=branch_id,
        professional_id=professional_id,
        service_id=service_id,
        on_date=on_date,
    )
    return {"slots": slots, "date": on_date.isoformat()}


class PublicBookingCreate(BaseModel):
    branch_id: str
    professional_id: str
    service_id: str
    start_time: datetime
    payment_mode: str = Field(default=PaymentMode.ON_SITE.value)
    client_name: str = Field(..., min_length=1, max_length=200)
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    notes: Optional[str] = None


@router.post("/{store_slug}/bookings")
async def public_create_booking(
    store_slug: str,
    data: PublicBookingCreate,
    db: AsyncSession = Depends(get_db),
):
    store = await _store_by_slug(db, store_slug)
    client = Client(
        store_id=store.id,
        name=data.client_name.strip(),
        email=(data.client_email or "").strip() or None,
        phone=(data.client_phone or "").strip() or None,
    )
    db.add(client)
    await db.flush()

    try:
        appt, extra = await create_appointment_booking(
            db,
            store_id=store.id,
            branch_id=data.branch_id,
            professional_id=data.professional_id,
            service_id=data.service_id,
            client_id=client.id,
            start_time=data.start_time,
            payment_mode=data.payment_mode,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    await schedule_reminder_jobs(db, store.id, appt.id, appt.start_time)
    await log_appointment_action(
        db,
        appointment_id=appt.id,
        store_id=store.id,
        action="public_booking",
        actor_user_id=None,
        payload={"client_id": client.id},
    )

    return {
        "appointment_id": appt.id,
        "manage_token": appt.manage_token,
        "status": appt.status,
        "checkout": extra.get("checkout"),
    }


@router.get("/manage/{manage_token}")
async def public_manage_get(manage_token: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Appointment).where(Appointment.manage_token == manage_token))
    appt = r.scalar_one_or_none()
    if not appt:
        raise HTTPException(404, "Cita no encontrada")
    svc = await db.get(Service, appt.service_id)
    prof = await db.get(Professional, appt.professional_id)
    br = await db.get(Branch, appt.branch_id)
    return {
        "id": appt.id,
        "status": appt.status,
        "start_time": appt.start_time.isoformat(),
        "end_time": appt.end_time.isoformat(),
        "service": {"name": svc.name if svc else ""},
        "professional": {"name": prof.name if prof else ""},
        "branch": {"name": br.name if br else ""},
        "payment_mode": appt.payment_mode,
        "payment_status": appt.payment_status,
    }


@router.post("/manage/{manage_token}/cancel")
async def public_manage_cancel(manage_token: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Appointment).where(Appointment.manage_token == manage_token))
    appt = r.scalar_one_or_none()
    if not appt:
        raise HTTPException(404, "Cita no encontrada")
    if appt.status in (AppointmentStatus.CANCELLED.value, AppointmentStatus.COMPLETED.value):
        raise HTTPException(400, "La cita no se puede cancelar")
    appt.status = AppointmentStatus.CANCELLED.value
    await log_appointment_action(
        db,
        appointment_id=appt.id,
        store_id=appt.store_id,
        action="cancel_public",
        actor_user_id=None,
        payload={},
    )
    return {"ok": True, "status": appt.status}
