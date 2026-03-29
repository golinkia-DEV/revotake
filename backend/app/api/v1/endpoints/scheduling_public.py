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
    WaitlistEntry,
)
from app.services.scheduling_availability import compute_slots
from app.services.scheduling_booking import (
    create_appointment_booking,
    schedule_reminder_jobs,
    cancel_appointment_with_policy,
)
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
    settings = store.settings if isinstance(store.settings, dict) else {}
    sp = settings.get("store_profile") if isinstance(settings, dict) else {}
    public_block = {}
    if isinstance(sp, dict):
        loc = sp.get("location_public") if isinstance(sp.get("location_public"), dict) else {}
        hor = sp.get("horarios") if isinstance(sp.get("horarios"), dict) else {}
        am = sp.get("amenities") if isinstance(sp.get("amenities"), dict) else {}
        if loc or hor or am:
            public_block = {"location_public": loc, "horarios": hor, "amenities": am}
    return {
        "store_id": store.id,
        "name": store.name,
        "slug": store.slug,
        "public": public_block,
    }


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
                "description": s.description,
                "duration_minutes": s.duration_minutes,
                "price_cents": s.price_cents,
                "currency": s.currency,
                "deposit_required_cents": s.deposit_required_cents,
                "cancellation_hours": s.cancellation_hours,
                "cancellation_fee_cents": s.cancellation_fee_cents,
                "intake_form_schema": s.intake_form_schema or [],
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
    # Respuestas al formulario de intake del servicio
    intake_answers: Optional[dict] = None


@router.post("/{store_slug}/bookings")
async def public_create_booking(
    store_slug: str,
    data: PublicBookingCreate,
    db: AsyncSession = Depends(get_db),
):
    store = await _store_by_slug(db, store_slug)

    # Verificar si el servicio requiere intake antes de reservar
    svc = await db.get(Service, data.service_id)
    if svc and svc.intake_form_schema:
        required_fields = [f["id"] for f in svc.intake_form_schema if f.get("required")]
        missing = [f for f in required_fields if not (data.intake_answers or {}).get(f)]
        if missing:
            raise HTTPException(400, f"Faltan campos requeridos del formulario: {', '.join(missing)}")

    client = Client(
        store_id=store.id,
        name=data.client_name.strip(),
        email=(data.client_email or "").strip() or None,
        phone=(data.client_phone or "").strip() or None,
        preferences={"intake_answers": data.intake_answers} if data.intake_answers else {},
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

    await schedule_reminder_jobs(
        db,
        store.id,
        appt.id,
        appt.start_time,
        end_time=appt.end_time,
        suggest_rebooking_days=svc.suggest_rebooking_days if svc else 0,
    )
    await log_appointment_action(
        db,
        appointment_id=appt.id,
        store_id=store.id,
        action="public_booking",
        actor_user_id=None,
        payload={"client_id": client.id, "has_intake": bool(data.intake_answers)},
    )

    return {
        "appointment_id": appt.id,
        "manage_token": appt.manage_token,
        "status": appt.status,
        "checkout": extra.get("checkout"),
        "deposit_required_cents": svc.deposit_required_cents if svc else 0,
        "cancellation_policy": {
            "hours": svc.cancellation_hours if svc else 24,
            "fee_cents": svc.cancellation_fee_cents if svc else 0,
        } if svc else None,
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

    svc = await db.get(Service, appt.service_id)
    result = await cancel_appointment_with_policy(db, appt, svc, actor="public")
    if not result["ok"]:
        raise HTTPException(400, result["error"])

    await log_appointment_action(
        db,
        appointment_id=appt.id,
        store_id=appt.store_id,
        action="cancel_public",
        actor_user_id=None,
        payload={"policy_violated": result["policy_violated"], "fee_cents": result["fee_cents"]},
    )

    # Notificar lista de espera cuando se libera el slot
    from app.services.appointment_notification_worker import notify_waitlist_for_slot
    await notify_waitlist_for_slot(
        db,
        store_id=appt.store_id,
        professional_id=appt.professional_id,
        service_id=appt.service_id,
        branch_id=appt.branch_id,
        freed_date=appt.start_time,
    )

    return {
        "ok": True,
        "status": appt.status,
        "policy_violated": result["policy_violated"],
        "cancellation_fee_message": result["cancellation_fee_message"],
    }


class WaitlistJoinRequest(BaseModel):
    professional_id: str
    service_id: str
    branch_id: str
    desired_date: date
    client_name: str = Field(..., min_length=1, max_length=200)
    client_email: Optional[str] = None
    client_phone: Optional[str] = None


@router.post("/{store_slug}/waitlist")
async def public_join_waitlist(
    store_slug: str,
    data: WaitlistJoinRequest,
    db: AsyncSession = Depends(get_db),
):
    """Unirse a la lista de espera para un slot lleno."""
    store = await _store_by_slug(db, store_slug)

    prof = await db.get(Professional, data.professional_id)
    svc = await db.get(Service, data.service_id)
    branch = await db.get(Branch, data.branch_id)
    if not prof or prof.store_id != store.id:
        raise HTTPException(400, "Profesional inválido")
    if not svc or svc.store_id != store.id:
        raise HTTPException(400, "Servicio inválido")
    if not branch or branch.store_id != store.id:
        raise HTTPException(400, "Sucursal inválida")

    entry = WaitlistEntry(
        store_id=store.id,
        branch_id=data.branch_id,
        professional_id=data.professional_id,
        service_id=data.service_id,
        client_name=data.client_name.strip(),
        client_email=(data.client_email or "").strip() or None,
        client_phone=(data.client_phone or "").strip() or None,
        desired_date=data.desired_date,
        status="waiting",
    )
    db.add(entry)
    await db.flush()

    return {
        "waitlist_id": entry.id,
        "message": "Te notificaremos por email cuando haya disponibilidad.",
        "desired_date": data.desired_date.isoformat(),
    }


@router.get("/{store_slug}/waitlist/{desired_date}")
async def public_waitlist_count(
    store_slug: str,
    desired_date: date,
    professional_id: str,
    service_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retorna cuántos clientes esperan para ese día/profesional/servicio."""
    from sqlalchemy import func as sqlfunc
    store = await _store_by_slug(db, store_slug)
    r = await db.execute(
        select(sqlfunc.count(WaitlistEntry.id)).where(
            WaitlistEntry.store_id == store.id,
            WaitlistEntry.professional_id == professional_id,
            WaitlistEntry.service_id == service_id,
            WaitlistEntry.desired_date == desired_date,
            WaitlistEntry.status == "waiting",
        )
    )
    count = r.scalar_one_or_none() or 0
    return {"waiting_count": count, "date": desired_date.isoformat()}
