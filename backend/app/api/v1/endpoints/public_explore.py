"""Explorador público de tiendas (sin JWT requerido)."""
from datetime import datetime, timezone
from math import radians, cos, sin, asin, sqrt
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.store import Store
from app.models.store_type import StoreType
from app.models.scheduling import Branch, AppointmentReview, Appointment
from app.models.flash_deal import FlashDeal
from app.models.store_event import StoreEvent

router = APIRouter()


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return R * 2 * asin(sqrt(a))


def _store_logo(store: Store) -> Optional[str]:
    s = store.settings if isinstance(store.settings, dict) else {}
    sp = s.get("store_profile", {}) if isinstance(s, dict) else {}
    br = sp.get("branding", {}) if isinstance(sp, dict) else {}
    url = br.get("logo_url") if isinstance(br, dict) else None
    return url if isinstance(url, str) and url.strip() else None


def _store_amenity(store: Store, key: str) -> bool:
    s = store.settings if isinstance(store.settings, dict) else {}
    sp = s.get("store_profile", {}) if isinstance(s, dict) else {}
    am = sp.get("amenities", {}) if isinstance(sp, dict) else {}
    val = am.get(key) if isinstance(am, dict) else False
    return bool(val)


def _store_location(store: Store) -> dict:
    s = store.settings if isinstance(store.settings, dict) else {}
    sp = s.get("store_profile", {}) if isinstance(s, dict) else {}
    loc = sp.get("location_public", {}) if isinstance(sp, dict) else {}
    if not isinstance(loc, dict):
        loc = {}
    return {
        "address": loc.get("direccion_atencion", ""),
        "comuna": loc.get("comuna", ""),
        "region": loc.get("region", ""),
    }


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Lista todos los tipos de tienda disponibles."""
    r = await db.execute(select(StoreType).order_by(StoreType.name))
    types = r.scalars().all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "icon_url": t.icon_url if hasattr(t, "icon_url") else None,
        }
        for t in types
    ]


@router.get("/stores")
async def discover_stores(
    lat: Optional[float] = Query(None, description="Latitud del usuario"),
    lng: Optional[float] = Query(None, description="Longitud del usuario"),
    radius_km: float = Query(50.0, description="Radio de búsqueda en km"),
    category_slug: Optional[str] = Query(None),
    pet_friendly: Optional[bool] = Query(None),
    delivery: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("rating", enum=["rating", "distance", "deals"]),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Descubrir tiendas con filtros y geolocalización."""
    q = (
        select(Store, StoreType)
        .join(StoreType, Store.store_type_id == StoreType.id, isouter=True)
        .where(Store.is_active.is_(True))
    )
    if category_slug:
        q = q.where(StoreType.slug == category_slug)
    if search:
        q = q.where(Store.name.ilike(f"%{search}%"))

    r = await db.execute(q)
    rows = r.all()

    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)

    result = []
    for store, store_type in rows:
        # Filtros de amenidades
        is_pet = _store_amenity(store, "mascotas_bienvenidas")
        is_delivery = _store_amenity(store, "domicilio") or _store_amenity(store, "retiro_en_tienda")
        if pet_friendly is not None and is_pet != pet_friendly:
            continue
        if delivery is not None and is_delivery != delivery:
            continue

        # Coordenadas de la primera rama activa con lat/lng
        branches_r = await db.execute(
            select(Branch)
            .where(Branch.store_id == store.id, Branch.is_active.is_(True))
            .order_by(Branch.created_at)
        )
        branches = list(branches_r.scalars().all())

        branch_lat = None
        branch_lng = None
        for br in branches:
            if getattr(br, "latitude", None) and getattr(br, "longitude", None):
                branch_lat = br.latitude
                branch_lng = br.longitude
                break

        # Filtro por radio si el usuario dio coords
        distance_km = None
        if lat is not None and lng is not None and branch_lat and branch_lng:
            distance_km = _haversine_km(lat, lng, branch_lat, branch_lng)
            if distance_km > radius_km:
                continue
        elif lat is not None and lng is not None and not (branch_lat and branch_lng):
            # Tienda sin coords: incluir siempre si no hay filtro de distancia estricto
            pass

        # Rating promedio
        rating_r = await db.execute(
            select(func.avg(AppointmentReview.rating), func.count(AppointmentReview.id))
            .where(AppointmentReview.store_id == store.id)
        )
        avg_rating, rating_count = rating_r.one()

        # Flash deals activos
        deals_r = await db.execute(
            select(func.count(FlashDeal.id)).where(
                FlashDeal.store_id == store.id,
                FlashDeal.is_active.is_(True),
                FlashDeal.expires_at > now_naive,
            )
        )
        flash_deals_count = deals_r.scalar() or 0

        loc = _store_location(store)
        loc["lat"] = branch_lat
        loc["lng"] = branch_lng

        result.append({
            "slug": store.slug,
            "name": store.name,
            "logo_url": _store_logo(store),
            "store_type": {"name": store_type.name, "slug": store_type.slug} if store_type else None,
            "location": loc,
            "rating_avg": round(float(avg_rating), 1) if avg_rating else None,
            "rating_count": rating_count or 0,
            "pet_friendly": is_pet,
            "delivery": is_delivery,
            "flash_deals_count": flash_deals_count,
            "distance_km": round(distance_km, 1) if distance_km is not None else None,
            "branches_count": len(branches),
        })

    # Ordenar
    if sort == "rating":
        result.sort(key=lambda x: (x["rating_avg"] or 0, x["rating_count"]), reverse=True)
    elif sort == "distance":
        result.sort(key=lambda x: (x["distance_km"] if x["distance_km"] is not None else 9999))
    elif sort == "deals":
        result.sort(key=lambda x: x["flash_deals_count"], reverse=True)

    total = len(result)
    offset = (page - 1) * limit
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": result[offset: offset + limit],
    }


@router.get("/stores/{store_slug}/events")
async def store_public_events(store_slug: str, db: AsyncSession = Depends(get_db)):
    """Eventos públicos próximos de una tienda."""
    store_r = await db.execute(select(Store).where(Store.slug == store_slug, Store.is_active.is_(True)))
    store = store_r.scalar_one_or_none()
    if not store:
        from fastapi import HTTPException
        raise HTTPException(404, "Tienda no encontrada")

    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    events_r = await db.execute(
        select(StoreEvent)
        .where(
            StoreEvent.store_id == store.id,
            StoreEvent.is_active.is_(True),
            StoreEvent.event_date >= now_naive,
        )
        .order_by(StoreEvent.event_date)
    )
    events = events_r.scalars().all()

    return [
        {
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "event_date": e.event_date.isoformat(),
            "location_text": e.location_text,
            "image_url": e.image_url,
            "max_attendees": e.max_attendees,
        }
        for e in events
    ]
