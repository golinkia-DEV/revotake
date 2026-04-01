"""Reserva pública por slug de tienda (sin JWT)."""
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
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
    AppointmentReview,
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
    logo_url = None
    st = store.settings if isinstance(store.settings, dict) else {}
    sp = st.get("store_profile") if isinstance(st.get("store_profile"), dict) else {}
    br = sp.get("branding") if isinstance(sp.get("branding"), dict) else {}
    if isinstance(br.get("logo_url"), str) and br["logo_url"].strip():
        logo_url = br["logo_url"].strip()

    return {
        "store_id": store.id,
        "name": store.name,
        "slug": store.slug,
        "logo_url": logo_url,
        "public": public_block,
    }


@router.get("/{store_slug}/ratings-summary")
async def public_ratings_summary(store_slug: str, db: AsyncSession = Depends(get_db)):
    """Promedio de estrellas de la tienda y por profesional (reserva pública)."""
    store = await _store_by_slug(db, store_slug)
    r = await db.execute(
        select(func.avg(AppointmentReview.rating), func.count(AppointmentReview.id)).where(
            AppointmentReview.store_id == store.id
        )
    )
    row = r.one()
    store_avg = float(row[0]) if row[0] is not None else None
    store_count = int(row[1] or 0)

    r2 = await db.execute(
        select(
            AppointmentReview.professional_id,
            func.avg(AppointmentReview.rating),
            func.count(AppointmentReview.id),
        )
        .where(AppointmentReview.store_id == store.id)
        .group_by(AppointmentReview.professional_id)
    )
    by_prof: dict = {}
    for pid, av, cnt in r2.all():
        by_prof[pid] = {
            "average": round(float(av), 2) if av is not None else None,
            "count": int(cnt or 0),
        }

    return {
        "store": {
            "average": round(store_avg, 2) if store_avg is not None else None,
            "count": store_count,
        },
        "by_professional": by_prof,
    }


@router.get("/{store_slug}/services")
async def public_services(store_slug: str, db: AsyncSession = Depends(get_db)):
    store = await _store_by_slug(db, store_slug)
    r = await db.execute(
        select(Service)
        .where(Service.store_id == store.id, Service.is_active.is_(True))
        .order_by(func.coalesce(Service.category, "").asc(), Service.menu_sort_order, Service.name)
    )
    items = r.scalars().all()
    return {
        "items": [
            {
                "id": s.id,
                "name": s.name,
                "slug": s.slug,
                "category": (s.category or "").strip() or None,
                "menu_sort_order": s.menu_sort_order,
                "description": s.description,
                "duration_minutes": s.duration_minutes,
                "price_cents": s.price_cents,
                "currency": s.currency,
                "deposit_required_cents": s.deposit_required_cents,
                "cancellation_hours": s.cancellation_hours,
                "cancellation_fee_cents": s.cancellation_fee_cents,
                "intake_form_schema": s.intake_form_schema or [],
                "image_urls": list(s.image_urls) if isinstance(s.image_urls, list) else [],
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
    return {
        "items": [
            {
                "id": b.id,
                "name": b.name,
                "slug": b.slug,
                "timezone": b.timezone,
                "region": b.region,
                "comuna": b.comuna,
                "address_line": b.address_line,
            }
            for b in items
        ]
    }


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
    pids = [p.id for p in pros]
    agg: dict[str, tuple[float | None, int]] = {}
    if pids:
        r_agg = await db.execute(
            select(
                AppointmentReview.professional_id,
                func.avg(AppointmentReview.rating),
                func.count(AppointmentReview.id),
            )
            .where(
                AppointmentReview.store_id == store.id,
                AppointmentReview.professional_id.in_(pids),
            )
            .group_by(AppointmentReview.professional_id)
        )
        for pid, av, cnt in r_agg.all():
            agg[pid] = (float(av) if av is not None else None, int(cnt or 0))

    def _prof_item(p: Professional) -> dict:
        av, cnt = agg.get(p.id, (None, 0))
        return {
            "id": p.id,
            "name": p.name,
            "email": p.email,
            "rating_average": round(av, 2) if av is not None else None,
            "rating_count": cnt,
        }

    return {"items": [_prof_item(p) for p in pros]}


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
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    past_visit = appt.end_time <= now
    cancellable_status = appt.status != AppointmentStatus.CANCELLED.value
    existing = (
        await db.execute(select(AppointmentReview).where(AppointmentReview.appointment_id == appt.id))
    ).scalar_one_or_none()
    can_submit_review = bool(cancellable_status and past_visit and existing is None)

    review_payload = None
    if existing:
        review_payload = {
            "rating": existing.rating,
            "comment": existing.comment,
            "created_at": existing.created_at.isoformat(),
        }

    return {
        "id": appt.id,
        "status": appt.status,
        "start_time": appt.start_time.isoformat(),
        "end_time": appt.end_time.isoformat(),
        "service": {"name": svc.name if svc else ""},
        "professional": {"id": prof.id if prof else None, "name": prof.name if prof else ""},
        "branch": {"name": br.name if br else ""},
        "payment_mode": appt.payment_mode,
        "payment_status": appt.payment_status,
        "review": {
            "can_submit": can_submit_review,
            "existing": review_payload,
        },
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


class PublicReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=500)


@router.post("/manage/{manage_token}/review")
async def public_manage_submit_review(
    manage_token: str,
    data: PublicReviewCreate,
    db: AsyncSession = Depends(get_db),
):
    """El cliente califica la visita usando el enlace de gestión (después de la hora de fin de la cita)."""
    r = await db.execute(select(Appointment).where(Appointment.manage_token == manage_token))
    appt = r.scalar_one_or_none()
    if not appt:
        raise HTTPException(404, "Cita no encontrada")
    if appt.status == AppointmentStatus.CANCELLED.value:
        raise HTTPException(400, "No se puede calificar una cita cancelada")
    if appt.end_time > datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(400, "Podés calificar después de la hora de término de la cita")

    dup = (
        await db.execute(select(AppointmentReview).where(AppointmentReview.appointment_id == appt.id))
    ).scalar_one_or_none()
    if dup:
        raise HTTPException(400, "Ya enviaste una calificación para esta cita")

    comment = (data.comment or "").strip() or None
    rev = AppointmentReview(
        appointment_id=appt.id,
        store_id=appt.store_id,
        professional_id=appt.professional_id,
        rating=data.rating,
        comment=comment,
    )
    db.add(rev)
    await db.flush()
    return {"ok": True, "rating": rev.rating, "comment": rev.comment}


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


# ── Ofertas Flash (pública) ────────────────────────────────────────────────────


@router.get("/{store_slug}/flash-deals")
async def public_flash_deals(store_slug: str, db: AsyncSession = Depends(get_db)):
    """Lista ofertas flash activas y no vencidas para el booking público."""
    from app.models.flash_deal import FlashDeal

    store = await _store_by_slug(db, store_slug)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    r = await db.execute(
        select(FlashDeal).where(
            FlashDeal.store_id == store.id,
            FlashDeal.is_active.is_(True),
            FlashDeal.expires_at > now,
            FlashDeal.appointment_id.is_(None),
        ).order_by(FlashDeal.slot_start_time.asc())
    )
    deals = r.scalars().all()

    result = []
    for deal in deals:
        prof = await db.get(Professional, deal.professional_id)
        svc = await db.get(Service, deal.service_id)
        branch = await db.get(Branch, deal.branch_id)
        discounted = max(0, deal.original_price_cents - int(deal.original_price_cents * deal.discount_percent / 100))
        result.append({
            "id": deal.id,
            "title": deal.title,
            "description": deal.description,
            "discount_percent": deal.discount_percent,
            "original_price_cents": deal.original_price_cents,
            "discounted_price_cents": discounted,
            "slot_start_time": deal.slot_start_time.isoformat(),
            "slot_end_time": deal.slot_end_time.isoformat(),
            "expires_at": deal.expires_at.isoformat(),
            "branch_id": deal.branch_id,
            "professional_id": deal.professional_id,
            "service_id": deal.service_id,
            "professional_name": prof.name if prof else None,
            "service_name": svc.name if svc else None,
            "branch_name": branch.name if branch else None,
            "duration_minutes": svc.duration_minutes if svc else None,
            "currency": svc.currency if svc else "CLP",
        })

    return {"items": result}


@router.post("/{store_slug}/flash-deals/{deal_id}/claim")
async def claim_flash_deal(
    store_slug: str,
    deal_id: str,
    data: PublicBookingCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Reclama una oferta flash: crea appointment con descuento aplicado.
    Verifica deal activo, no vencido y no reclamado.
    """
    from app.models.flash_deal import FlashDeal

    store = await _store_by_slug(db, store_slug)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    deal = await db.get(FlashDeal, deal_id)
    if not deal or deal.store_id != store.id:
        raise HTTPException(404, "Oferta no encontrada")
    if not deal.is_active:
        raise HTTPException(400, "Esta oferta ya no está activa")
    if deal.expires_at <= now:
        raise HTTPException(400, "Esta oferta ya venció")
    if deal.appointment_id is not None:
        raise HTTPException(400, "Esta oferta ya fue reclamada")

    # Crear cliente
    client = Client(
        store_id=store.id,
        name=data.client_name.strip(),
        email=(data.client_email or "").strip() or None,
        phone=(data.client_phone or "").strip() or None,
    )
    db.add(client)
    await db.flush()

    # Crear cita con el slot de la deal (ignoramos branch/professional/service del body)
    svc = await db.get(Service, deal.service_id)
    try:
        appt, extra = await create_appointment_booking(
            db,
            store_id=store.id,
            branch_id=deal.branch_id,
            professional_id=deal.professional_id,
            service_id=deal.service_id,
            client_id=client.id,
            start_time=deal.slot_start_time,
            payment_mode=data.payment_mode,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Marcar deal como reclamada
    deal.appointment_id = appt.id
    deal.claimed_at = now

    await db.commit()
    await db.refresh(deal)

    discounted = max(0, deal.original_price_cents - int(deal.original_price_cents * deal.discount_percent / 100))

    return {
        "appointment_id": appt.id,
        "manage_token": appt.manage_token,
        "status": appt.status,
        "flash_deal": {
            "id": deal.id,
            "title": deal.title,
            "discount_percent": deal.discount_percent,
            "original_price_cents": deal.original_price_cents,
            "discounted_price_cents": discounted,
        },
        "message": f"¡Oferta aplicada! Ahorra {deal.discount_percent}% con esta oferta flash.",
    }
