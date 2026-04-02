"""Portal público: registro, login y perfil de usuarios finales."""
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Header
from jose import JWTError
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token, decode_token
from app.models.public_user import PublicUser
from app.models.store_follower import StoreFollower
from app.models.store_event import StoreEvent
from app.models.event_rsvp import EventRSVP
from app.models.store import Store
from app.models.store_type import StoreType
from app.models.scheduling import Appointment, AppointmentReview, AppointmentStatus
from app.models.client import Client
from app.models.flash_deal import FlashDeal

router = APIRouter()

PUBLIC_SUB_PREFIX = "public:"


# ─── Schemas ──────────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None


class GoogleAuthIn(BaseModel):
    access_token: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileIn(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class RSVPIn(BaseModel):
    status: str = Field("accepted", pattern="^(accepted|declined)$")


# ─── Auth helpers ──────────────────────────────────────────────────────────────

def _make_public_token(user_id: str) -> str:
    return create_access_token({"sub": f"{PUBLIC_SUB_PREFIX}{user_id}"})


async def _get_public_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> PublicUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "No autenticado")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        sub: str = payload.get("sub", "")
        if not sub.startswith(PUBLIC_SUB_PREFIX):
            raise HTTPException(401, "Token inválido")
        user_id = sub[len(PUBLIC_SUB_PREFIX):]
    except JWTError:
        raise HTTPException(401, "Token inválido o expirado")
    r = await db.execute(select(PublicUser).where(PublicUser.id == user_id, PublicUser.is_active.is_(True)))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return user


def _user_out(user: PublicUser) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at.isoformat(),
    }


def _store_logo(store: Store) -> Optional[str]:
    s = store.settings if isinstance(store.settings, dict) else {}
    sp = s.get("store_profile", {}) if isinstance(s, dict) else {}
    br = sp.get("branding", {}) if isinstance(sp, dict) else {}
    url = br.get("logo_url") if isinstance(br, dict) else None
    return url if isinstance(url, str) and url.strip() else None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    """Registrar nuevo usuario público."""
    existing = await db.execute(select(PublicUser).where(PublicUser.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Ya existe una cuenta con ese correo")
    user = PublicUser(
        name=body.name,
        email=body.email,
        phone=body.phone,
        password_hash=get_password_hash(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"access_token": _make_public_token(user.id), "token_type": "bearer", "user": _user_out(user)}


@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    """Login de usuario público."""
    r = await db.execute(select(PublicUser).where(PublicUser.email == body.email, PublicUser.is_active.is_(True)))
    user = r.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Credenciales incorrectas")
    return {"access_token": _make_public_token(user.id), "token_type": "bearer", "user": _user_out(user)}


@router.post("/google", status_code=200)
async def google_login(body: GoogleAuthIn, db: AsyncSession = Depends(get_db)):
    """Login / registro con Google para usuarios del portal público."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google login no está configurado")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {body.access_token}"},
            timeout=10,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Token de Google inválido")

    info = resp.json()
    google_id = info.get("sub")
    email = (info.get("email") or "").strip().lower()
    name = (info.get("name") or email.split("@")[0]).strip()
    avatar_url = info.get("picture") or None

    if not google_id or not email:
        raise HTTPException(status_code=400, detail="Token de Google no contiene los datos necesarios")

    # Buscar por google_id primero, luego por email
    r = await db.execute(select(PublicUser).where(PublicUser.google_id == google_id))
    user = r.scalar_one_or_none()

    if not user:
        r = await db.execute(select(PublicUser).where(PublicUser.email == email))
        user = r.scalar_one_or_none()
        if user:
            user.google_id = google_id
            if not user.avatar_url and avatar_url:
                user.avatar_url = avatar_url
        else:
            user = PublicUser(
                name=name,
                email=email,
                phone=None,
                password_hash=None,
                google_id=google_id,
                avatar_url=avatar_url,
            )
            db.add(user)
            await db.flush()

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    await db.commit()
    await db.refresh(user)
    return {"access_token": _make_public_token(user.id), "token_type": "bearer", "user": _user_out(user)}


@router.get("/me")
async def me(user: PublicUser = Depends(_get_public_user)):
    return _user_out(user)


@router.put("/me")
async def update_me(
    body: UpdateProfileIn,
    user: PublicUser = Depends(_get_public_user),
    db: AsyncSession = Depends(get_db),
):
    if body.name is not None:
        user.name = body.name
    if body.phone is not None:
        user.phone = body.phone
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.post("/stores/{slug}/follow", status_code=201)
async def follow_store(
    slug: str,
    user: PublicUser = Depends(_get_public_user),
    db: AsyncSession = Depends(get_db),
):
    store_r = await db.execute(select(Store).where(Store.slug == slug, Store.is_active.is_(True)))
    store = store_r.scalar_one_or_none()
    if not store:
        raise HTTPException(404, "Tienda no encontrada")
    existing = await db.execute(
        select(StoreFollower).where(
            StoreFollower.public_user_id == user.id,
            StoreFollower.store_id == store.id,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(StoreFollower(public_user_id=user.id, store_id=store.id))
        await db.commit()
    return {"message": "Tienda seguida"}


@router.delete("/stores/{slug}/follow")
async def unfollow_store(
    slug: str,
    user: PublicUser = Depends(_get_public_user),
    db: AsyncSession = Depends(get_db),
):
    store_r = await db.execute(select(Store).where(Store.slug == slug))
    store = store_r.scalar_one_or_none()
    if not store:
        raise HTTPException(404, "Tienda no encontrada")
    follower_r = await db.execute(
        select(StoreFollower).where(
            StoreFollower.public_user_id == user.id,
            StoreFollower.store_id == store.id,
        )
    )
    follower = follower_r.scalar_one_or_none()
    if follower:
        await db.delete(follower)
        await db.commit()
    return {"message": "Dejaste de seguir la tienda"}


@router.get("/following")
async def following(
    user: PublicUser = Depends(_get_public_user),
    db: AsyncSession = Depends(get_db),
):
    """Tiendas que sigue el usuario con información básica."""
    followers_r = await db.execute(
        select(StoreFollower).where(StoreFollower.public_user_id == user.id)
    )
    store_ids = [f.store_id for f in followers_r.scalars().all()]
    if not store_ids:
        return []

    stores_r = await db.execute(
        select(Store, StoreType)
        .join(StoreType, Store.store_type_id == StoreType.id, isouter=True)
        .where(Store.id.in_(store_ids), Store.is_active.is_(True))
    )
    result = []
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    for store, store_type in stores_r.all():
        rating_r = await db.execute(
            select(func.avg(AppointmentReview.rating), func.count(AppointmentReview.id))
            .where(AppointmentReview.store_id == store.id)
        )
        avg_rating, rating_count = rating_r.one()

        deals_r = await db.execute(
            select(func.count(FlashDeal.id)).where(
                FlashDeal.store_id == store.id,
                FlashDeal.is_active.is_(True),
                FlashDeal.expires_at > now_naive,
            )
        )
        flash_count = deals_r.scalar() or 0

        result.append({
            "slug": store.slug,
            "name": store.name,
            "logo_url": _store_logo(store),
            "store_type": {"name": store_type.name, "slug": store_type.slug} if store_type else None,
            "rating_avg": round(float(avg_rating), 1) if avg_rating else None,
            "rating_count": rating_count or 0,
            "flash_deals_count": flash_count,
        })
    return result


@router.get("/history")
async def appointment_history(
    user: PublicUser = Depends(_get_public_user),
    db: AsyncSession = Depends(get_db),
):
    """Historial de reservas del usuario (buscando por email en clientes)."""
    clients_r = await db.execute(
        select(Client).where(Client.email == user.email)
    )
    clients = clients_r.scalars().all()
    if not clients:
        return []

    client_ids = [c.id for c in clients]

    appts_r = await db.execute(
        select(Appointment)
        .where(Appointment.client_id.in_(client_ids))
        .order_by(Appointment.start_time.desc())
        .limit(100)
    )
    appointments = appts_r.scalars().all()

    result = []
    for appt in appointments:
        store_r = await db.execute(select(Store).where(Store.id == appt.store_id))
        store = store_r.scalar_one_or_none()

        # Check if review exists
        review_r = await db.execute(
            select(AppointmentReview).where(AppointmentReview.appointment_id == appt.id)
        )
        review = review_r.scalar_one_or_none()

        result.append({
            "id": appt.id,
            "manage_token": appt.manage_token,
            "store_name": store.name if store else "",
            "store_slug": store.slug if store else "",
            "store_logo": _store_logo(store) if store else None,
            "start_time": appt.start_time.isoformat(),
            "end_time": appt.end_time.isoformat(),
            "status": appt.status.value if hasattr(appt.status, "value") else str(appt.status),
            "review": {
                "rating": review.rating,
                "comment": review.comment,
            } if review else None,
        })
    return result


@router.get("/notifications")
async def notifications(
    user: PublicUser = Depends(_get_public_user),
    db: AsyncSession = Depends(get_db),
):
    """Flash deals y eventos de las tiendas que sigue el usuario."""
    followers_r = await db.execute(
        select(StoreFollower).where(StoreFollower.public_user_id == user.id)
    )
    store_ids = [f.store_id for f in followers_r.scalars().all()]
    if not store_ids:
        return {"flash_deals": [], "events": []}

    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)

    # Flash deals activos
    deals_r = await db.execute(
        select(FlashDeal, Store)
        .join(Store, FlashDeal.store_id == Store.id)
        .where(
            FlashDeal.store_id.in_(store_ids),
            FlashDeal.is_active.is_(True),
            FlashDeal.expires_at > now_naive,
        )
        .order_by(FlashDeal.expires_at)
        .limit(50)
    )

    flash_deals = [
        {
            "id": deal.id,
            "store_name": store.name,
            "store_slug": store.slug,
            "store_logo": _store_logo(store),
            "title": deal.title,
            "discount_percent": deal.discount_percent,
            "original_price_cents": deal.original_price_cents,
            "slot_start_time": deal.slot_start_time.isoformat(),
            "slot_end_time": deal.slot_end_time.isoformat(),
            "expires_at": deal.expires_at.isoformat(),
        }
        for deal, store in deals_r.all()
    ]

    # Eventos próximos
    events_r = await db.execute(
        select(StoreEvent, Store)
        .join(Store, StoreEvent.store_id == Store.id)
        .where(
            StoreEvent.store_id.in_(store_ids),
            StoreEvent.is_active.is_(True),
            StoreEvent.event_date >= now_naive,
        )
        .order_by(StoreEvent.event_date)
        .limit(30)
    )

    # Get user's RSVPs
    rsvp_r = await db.execute(
        select(EventRSVP).where(EventRSVP.public_user_id == user.id)
    )
    rsvps_by_event = {r.event_id: r.status for r in rsvp_r.scalars().all()}

    events = [
        {
            "id": event.id,
            "store_name": store.name,
            "store_slug": store.slug,
            "store_logo": _store_logo(store),
            "title": event.title,
            "description": event.description,
            "event_date": event.event_date.isoformat(),
            "location_text": event.location_text,
            "image_url": event.image_url,
            "rsvp_status": rsvps_by_event.get(event.id),
        }
        for event, store in events_r.all()
    ]

    return {"flash_deals": flash_deals, "events": events}


@router.post("/events/{event_id}/rsvp")
async def rsvp_event(
    event_id: str,
    body: RSVPIn,
    user: PublicUser = Depends(_get_public_user),
    db: AsyncSession = Depends(get_db),
):
    """Aceptar o rechazar invitación a evento."""
    event_r = await db.execute(
        select(StoreEvent).where(StoreEvent.id == event_id, StoreEvent.is_active.is_(True))
    )
    event = event_r.scalar_one_or_none()
    if not event:
        raise HTTPException(404, "Evento no encontrado")

    existing_r = await db.execute(
        select(EventRSVP).where(
            EventRSVP.event_id == event_id,
            EventRSVP.public_user_id == user.id,
        )
    )
    existing = existing_r.scalar_one_or_none()
    if existing:
        existing.status = body.status
    else:
        db.add(EventRSVP(event_id=event_id, public_user_id=user.id, status=body.status))
    await db.commit()
    return {"message": f"RSVP actualizado: {body.status}"}
