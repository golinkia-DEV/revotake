"""Ofertas Flash: slots libres con descuento para atraer clientas en tiempo real."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import StoreContext, require_store_permission
from app.core.permissions import VER_AGENDA_TIENDA, CREAR_CITA
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User
from app.models.flash_deal import FlashDeal
from app.models.flash_deal_event import FlashDealEvent
from app.models.scheduling import Branch, Professional, Service, ProfessionalService, ProfessionalBranch
from app.services.scheduling_availability import compute_slots

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────


class FlashDealCreate(BaseModel):
    branch_id: str
    professional_id: str
    service_id: str
    discount_percent: int = Field(..., ge=1, le=100)
    slot_start_time: datetime
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    expires_at: datetime


class FlashDealOut(BaseModel):
    id: str
    branch_id: str
    professional_id: str
    service_id: str
    discount_percent: int
    original_price_cents: int
    slot_start_time: datetime
    slot_end_time: datetime
    title: str
    description: Optional[str]
    expires_at: datetime
    is_active: bool
    is_claimed: bool
    claimed_at: Optional[datetime]
    created_at: datetime
    # joined data
    professional_name: Optional[str]
    service_name: Optional[str]
    branch_name: Optional[str]
    discounted_price_cents: int


def _deal_out(deal: FlashDeal, prof_name: str | None, svc_name: str | None, branch_name: str | None) -> FlashDealOut:
    discounted = max(0, deal.original_price_cents - int(deal.original_price_cents * deal.discount_percent / 100))
    return FlashDealOut(
        id=deal.id,
        branch_id=deal.branch_id,
        professional_id=deal.professional_id,
        service_id=deal.service_id,
        discount_percent=deal.discount_percent,
        original_price_cents=deal.original_price_cents,
        slot_start_time=deal.slot_start_time,
        slot_end_time=deal.slot_end_time,
        title=deal.title,
        description=deal.description,
        expires_at=deal.expires_at,
        is_active=deal.is_active,
        is_claimed=deal.appointment_id is not None,
        claimed_at=deal.claimed_at,
        created_at=deal.created_at,
        professional_name=prof_name,
        service_name=svc_name,
        branch_name=branch_name,
        discounted_price_cents=discounted,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/flash-deals", response_model=FlashDealOut)
async def create_flash_deal(
    data: FlashDealCreate,
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_TIENDA, CREAR_CITA)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Crea una oferta flash para un slot libre de un profesional."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Validar que expires_at < slot_start_time
    slot_start = data.slot_start_time.replace(tzinfo=None) if data.slot_start_time.tzinfo else data.slot_start_time
    expires = data.expires_at.replace(tzinfo=None) if data.expires_at.tzinfo else data.expires_at

    if expires >= slot_start:
        raise HTTPException(400, "expires_at debe ser anterior a slot_start_time")
    if slot_start <= now:
        raise HTTPException(400, "slot_start_time debe ser en el futuro")

    # Validar sucursal, profesional y servicio pertenecen a la tienda
    branch = await db.get(Branch, data.branch_id)
    if not branch or branch.store_id != ctx.store_id:
        raise HTTPException(400, "Sucursal inválida")

    prof = await db.get(Professional, data.professional_id)
    if not prof or prof.store_id != ctx.store_id:
        raise HTTPException(400, "Profesional inválido")

    svc = await db.get(Service, data.service_id)
    if not svc or svc.store_id != ctx.store_id:
        raise HTTPException(400, "Servicio inválido")

    # Validar que el profesional ofrece el servicio y trabaja en la sucursal
    ps_r = await db.execute(
        select(ProfessionalService).where(
            ProfessionalService.professional_id == data.professional_id,
            ProfessionalService.service_id == data.service_id,
        )
    )
    if not ps_r.scalar_one_or_none():
        raise HTTPException(400, "El profesional no ofrece este servicio")

    pb_r = await db.execute(
        select(ProfessionalBranch).where(
            ProfessionalBranch.professional_id == data.professional_id,
            ProfessionalBranch.branch_id == data.branch_id,
        )
    )
    if not pb_r.scalar_one_or_none():
        raise HTTPException(400, "El profesional no trabaja en esta sucursal")

    # Validar que el slot está disponible
    # compute_slots retorna lista de ISO strings como "2025-04-01T14:00:00Z"
    slots = await compute_slots(
        db,
        store_id=ctx.store_id,
        branch_id=data.branch_id,
        professional_id=data.professional_id,
        service_id=data.service_id,
        on_date=slot_start.date(),
    )
    slot_start_iso = slot_start.isoformat() + "Z"
    if slot_start_iso not in slots:
        raise HTTPException(
            400,
            f"El slot {slot_start.strftime('%H:%M')} del {slot_start.date()} no está disponible",
        )

    slot_end = slot_start + timedelta(minutes=svc.duration_minutes)

    deal = FlashDeal(
        store_id=ctx.store_id,
        branch_id=data.branch_id,
        professional_id=data.professional_id,
        service_id=data.service_id,
        discount_percent=data.discount_percent,
        original_price_cents=svc.price_cents,
        slot_start_time=slot_start,
        slot_end_time=slot_end,
        title=data.title,
        description=data.description,
        expires_at=expires,
        created_by=current_user.id,
    )
    db.add(deal)
    await db.commit()
    await db.refresh(deal)

    return _deal_out(deal, prof.name, svc.name, branch.name)


@router.get("/flash-deals", response_model=list[FlashDealOut])
async def list_flash_deals(
    is_active: Optional[bool] = Query(None),
    branch_id: Optional[str] = Query(None),
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_TIENDA, CREAR_CITA)),
    db: AsyncSession = Depends(get_db),
):
    """Lista ofertas flash de la tienda (activas + históricas)."""
    q = select(FlashDeal).where(FlashDeal.store_id == ctx.store_id)
    if is_active is not None:
        q = q.where(FlashDeal.is_active.is_(is_active))
    if branch_id:
        q = q.where(FlashDeal.branch_id == branch_id)
    q = q.order_by(FlashDeal.slot_start_time.desc())

    r = await db.execute(q)
    deals = r.scalars().all()

    result = []
    for deal in deals:
        prof = await db.get(Professional, deal.professional_id)
        svc = await db.get(Service, deal.service_id)
        branch = await db.get(Branch, deal.branch_id)
        result.append(_deal_out(
            deal,
            prof.name if prof else None,
            svc.name if svc else None,
            branch.name if branch else None,
        ))
    return result


@router.put("/flash-deals/{deal_id}/cancel", response_model=FlashDealOut)
async def cancel_flash_deal(
    deal_id: str,
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_TIENDA, CREAR_CITA)),
    db: AsyncSession = Depends(get_db),
):
    """Cancela (desactiva) una oferta flash si aún no fue reclamada."""
    deal = await db.get(FlashDeal, deal_id)
    if not deal or deal.store_id != ctx.store_id:
        raise HTTPException(404, "Oferta no encontrada")
    if deal.appointment_id is not None:
        raise HTTPException(400, "No se puede cancelar una oferta ya reclamada")
    if not deal.is_active:
        raise HTTPException(400, "La oferta ya está inactiva")

    deal.is_active = False
    await db.commit()
    await db.refresh(deal)

    prof = await db.get(Professional, deal.professional_id)
    svc = await db.get(Service, deal.service_id)
    branch = await db.get(Branch, deal.branch_id)
    return _deal_out(
        deal,
        prof.name if prof else None,
        svc.name if svc else None,
        branch.name if branch else None,
    )


@router.get("/flash-deals/stats")
async def flash_deals_stats(
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_TIENDA, CREAR_CITA)),
    db: AsyncSession = Depends(get_db),
):
    """Estadísticas de ofertas flash de la tienda."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    total_active_r = await db.execute(
        select(func.count()).select_from(FlashDeal).where(
            FlashDeal.store_id == ctx.store_id,
            FlashDeal.is_active.is_(True),
            FlashDeal.appointment_id.is_(None),
            FlashDeal.expires_at > now,
        )
    )
    total_active = total_active_r.scalar() or 0

    total_claimed_r = await db.execute(
        select(func.count()).select_from(FlashDeal).where(
            FlashDeal.store_id == ctx.store_id,
            FlashDeal.appointment_id.isnot(None),
        )
    )
    total_claimed = total_claimed_r.scalar() or 0

    total_expired_r = await db.execute(
        select(func.count()).select_from(FlashDeal).where(
            FlashDeal.store_id == ctx.store_id,
            FlashDeal.is_active.is_(True),
            FlashDeal.appointment_id.is_(None),
            FlashDeal.expires_at <= now,
        )
    )
    total_expired = total_expired_r.scalar() or 0

    # Revenue lost = suma de (descuento aplicado) en deals reclamadas
    claimed_deals_r = await db.execute(
        select(FlashDeal).where(
            FlashDeal.store_id == ctx.store_id,
            FlashDeal.appointment_id.isnot(None),
        )
    )
    claimed_deals = claimed_deals_r.scalars().all()
    revenue_lost = sum(
        int(d.original_price_cents * d.discount_percent / 100)
        for d in claimed_deals
    )

    return {
        "total_active": total_active,
        "total_claimed": total_claimed,
        "total_expired": total_expired,
        "revenue_lost_to_deals_cents": revenue_lost,
    }


@router.get("/flash-deals/analytics")
async def flash_deals_analytics(
    days: int = Query(30, ge=1, le=366),
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_TIENDA, CREAR_CITA)),
    db: AsyncSession = Depends(get_db),
):
    """
    Panel tipo BI: embudo (vista bloque → clic en oferta → reserva), serie diaria e ingresos
    por reservas con oferta en el período (precio promocional cobrado / descuento otorgado).
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    since = now - timedelta(days=days)

    type_counts_r = await db.execute(
        select(FlashDealEvent.event_type, func.count(FlashDealEvent.id))
        .where(FlashDealEvent.store_id == ctx.store_id, FlashDealEvent.created_at >= since)
        .group_by(FlashDealEvent.event_type)
    )
    by_type = {row[0]: int(row[1]) for row in type_counts_r.all()}
    section_views = by_type.get("section_view", 0)
    apply_clicks = by_type.get("apply_click", 0)
    claims = by_type.get("claim", 0)

    day_col = cast(FlashDealEvent.created_at, Date)
    daily_r = await db.execute(
        select(day_col, FlashDealEvent.event_type, func.count(FlashDealEvent.id))
        .where(FlashDealEvent.store_id == ctx.store_id, FlashDealEvent.created_at >= since)
        .group_by(day_col, FlashDealEvent.event_type)
        .order_by(day_col)
    )
    daily_map: dict[str, dict[str, int]] = {}
    for d, ev_type, cnt in daily_r.all():
        key = d.isoformat() if hasattr(d, "isoformat") else str(d)
        if key not in daily_map:
            daily_map[key] = {"section_view": 0, "apply_click": 0, "claim": 0}
        if ev_type in daily_map[key]:
            daily_map[key][ev_type] = int(cnt)

    # Rellenar días sin eventos (eje X continuo)
    daily_series = []
    start_d = since.date()
    end_d = now.date()
    cur = start_d
    while cur <= end_d:
        ks = cur.isoformat()
        row = daily_map.get(ks, {"section_view": 0, "apply_click": 0, "claim": 0})
        daily_series.append(
            {
                "date": ks,
                "section_view": row["section_view"],
                "apply_click": row["apply_click"],
                "claim": row["claim"],
            }
        )
        cur = cur + timedelta(days=1)

    claimed_in_period_r = await db.execute(
        select(FlashDeal).where(
            FlashDeal.store_id == ctx.store_id,
            FlashDeal.appointment_id.isnot(None),
            FlashDeal.claimed_at.isnot(None),
            FlashDeal.claimed_at >= since,
        )
    )
    claimed_deals = claimed_in_period_r.scalars().all()
    revenue_discounted_cents = 0
    revenue_list_original_cents = 0
    discount_given_cents = 0
    for d in claimed_deals:
        disc = int(d.original_price_cents * d.discount_percent / 100)
        pay = max(0, d.original_price_cents - disc)
        revenue_discounted_cents += pay
        revenue_list_original_cents += d.original_price_cents
        discount_given_cents += disc

    def _pct(num: int, den: int) -> float | None:
        if den <= 0:
            return None
        return round(100.0 * num / den, 1)

    return {
        "period_days": days,
        "since": since.isoformat(),
        "summary": {
            "section_views": section_views,
            "apply_clicks": apply_clicks,
            "claims": claims,
            "revenue_discounted_cents": revenue_discounted_cents,
            "revenue_list_original_cents": revenue_list_original_cents,
            "discount_given_cents": discount_given_cents,
            "ctr_apply_per_section": _pct(apply_clicks, section_views),
            "conversion_claim_per_apply": _pct(claims, apply_clicks),
            "conversion_claim_per_section": _pct(claims, section_views),
        },
        "funnel": [
            {"stage": "Vistas del bloque", "key": "section_view", "count": section_views},
            {"stage": 'Clic "Tomar oferta"', "key": "apply_click", "count": apply_clicks},
            {"stage": "Reservas con oferta", "key": "claim", "count": claims},
        ],
        "daily": daily_series,
    }
