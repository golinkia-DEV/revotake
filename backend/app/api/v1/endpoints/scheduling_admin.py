"""Panel: sucursales, profesionales, servicios, citas, métricas, export."""
import csv
import io
import re
import secrets
import random
from urllib.parse import quote
from datetime import date, datetime, time, timedelta
from typing import Optional, Literal, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from sqlalchemy import select, func, delete, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import StoreContext, ensure_branch_in_scope, require_store_admin, require_store_permission
from app.core.permissions import (
    CREAR_CITA,
    EDITAR_CITA,
    EXPORTAR_REGISTROS,
    VER_AGENDA_TIENDA,
    VER_CATALOGO_AGENDA,
    VER_FICHAS,
    CREAR_FICHAS,
    VER_REPORTES,
    VER_REPORTES_PAGOS,
)
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user
from app.models.client import Client
from app.models.product import Product
from app.models.store import Store, StoreMember
from app.models.client_document import ClientDocument
from app.services.mail import send_html_email, mail_configured
from app.models.ticket import Ticket, TicketStatus
from app.models.scheduling import (
    Branch,
    Professional,
    ProfessionalBranch,
    ProfessionalService,
    Service,
    AvailabilityRule,
    AvailabilityRuleType,
    Holiday,
    Appointment,
    AppointmentStatus,
    PaymentMode,
    PaymentStatus,
    AppointmentAuditLog,
    AppointmentReview,
    PaymentAttempt,
    PaymentAttemptStatus,
    WaitlistEntry,
    WorkStation,
)
from app.services.scheduling_availability import compute_slots
from app.services.scheduling_booking import create_appointment_booking, schedule_reminder_jobs
from app.services.work_stations import (
    normalize_professional_branch_station,
    seed_work_stations_from_store_settings,
    station_time_free,
)
from app.services.scheduling_audit import log_appointment_action

router = APIRouter()


def _slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return (s.strip("-") or "item")[:80]


# --- Branches ---


class BranchCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    slug: Optional[str] = None
    timezone: str = "America/Santiago"
    region: Optional[str] = Field(None, max_length=200)
    comuna: Optional[str] = Field(None, max_length=120)
    address_line: Optional[str] = None


class BranchPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    slug: Optional[str] = None
    timezone: Optional[str] = None
    region: Optional[str] = Field(None, max_length=200)
    comuna: Optional[str] = Field(None, max_length=120)
    address_line: Optional[str] = None
    is_active: Optional[bool] = None


def _branch_out(b: Branch) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "slug": b.slug,
        "timezone": b.timezone,
        "region": b.region,
        "comuna": b.comuna,
        "address_line": b.address_line,
        "is_active": b.is_active,
    }


@router.get("/branches")
async def list_branches(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
):
    r = await db.execute(select(Branch).where(Branch.store_id == ctx.store_id).order_by(Branch.name))
    rows = r.scalars().all()
    return {"items": [_branch_out(b) for b in rows]}


@router.post("/branches")
async def create_branch(
    data: BranchCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    slug = _slugify(data.slug or data.name)
    dup = await db.execute(
        select(Branch.id).where(Branch.store_id == ctx.store_id, Branch.slug == slug)
    )
    if dup.scalar_one_or_none():
        raise HTTPException(400, "Ya existe una sede con ese identificador (slug)")
    b = Branch(
        store_id=ctx.store_id,
        name=data.name.strip(),
        slug=slug,
        timezone=data.timezone or "America/Santiago",
        region=(data.region or "").strip() or None,
        comuna=(data.comuna or "").strip() or None,
        address_line=(data.address_line or "").strip() or None,
    )
    db.add(b)
    await db.flush()
    store_row = await db.get(Store, ctx.store_id)
    await seed_work_stations_from_store_settings(
        db,
        store_id=ctx.store_id,
        branch_id=b.id,
        store_settings=store_row.settings if store_row else None,
    )
    return {"id": b.id, "slug": b.slug}


def _station_out(ws: WorkStation) -> dict[str, Any]:
    return {
        "id": ws.id,
        "branch_id": ws.branch_id,
        "name": ws.name,
        "kind": ws.kind,
        "sort_order": ws.sort_order,
        "is_active": ws.is_active,
    }


class WorkStationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    kind: Literal["chair", "room", "other"] = "chair"
    sort_order: int = 0


class WorkStationPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    kind: Optional[Literal["chair", "room", "other"]] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/branches/{branch_id}/stations")
async def list_branch_stations(
    branch_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
):
    ensure_branch_in_scope(ctx, branch_id)
    br = await db.get(Branch, branch_id)
    if not br or br.store_id != ctx.store_id:
        raise HTTPException(404, "Sede no encontrada")
    r = await db.execute(
        select(WorkStation)
        .where(WorkStation.branch_id == branch_id)
        .order_by(WorkStation.sort_order, WorkStation.name)
    )
    return {"items": [_station_out(s) for s in r.scalars().all()]}


@router.get("/branches/{branch_id}/stations/occupancy")
async def branch_stations_occupancy(
    branch_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_TIENDA)),
    at: Optional[datetime] = Query(None, description="Instante UTC; por defecto ahora"),
):
    ensure_branch_in_scope(ctx, branch_id)
    br = await db.get(Branch, branch_id)
    if not br or br.store_id != ctx.store_id:
        raise HTTPException(404, "Sede no encontrada")
    now = at or datetime.utcnow()
    r_st = await db.execute(
        select(WorkStation)
        .where(WorkStation.branch_id == branch_id, WorkStation.is_active.is_(True))
        .order_by(WorkStation.sort_order, WorkStation.name)
    )
    stations = r_st.scalars().all()
    active_status = (
        AppointmentStatus.CONFIRMED.value,
        AppointmentStatus.PENDING_PAYMENT.value,
        AppointmentStatus.COMPLETED.value,
    )
    out = []
    for st in stations:
        q = (
            select(Appointment, Client.name, Professional.name)
            .outerjoin(Client, Client.id == Appointment.client_id)
            .outerjoin(Professional, Professional.id == Appointment.professional_id)
            .where(
                Appointment.station_id == st.id,
                Appointment.status.in_(active_status),
                Appointment.start_time <= now,
                Appointment.end_time > now,
            )
            .limit(1)
        )
        row = (await db.execute(q)).first()
        busy = row is not None
        occ = None
        if row:
            ap, cname, pname = row[0], row[1], row[2]
            occ = {
                "appointment_id": ap.id,
                "client_name": (cname or "").strip() or "—",
                "professional_name": (pname or "").strip() or "—",
                "start_time": ap.start_time.isoformat(),
                "end_time": ap.end_time.isoformat(),
            }
        out.append({**_station_out(st), "busy": busy, "current": occ})
    total = len(out)
    busy_n = sum(1 for x in out if x["busy"])
    return {
        "at": now.isoformat(),
        "branch_id": branch_id,
        "total": total,
        "occupied": busy_n,
        "available": total - busy_n,
        "stations": out,
    }


@router.post("/branches/{branch_id}/stations")
async def create_branch_station(
    branch_id: str,
    data: WorkStationCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    ensure_branch_in_scope(ctx, branch_id)
    br = await db.get(Branch, branch_id)
    if not br or br.store_id != ctx.store_id:
        raise HTTPException(404, "Sede no encontrada")
    ws = WorkStation(
        store_id=ctx.store_id,
        branch_id=branch_id,
        name=data.name.strip(),
        kind=data.kind,
        sort_order=data.sort_order,
        is_active=True,
    )
    db.add(ws)
    await db.flush()
    return _station_out(ws)


@router.patch("/stations/{station_id}")
async def patch_station(
    station_id: str,
    data: WorkStationPatch,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    ws = await db.get(WorkStation, station_id)
    if not ws or ws.store_id != ctx.store_id:
        raise HTTPException(404, "Puesto no encontrado")
    if data.name is not None:
        ws.name = data.name.strip()
    if data.kind is not None:
        ws.kind = data.kind
    if data.sort_order is not None:
        ws.sort_order = data.sort_order
    if data.is_active is not None:
        ws.is_active = data.is_active
    await db.flush()
    return _station_out(ws)


@router.patch("/branches/{branch_id}")
async def patch_branch(
    branch_id: str,
    data: BranchPatch,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    b = await db.get(Branch, branch_id)
    if not b or b.store_id != ctx.store_id:
        raise HTTPException(404, "Sede no encontrada")
    if data.name is not None:
        b.name = data.name.strip()
    if data.slug is not None:
        new_slug = _slugify(data.slug)
        dup = await db.execute(
            select(Branch.id).where(
                Branch.store_id == ctx.store_id,
                Branch.slug == new_slug,
                Branch.id != branch_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(400, "Ya existe otra sede con ese identificador (slug)")
        b.slug = new_slug
    if data.timezone is not None:
        b.timezone = data.timezone.strip() or "America/Santiago"
    if data.region is not None:
        b.region = data.region.strip() or None
    if data.comuna is not None:
        b.comuna = data.comuna.strip() or None
    if data.address_line is not None:
        b.address_line = data.address_line.strip() or None
    if data.is_active is not None:
        b.is_active = data.is_active
    await db.flush()
    return _branch_out(b)


# --- Professionals ---


class ProfessionalCreate(BaseModel):
    name: str
    first_name: str
    paternal_last_name: str
    maternal_last_name: str
    birth_date: str
    hire_date: str
    address: str
    email: EmailStr
    phone: str = Field(..., min_length=6, max_length=40)
    branch_ids: list[str] = Field(default_factory=list)
    service_ids: list[str] = Field(default_factory=list)
    # Porcentaje 0–100 por cada servicio asignado (clave = service_id)
    service_commissions: dict[str, float] = Field(default_factory=dict)
    # Un solo % para comisión sobre productos (inventario); null = sin comisión en productos
    product_commission_percent: Optional[float] = Field(None, ge=0, le=100)
    # Por sede: mismo modo para todas; fixed requiere default_station_id en esa sede
    station_mode: Literal["none", "fixed", "dynamic"] = "none"
    default_station_id: Optional[str] = None
    invite_member_role: Literal["worker", "branch_operator", "branch_admin"] = "worker"
    worker_role: Optional[str] = Field(None, max_length=80)


@router.get("/professionals")
async def list_professionals(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
):
    r = await db.execute(
        select(Professional).where(Professional.store_id == ctx.store_id).order_by(Professional.name)
    )
    rows = r.scalars().all()
    pids = [p.id for p in rows]
    comm_by_pro: dict[str, dict[str, float]] = {pid: {} for pid in pids}
    links_by_pro: dict[str, list[dict[str, Any]]] = {pid: [] for pid in pids}
    if pids:
        psq = await db.execute(select(ProfessionalService).where(ProfessionalService.professional_id.in_(pids)))
        for ps in psq.scalars().all():
            comm_by_pro.setdefault(ps.professional_id, {})[ps.service_id] = float(ps.commission_percent or 0)
        pbq = await db.execute(select(ProfessionalBranch).where(ProfessionalBranch.professional_id.in_(pids)))
        for pb in pbq.scalars().all():
            links_by_pro.setdefault(pb.professional_id, []).append(
                {
                    "branch_id": pb.branch_id,
                    "station_mode": pb.station_mode or "none",
                    "default_station_id": pb.default_station_id,
                }
            )
    out = []
    for p in rows:
        bids = [x["branch_id"] for x in links_by_pro.get(p.id, [])]
        out.append(
            {
                "id": p.id,
                "name": p.name,
                "first_name": p.first_name,
                "paternal_last_name": p.paternal_last_name,
                "maternal_last_name": p.maternal_last_name,
                "birth_date": p.birth_date,
                "hire_date": p.hire_date,
                "address": p.address,
                "email": p.email,
                "phone": p.phone,
                "user_id": p.user_id,
                "branch_ids": bids,
                "branch_links": links_by_pro.get(p.id, []),
                "invite_pending": bool(p.invite_token and not p.user_id),
                "product_commission_percent": p.product_commission_percent,
                "service_commissions": comm_by_pro.get(p.id, {}),
            }
        )
    return {"items": out}


@router.post("/professionals")
async def create_professional(
    data: ProfessionalCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    normalized_inviter = ctx.member_role_normalized
    invite_role = data.invite_member_role
    if normalized_inviter != "store_admin" and invite_role != "worker":
        raise HTTPException(403, "Tu rol solo puede invitar trabajadores")
    if not data.branch_ids:
        raise HTTPException(400, "Indica al menos una sede donde atiende el profesional")
    if not data.service_ids:
        raise HTTPException(400, "Indica al menos un servicio que realiza el profesional")
    email_norm = str(data.email).strip().lower()
    phone_norm = data.phone.strip()

    ex_user = await db.execute(select(User.id).where(User.email == email_norm))
    if ex_user.scalar_one_or_none():
        raise HTTPException(400, "Ya existe un usuario con ese correo")

    pend = await db.execute(
        select(Professional.id).where(
            Professional.store_id == ctx.store_id,
            Professional.email == email_norm,
            Professional.user_id.is_(None),
            Professional.invite_token.isnot(None),
        )
    )
    if pend.scalar_one_or_none():
        raise HTTPException(400, "Ya hay una invitación pendiente para este correo en la tienda")

    comm = {k: float(v) for k, v in data.service_commissions.items()}
    for sid in data.service_ids:
        comm.setdefault(sid, 0.0)
    for sid, pct in comm.items():
        if sid not in data.service_ids:
            continue
        if pct < 0 or pct > 100:
            raise HTTPException(400, "Cada comisión de servicio debe estar entre 0 y 100")

    token = secrets.token_urlsafe(36)[:64]
    exp = datetime.utcnow() + timedelta(days=7)

    p = Professional(
        store_id=ctx.store_id,
        name=data.name.strip(),
        first_name=data.first_name.strip(),
        paternal_last_name=data.paternal_last_name.strip(),
        maternal_last_name=data.maternal_last_name.strip(),
        birth_date=data.birth_date.strip(),
        hire_date=data.hire_date.strip(),
        address=data.address.strip(),
        email=email_norm,
        phone=phone_norm,
        user_id=None,
        invite_token=token,
        invite_expires_at=exp,
        invite_member_role=invite_role,
        invite_branch_ids=list(data.branch_ids),
        invite_worker_role=(data.worker_role or "").strip() or None,
        product_commission_percent=data.product_commission_percent,
    )
    db.add(p)
    await db.flush()
    for i, bid in enumerate(data.branch_ids):
        br = await db.get(Branch, bid)
        if not br or br.store_id != ctx.store_id:
            raise HTTPException(400, "Sucursal inválida")
        sm, ssid = await normalize_professional_branch_station(
            db,
            branch_id=bid,
            station_mode=data.station_mode,
            default_station_id=data.default_station_id,
        )
        db.add(
            ProfessionalBranch(
                professional_id=p.id,
                branch_id=bid,
                is_primary=(len(data.branch_ids) == 1 or i == 0),
                station_mode=sm,
                default_station_id=ssid,
            )
        )
    for sid in data.service_ids:
        sv = await db.get(Service, sid)
        if not sv or sv.store_id != ctx.store_id:
            raise HTTPException(400, "Servicio inválido")
        dup = await db.execute(
            select(ProfessionalService.id).where(
                ProfessionalService.professional_id == p.id,
                ProfessionalService.service_id == sid,
            )
        )
        if dup.scalar_one_or_none() is None:
            db.add(
                ProfessionalService(
                    professional_id=p.id,
                    service_id=sv.id,
                    commission_percent=comm.get(sid, 0.0),
                )
            )
    base = (settings.FRONTEND_URL or "http://localhost:3000").rstrip("/")
    link = f"{base}/profesional/activar?token={quote(token, safe='')}"
    subject = "Activá tu acceso en RevoTake"
    html = f"""<p>Hola {p.name},</p>
<p>Te dieron de alta como profesional. Para crear tu contraseña y acceder al panel, abrí este enlace (válido 7 días):</p>
<p><a href="{link}">{link}</a></p>
<p>Si no solicitaste esto, ignorá el mensaje.</p>"""
    if not mail_configured():
        raise HTTPException(
            503,
            "Correo no configurado: definí RESEND_API_KEY + RESEND_FROM_EMAIL (Resend) o SMTP_USER/SMTP_PASSWORD.",
        )
    sent = send_html_email(email_norm, subject, html)
    if not sent:
        raise HTTPException(
            502,
            "No se pudo enviar el correo de invitación. Revisá Resend (API key / dominio) o SMTP e intentá de nuevo.",
        )
    return {"id": p.id, "invite_sent": True, "invite_expires_at": exp.isoformat()}


class ProfessionalPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    branch_ids: Optional[list[str]] = None
    user_id: Optional[str] = None  # null o vacío = desvincular; debe ser miembro de la tienda
    station_mode: Optional[Literal["none", "fixed", "dynamic"]] = None
    default_station_id: Optional[str] = None


@router.patch("/professionals/{professional_id}")
async def patch_professional(
    professional_id: str,
    data: ProfessionalPatch,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    p = await db.get(Professional, professional_id)
    if not p or p.store_id != ctx.store_id:
        raise HTTPException(404, "No encontrado")
    if data.name is not None:
        p.name = data.name.strip()
    if data.branch_ids is not None:
        if len(data.branch_ids) == 0:
            raise HTTPException(400, "Debe quedar al menos una sede asignada")
        prev_pb = (
            await db.execute(select(ProfessionalBranch).where(ProfessionalBranch.professional_id == p.id))
        ).scalars().all()
        prev_by_branch = {x.branch_id: (x.station_mode or "none", x.default_station_id) for x in prev_pb}
        await db.execute(delete(ProfessionalBranch).where(ProfessionalBranch.professional_id == p.id))
        for i, bid in enumerate(data.branch_ids):
            br = await db.get(Branch, bid)
            if not br or br.store_id != ctx.store_id:
                raise HTTPException(400, "Sucursal inválida")
            prev = prev_by_branch.get(bid)
            mode_in = data.station_mode if data.station_mode is not None else (prev[0] if prev else "none")
            sid_in = data.default_station_id if data.default_station_id is not None else (prev[1] if prev else None)
            sm, ssid = await normalize_professional_branch_station(
                db,
                branch_id=bid,
                station_mode=mode_in,
                default_station_id=sid_in,
            )
            db.add(
                ProfessionalBranch(
                    professional_id=p.id,
                    branch_id=bid,
                    is_primary=(len(data.branch_ids) == 1 or i == 0),
                    station_mode=sm,
                    default_station_id=ssid,
                )
            )
    elif data.station_mode is not None or data.default_station_id is not None:
        pbs = await db.execute(select(ProfessionalBranch).where(ProfessionalBranch.professional_id == p.id))
        for pb in pbs.scalars().all():
            mode = data.station_mode if data.station_mode is not None else pb.station_mode
            sid = data.default_station_id if data.default_station_id is not None else pb.default_station_id
            sm, ssid = await normalize_professional_branch_station(
                db, branch_id=pb.branch_id, station_mode=mode, default_station_id=sid
            )
            pb.station_mode = sm
            pb.default_station_id = ssid
    raw = data.model_dump(exclude_unset=True)
    if "user_id" in raw:
        uid = raw["user_id"]
        if uid is None or (isinstance(uid, str) and uid.strip() == ""):
            p.user_id = None
        else:
            u = await db.get(User, uid)
            if not u:
                raise HTTPException(400, "Usuario no encontrado")
            sm = await db.execute(
                select(StoreMember).where(
                    StoreMember.user_id == uid,
                    StoreMember.store_id == ctx.store_id,
                )
            )
            if sm.scalar_one_or_none() is None:
                raise HTTPException(
                    400,
                    "El usuario debe ser miembro de esta tienda (invítalo antes en la tienda).",
                )
            p.user_id = uid
            p.invite_token = None
            p.invite_expires_at = None
    return {"id": p.id, "user_id": p.user_id}


# --- Services ---


class ServiceCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    category: Optional[str] = None
    menu_sort_order: int = 0
    description: Optional[str] = None
    duration_minutes: int = 30
    buffer_before_minutes: int = 0
    buffer_after_minutes: int = 0
    price_cents: int = 0
    currency: str = "CLP"
    product_id: Optional[str] = None
    allow_price_override: bool = True
    cancellation_hours: int = 24
    cancellation_fee_cents: int = 0
    deposit_required_cents: int = 0
    suggest_rebooking_days: int = 0
    intake_form_schema: Optional[list] = None
    image_urls: Optional[list[str]] = None

    @field_validator("image_urls")
    @classmethod
    def _validate_image_urls_create(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None and len(v) > 5:
            raise ValueError("Máximo 5 imágenes por servicio")
        return v


@router.get("/services")
async def list_services(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
):
    r = await db.execute(
        select(Service)
        .where(Service.store_id == ctx.store_id)
        .order_by(func.coalesce(Service.category, "").asc(), Service.menu_sort_order, Service.name)
    )
    rows = r.scalars().all()
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
                "buffer_before_minutes": s.buffer_before_minutes,
                "buffer_after_minutes": s.buffer_after_minutes,
                "price_cents": s.price_cents,
                "currency": s.currency,
                "product_id": s.product_id,
                "allow_price_override": s.allow_price_override,
                "cancellation_hours": s.cancellation_hours,
                "cancellation_fee_cents": s.cancellation_fee_cents,
                "deposit_required_cents": s.deposit_required_cents,
                "suggest_rebooking_days": s.suggest_rebooking_days,
                "intake_form_schema": s.intake_form_schema or [],
                "image_urls": list(s.image_urls) if isinstance(s.image_urls, list) else [],
                "is_active": s.is_active,
            }
            for s in rows
        ]
    }


@router.post("/services")
async def create_service(
    data: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    slug = _slugify(data.slug or data.name)
    pid = data.product_id
    if pid:
        pr = await db.get(Product, pid)
        if not pr or pr.store_id != ctx.store_id:
            raise HTTPException(400, "Producto no pertenece a esta tienda")
    cat = (data.category or "").strip() or None
    s = Service(
        store_id=ctx.store_id,
        name=data.name.strip(),
        slug=slug,
        category=cat,
        menu_sort_order=data.menu_sort_order,
        description=data.description,
        duration_minutes=data.duration_minutes,
        buffer_before_minutes=data.buffer_before_minutes,
        buffer_after_minutes=data.buffer_after_minutes,
        price_cents=data.price_cents,
        currency=data.currency,
        product_id=pid,
        allow_price_override=data.allow_price_override,
        cancellation_hours=data.cancellation_hours,
        cancellation_fee_cents=data.cancellation_fee_cents,
        deposit_required_cents=data.deposit_required_cents,
        suggest_rebooking_days=data.suggest_rebooking_days,
        intake_form_schema=data.intake_form_schema,
        image_urls=list(data.image_urls)[:5] if data.image_urls else [],
    )
    db.add(s)
    await db.flush()
    return {"id": s.id, "slug": s.slug}


class ServiceDescriptionSuggest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = None
    duration_minutes: Optional[int] = None
    price_cents: Optional[int] = None
    currency: str = "CLP"


@router.post("/services/suggest-description")
async def suggest_service_description(
    data: ServiceDescriptionSuggest,
    ctx: StoreContext = Depends(require_store_admin),
):
    """Genera una descripción breve para la ficha del servicio (reserva pública). Requiere ANTHROPIC_API_KEY."""
    from app.core.config import settings
    import anthropic

    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, "Configurá ANTHROPIC_API_KEY en el servidor para usar la IA")
    st = ctx.store.settings or {}
    ai_cfg = st.get("ai") or {}
    business_ctx = (ai_cfg.get("business_context") or "").strip()[:3000]
    store_name = ctx.store.name or "la tienda"
    cat = (data.category or "").strip() or "sin categoría específica"
    dur = f"{data.duration_minutes} minutos" if data.duration_minutes else "duración no indicada"
    if data.price_cents is not None and data.price_cents > 0:
        price_txt = f"{data.price_cents / 100:.0f} {data.currency}"
    elif data.price_cents == 0:
        price_txt = "gratis o sin cargo indicado"
    else:
        price_txt = "precio no indicado"
    user_prompt = (
        f"Nombre del servicio: {data.name.strip()}\n"
        f"Categoría del menú: {cat}\n"
        f"Duración: {dur}\n"
        f"Precio: {price_txt}\n\n"
        "Redactá SOLO el texto de la descripción, sin títulos ni comillas."
    )
    system = f"""Eres redactor para fichas de reserva online de «{store_name}».
Escribís descripciones breves en español (Chile/latino neutro): claras, amables y sin exagerar beneficios médicos o legales.
Máximo 350 caracteres. Sin markdown, sin emojis, sin listas con viñetas. Uno o dos párrafos cortos o un solo párrafo.
Si hay contexto del negocio, podés alinear el tono (sin inventar servicios que no fueron pedidos).

Contexto del negocio (puede estar vacío):
{business_ctx or "(no configurado)"}"""
    client_sdk = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client_sdk.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=400,
        system=system,
        messages=[{"role": "user", "content": user_prompt}],
    )
    text = (response.content[0].text if response.content else "").strip()
    if len(text) > 600:
        text = text[:597] + "..."
    return {"description": text}


class ServicePatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    category: Optional[str] = None
    menu_sort_order: Optional[int] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    buffer_before_minutes: Optional[int] = None
    buffer_after_minutes: Optional[int] = None
    price_cents: Optional[int] = None
    currency: Optional[str] = None
    product_id: Optional[str] = None
    allow_price_override: Optional[bool] = None
    cancellation_hours: Optional[int] = None
    cancellation_fee_cents: Optional[int] = None
    deposit_required_cents: Optional[int] = None
    suggest_rebooking_days: Optional[int] = None
    intake_form_schema: Optional[list] = None
    image_urls: Optional[list[str]] = None
    is_active: Optional[bool] = None

    @field_validator("image_urls")
    @classmethod
    def _validate_image_urls_patch(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None and len(v) > 5:
            raise ValueError("Máximo 5 imágenes por servicio")
        return v


@router.patch("/services/{service_id}")
async def patch_service(
    service_id: str,
    data: ServicePatch,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    s = await db.get(Service, service_id)
    if not s or s.store_id != ctx.store_id:
        raise HTTPException(404, "No encontrado")
    raw = data.model_dump(exclude_unset=True)
    if "category" in raw:
        c = raw.pop("category")
        if c is None:
            s.category = None
        else:
            s.category = str(c).strip() or None
    if "product_id" in raw:
        pid = raw["product_id"]
        if pid is None or pid == "":
            s.product_id = None
        else:
            pr = await db.get(Product, pid)
            if not pr or pr.store_id != ctx.store_id:
                raise HTTPException(400, "Producto inválido")
            s.product_id = pid
        del raw["product_id"]
    for k, v in raw.items():
        setattr(s, k, v)
    return {"id": s.id}


class LinkProfService(BaseModel):
    professional_id: str
    service_id: str


@router.post("/professional-services")
async def link_professional_service(
    data: LinkProfService,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    pr = await db.get(Professional, data.professional_id)
    sv = await db.get(Service, data.service_id)
    if not pr or pr.store_id != ctx.store_id or not sv or sv.store_id != ctx.store_id:
        raise HTTPException(400, "Datos inválidos")
    db.add(ProfessionalService(professional_id=pr.id, service_id=sv.id))
    return {"ok": True}


# --- Availability ---


class AvailabilityRuleCreate(BaseModel):
    professional_id: str
    branch_id: str
    rule_type: Literal["weekly", "exception"] = "weekly"
    weekday: Optional[int] = Field(None, ge=0, le=6)
    specific_date: Optional[date] = None
    start_time: Optional[str] = None  # "09:00"
    end_time: Optional[str] = None
    is_closed: bool = False


def _parse_hhmm(s: Optional[str]) -> Optional[time]:
    if not s:
        return None
    parts = s.split(":")
    h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
    return time(hour=h, minute=m)


@router.post("/availability-rules")
async def create_availability_rule(
    data: AvailabilityRuleCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    pr = await db.get(Professional, data.professional_id)
    br = await db.get(Branch, data.branch_id)
    if not pr or pr.store_id != ctx.store_id or not br or br.store_id != ctx.store_id:
        raise HTTPException(400, "Profesional o sucursal inválidos")
    rt = (
        AvailabilityRuleType.WEEKLY.value
        if data.rule_type == "weekly"
        else AvailabilityRuleType.EXCEPTION.value
    )
    rule = AvailabilityRule(
        professional_id=pr.id,
        branch_id=br.id,
        rule_type=rt,
        weekday=data.weekday if rt == AvailabilityRuleType.WEEKLY.value else None,
        specific_date=data.specific_date if rt == AvailabilityRuleType.EXCEPTION.value else None,
        start_time=_parse_hhmm(data.start_time),
        end_time=_parse_hhmm(data.end_time),
        is_closed=data.is_closed,
    )
    db.add(rule)
    await db.flush()
    return {"id": rule.id}


@router.get("/availability-rules")
async def list_availability_rules(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
    professional_id: Optional[str] = None,
    branch_id: Optional[str] = None,
):
    q = (
        select(AvailabilityRule)
        .join(Professional, Professional.id == AvailabilityRule.professional_id)
        .where(Professional.store_id == ctx.store_id)
    )
    if professional_id:
        q = q.where(AvailabilityRule.professional_id == professional_id)
    if branch_id:
        ensure_branch_in_scope(ctx, branch_id)
        q = q.where(AvailabilityRule.branch_id == branch_id)
    r = await db.execute(q)
    rows = r.scalars().all()
    out = []
    for x in rows:
        out.append(
            {
                "id": x.id,
                "professional_id": x.professional_id,
                "branch_id": x.branch_id,
                "rule_type": x.rule_type,
                "weekday": x.weekday,
                "specific_date": x.specific_date.isoformat() if x.specific_date else None,
                "start_time": x.start_time.strftime("%H:%M") if x.start_time else None,
                "end_time": x.end_time.strftime("%H:%M") if x.end_time else None,
                "is_closed": x.is_closed,
            }
        )
    return {"items": out}


# --- Holidays ---


class HolidayCreate(BaseModel):
    name: str
    holiday_date: date
    branch_id: Optional[str] = None


@router.post("/holidays")
async def create_holiday(
    data: HolidayCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    if data.branch_id:
        br = await db.get(Branch, data.branch_id)
        if not br or br.store_id != ctx.store_id:
            raise HTTPException(400, "Sucursal inválida")
    h = Holiday(
        store_id=ctx.store_id,
        branch_id=data.branch_id,
        name=data.name.strip(),
        holiday_date=data.holiday_date,
    )
    db.add(h)
    await db.flush()
    return {"id": h.id}


@router.get("/holidays")
async def list_holidays(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
):
    r = await db.execute(select(Holiday).where(Holiday.store_id == ctx.store_id).order_by(Holiday.holiday_date))
    rows = r.scalars().all()
    return {
        "items": [
            {
                "id": h.id,
                "name": h.name,
                "holiday_date": h.holiday_date.isoformat(),
                "branch_id": h.branch_id,
            }
            for h in rows
        ]
    }


# --- Slots (admin) ---


@router.get("/slots")
async def admin_slots(
    branch_id: str,
    professional_id: str,
    service_id: str,
    on_date: date,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
):
    ensure_branch_in_scope(ctx, branch_id)
    slots = await compute_slots(
        db,
        store_id=ctx.store_id,
        branch_id=branch_id,
        professional_id=professional_id,
        service_id=service_id,
        on_date=on_date,
    )
    return {"slots": slots}


# --- Appointments ---


class AdminAppointmentCreate(BaseModel):
    branch_id: str
    professional_id: str
    service_id: str
    client_id: Optional[str] = None
    start_time: datetime
    payment_mode: str = PaymentMode.ON_SITE.value
    notes: Optional[str] = None


@router.get("/appointments")
async def list_appointments(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_TIENDA)),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    professional_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    status: Optional[str] = None,
):
    q = (
        select(
            Appointment,
            Service.price_cents,
            Service.allow_price_override,
            Service.name,
            WorkStation.name,
            Client.name,
            Professional.name,
        )
        .outerjoin(Service, Service.id == Appointment.service_id)
        .outerjoin(WorkStation, WorkStation.id == Appointment.station_id)
        .outerjoin(Client, Client.id == Appointment.client_id)
        .outerjoin(Professional, Professional.id == Appointment.professional_id)
        .where(Appointment.store_id == ctx.store_id)
        .order_by(Appointment.start_time)
    )
    if from_date:
        q = q.where(Appointment.start_time >= datetime(from_date.year, from_date.month, from_date.day))
    if to_date:
        end = datetime(to_date.year, to_date.month, to_date.day) + timedelta(days=1)
        q = q.where(Appointment.start_time < end)
    if professional_id:
        q = q.where(Appointment.professional_id == professional_id)
    if branch_id:
        ensure_branch_in_scope(ctx, branch_id)
        q = q.where(Appointment.branch_id == branch_id)
    elif ctx.branch_scope:
        q = q.where(Appointment.branch_id.in_(list(ctx.branch_scope)))
    if status:
        q = q.where(Appointment.status == status)
    r = await db.execute(q)
    out = []
    for row in r.all():
        a, price_c, allow_po, svc_name, st_name, client_name, pro_name = row
        out.append(
            {
                "id": a.id,
                "branch_id": a.branch_id,
                "professional_id": a.professional_id,
                "professional_name": pro_name or "",
                "service_id": a.service_id,
                "service_name": svc_name or "",
                "client_id": a.client_id,
                "client_name": client_name or "",
                "station_id": a.station_id,
                "station_name": st_name or "",
                "start_time": a.start_time.isoformat(),
                "end_time": a.end_time.isoformat(),
                "status": a.status,
                "payment_mode": a.payment_mode,
                "payment_status": a.payment_status,
                "manage_token": a.manage_token,
                "ticket_id": a.ticket_id,
                "charged_price_cents": a.charged_price_cents,
                "session_closed_at": a.session_closed_at.isoformat() if a.session_closed_at else None,
                "service_price_cents": int(price_c) if price_c is not None else None,
                "allow_price_override": True if allow_po is None else bool(allow_po),
            }
        )
    return {"items": out}


@router.get("/recommend-slots")
async def recommend_slots(
    branch_id: str,
    service_id: str,
    on_date: date,
    preferred_time: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(CREAR_CITA, VER_AGENDA_TIENDA)),
):
    """Recomienda horarios con distribución justa entre trabajadoras disponibles."""
    ensure_branch_in_scope(ctx, branch_id)
    branch = await db.get(Branch, branch_id)
    if not branch or branch.store_id != ctx.store_id:
        raise HTTPException(404, "Sede no encontrada")

    pro_rows = await db.execute(
        select(Professional.id, Professional.name)
        .join(ProfessionalBranch, ProfessionalBranch.professional_id == Professional.id)
        .join(ProfessionalService, ProfessionalService.professional_id == Professional.id)
        .where(
            Professional.store_id == ctx.store_id,
            Professional.is_active.is_(True),
            ProfessionalBranch.branch_id == branch_id,
            ProfessionalService.service_id == service_id,
        )
        .distinct()
    )
    professionals = pro_rows.all()
    if not professionals:
        return {"items": []}

    preferred_min = None
    if preferred_time and ":" in preferred_time:
        hh, mm = preferred_time.split(":", 1)
        preferred_min = int(hh) * 60 + int(mm)

    day_start = datetime(on_date.year, on_date.month, on_date.day)
    day_end = day_start + timedelta(days=1)
    load_rows = await db.execute(
        select(Appointment.professional_id, func.count(Appointment.id))
        .where(
            Appointment.store_id == ctx.store_id,
            Appointment.branch_id == branch_id,
            Appointment.start_time >= day_start,
            Appointment.start_time < day_end,
            Appointment.status != AppointmentStatus.CANCELLED.value,
        )
        .group_by(Appointment.professional_id)
    )
    load_by_prof = {pid: int(cnt or 0) for pid, cnt in load_rows.all()}

    recommendations: list[dict[str, Any]] = []
    for pid, pname in professionals:
        slots = await compute_slots(
            db,
            store_id=ctx.store_id,
            branch_id=branch_id,
            professional_id=pid,
            service_id=service_id,
            on_date=on_date,
        )
        if preferred_min is not None:
            filtered = []
            for s in slots:
                dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
                if dt.hour * 60 + dt.minute >= preferred_min:
                    filtered.append(s)
            slots = filtered
        if not slots:
            continue
        recommendations.append(
            {
                "professional_id": pid,
                "professional_name": pname,
                "workload_today": load_by_prof.get(pid, 0),
                "start_time": slots[0],
            }
        )

    if not recommendations:
        return {"items": []}

    # Justo: menor carga primero; empate aleatorio para no priorizar siempre a la misma persona.
    random.shuffle(recommendations)
    recommendations.sort(key=lambda x: (x["workload_today"], x["start_time"]))
    return {"items": recommendations[:12]}


@router.get("/reviews")
async def list_reviews_and_stats(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
    limit: int = Query(40, le=100),
):
    """Resumen de estrellas (tienda y por profesional) y últimas opiniones de clientes."""
    r_store = await db.execute(
        select(func.avg(AppointmentReview.rating), func.count(AppointmentReview.id)).where(
            AppointmentReview.store_id == ctx.store_id
        )
    )
    arow = r_store.one()
    store_avg = float(arow[0]) if arow[0] is not None else None
    store_count = int(arow[1] or 0)

    r2 = await db.execute(
        select(
            AppointmentReview.professional_id,
            func.avg(AppointmentReview.rating),
            func.count(AppointmentReview.id),
        )
        .where(AppointmentReview.store_id == ctx.store_id)
        .group_by(AppointmentReview.professional_id)
    )
    by_prof: dict = {}
    for pid, av, cnt in r2.all():
        by_prof[pid] = {
            "average": round(float(av), 2) if av is not None else None,
            "count": int(cnt or 0),
        }

    prof_names: dict[str, str] = {}
    if by_prof:
        prn = await db.execute(select(Professional).where(Professional.id.in_(list(by_prof.keys()))))
        for p in prn.scalars().all():
            prof_names[p.id] = p.name or ""

    by_professional_list = [
        {
            "professional_id": pid,
            "name": prof_names.get(pid, ""),
            **stats,
        }
        for pid, stats in by_prof.items()
    ]
    by_professional_list.sort(key=lambda x: -(x.get("count") or 0))

    r_items = await db.execute(
        select(AppointmentReview, Appointment, Professional.name, Service.name)
        .join(Appointment, Appointment.id == AppointmentReview.appointment_id)
        .join(Professional, Professional.id == AppointmentReview.professional_id)
        .join(Service, Service.id == Appointment.service_id)
        .where(AppointmentReview.store_id == ctx.store_id)
        .order_by(AppointmentReview.created_at.desc())
        .limit(limit)
    )
    items = []
    for rev, appt, pname, sname in r_items.all():
        items.append(
            {
                "id": rev.id,
                "rating": rev.rating,
                "comment": rev.comment,
                "created_at": rev.created_at.isoformat(),
                "professional_name": pname or "",
                "service_name": sname or "",
                "appointment_start": appt.start_time.isoformat(),
            }
        )

    return {
        "store": {
            "average": round(store_avg, 2) if store_avg is not None else None,
            "count": store_count,
        },
        "by_professional": by_professional_list,
        "items": items,
    }


@router.post("/appointments")
async def create_admin_appointment(
    data: AdminAppointmentCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(CREAR_CITA)),
    user: User = Depends(get_current_user),
):
    ensure_branch_in_scope(ctx, data.branch_id)
    if data.client_id:
        cl = await db.get(Client, data.client_id)
        if not cl or cl.store_id != ctx.store_id:
            raise HTTPException(400, "Cliente inválido")
    try:
        appt, extra = await create_appointment_booking(
            db,
            store_id=ctx.store_id,
            branch_id=data.branch_id,
            professional_id=data.professional_id,
            service_id=data.service_id,
            client_id=data.client_id,
            start_time=data.start_time,
            payment_mode=data.payment_mode,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    svc_for_jobs = await db.get(Service, data.service_id)
    await schedule_reminder_jobs(
        db,
        ctx.store_id,
        appt.id,
        appt.start_time,
        end_time=appt.end_time,
        suggest_rebooking_days=svc_for_jobs.suggest_rebooking_days if svc_for_jobs else 0,
    )
    await log_appointment_action(
        db,
        appointment_id=appt.id,
        store_id=ctx.store_id,
        action="admin_create",
        actor_user_id=user.id,
        payload={},
    )
    return {"id": appt.id, "manage_token": appt.manage_token, "checkout": extra.get("checkout")}


class AppointmentPatch(BaseModel):
    status: Optional[Literal[
        "pending_payment", "confirmed", "cancelled", "completed", "no_show"
    ]] = None
    notes: Optional[str] = None
    charged_price_cents: Optional[int] = None
    station_id: Optional[str] = None


@router.patch("/appointments/{appointment_id}")
async def patch_appointment(
    appointment_id: str,
    data: AppointmentPatch,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(EDITAR_CITA)),
    user: User = Depends(get_current_user),
):
    a = await db.get(Appointment, appointment_id)
    if not a or a.store_id != ctx.store_id:
        raise HTTPException(404, "No encontrada")
    prev = {
        "status": a.status,
        "notes": a.notes,
        "charged_price_cents": a.charged_price_cents,
        "station_id": a.station_id,
    }
    if data.charged_price_cents is not None:
        a.charged_price_cents = data.charged_price_cents
    if data.status is not None:
        a.status = data.status
    if data.notes is not None:
        a.notes = data.notes
    patch_fields = data.model_dump(exclude_unset=True)
    if "station_id" in patch_fields:
        sid_raw = patch_fields["station_id"]
        if sid_raw is None:
            a.station_id = None
        else:
            sid = str(sid_raw).strip()
            if not sid:
                a.station_id = None
            else:
                ws = await db.get(WorkStation, sid)
                if not ws or ws.store_id != ctx.store_id or ws.branch_id != a.branch_id:
                    raise HTTPException(400, "Puesto inválido para la sede de esta cita")
                if not await station_time_free(db, ws.id, a.start_time, a.end_time, exclude_appointment_id=a.id):
                    raise HTTPException(400, "Ese puesto ya está ocupado en ese horario")
                a.station_id = ws.id

    if a.status == AppointmentStatus.COMPLETED.value:
        svc = await db.get(Service, a.service_id)
        if a.charged_price_cents is None:
            a.charged_price_cents = int(svc.price_cents) if svc else 0
        a.session_closed_at = datetime.utcnow()
        if a.ticket_id:
            tk = await db.get(Ticket, a.ticket_id)
            if tk and tk.store_id == ctx.store_id:
                tk.status = TicketStatus.CLOSED

    await log_appointment_action(
        db,
        appointment_id=a.id,
        store_id=ctx.store_id,
        action="admin_patch",
        actor_user_id=user.id,
        payload={
            "before": prev,
            "after": {
                "status": a.status,
                "notes": a.notes,
                "charged_price_cents": a.charged_price_cents,
                "station_id": a.station_id,
                "session_closed_at": a.session_closed_at.isoformat() if a.session_closed_at else None,
            },
        },
    )
    return {
        "id": a.id,
        "status": a.status,
        "charged_price_cents": a.charged_price_cents,
        "ticket_id": a.ticket_id,
        "station_id": a.station_id,
    }


def _appt_alert_item(a: Appointment, cname: str | None, sname: str | None, pname: str | None) -> dict:
    return {
        "appointment_id": a.id,
        "client_name": cname or "—",
        "service_name": sname or "—",
        "professional_name": pname or "—",
        "start_time": a.start_time.isoformat(),
        "end_time": a.end_time.isoformat(),
        "ticket_id": a.ticket_id,
    }


# --- Panel atención (trabajadores, ventas por servicio, clientes recurrentes, alertas) ---


@router.get("/panel")
async def scheduling_operations_panel(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_TIENDA, VER_REPORTES)),
):
    sid = ctx.store_id
    now = datetime.utcnow()
    win_start = now - timedelta(days=90)
    t15 = now + timedelta(minutes=15)
    t30 = now - timedelta(minutes=30)
    t60 = now - timedelta(minutes=60)

    vol_sub = (
        select(
            Appointment.professional_id.label("pid"),
            func.count(Appointment.id).label("v"),
        )
        .where(
            Appointment.store_id == sid,
            Appointment.start_time >= win_start,
            Appointment.status != AppointmentStatus.CANCELLED.value,
        )
        .group_by(Appointment.professional_id)
        .subquery()
    )
    rev_sub = (
        select(
            Appointment.professional_id.label("pid"),
            func.coalesce(
                func.sum(
                    func.coalesce(Appointment.charged_price_cents, Service.price_cents, 0)
                ),
                0,
            ).label("r"),
        )
        .join(Service, Service.id == Appointment.service_id)
        .where(
            Appointment.store_id == sid,
            Appointment.start_time >= win_start,
            Appointment.status == AppointmentStatus.COMPLETED.value,
        )
        .group_by(Appointment.professional_id)
        .subquery()
    )
    staff_rows = await db.execute(
        select(
            Professional.id,
            Professional.name,
            func.coalesce(vol_sub.c.v, 0),
            func.coalesce(rev_sub.c.r, 0),
        )
        .outerjoin(vol_sub, vol_sub.c.pid == Professional.id)
        .outerjoin(rev_sub, rev_sub.c.pid == Professional.id)
        .where(Professional.store_id == sid)
        .order_by(Professional.name)
    )
    staff_out = [
        {
            "professional_id": pid,
            "name": pname,
            "appointments_count_90d": int(v or 0),
            "revenue_cents_completed_90d": int(r or 0),
            "fixed_clients_90d": 0,
        }
        for pid, pname, v, r in staff_rows.all()
    ]
    fixed_sub = (
        select(
            Appointment.professional_id.label("pid"),
            Appointment.client_id.label("cid"),
            func.count(Appointment.id).label("visits"),
        )
        .where(
            Appointment.store_id == sid,
            Appointment.start_time >= win_start,
            Appointment.client_id.is_not(None),
            Appointment.status.in_([AppointmentStatus.CONFIRMED.value, AppointmentStatus.COMPLETED.value]),
        )
        .group_by(Appointment.professional_id, Appointment.client_id)
        .having(func.count(Appointment.id) >= 2)
        .subquery()
    )
    fixed_rows = await db.execute(
        select(fixed_sub.c.pid, func.count(fixed_sub.c.cid)).group_by(fixed_sub.c.pid)
    )
    fixed_by_prof = {pid: int(cnt or 0) for pid, cnt in fixed_rows.all()}
    for s in staff_out:
        s["fixed_clients_90d"] = fixed_by_prof.get(s["professional_id"], 0)
    staff_out.sort(key=lambda x: x["revenue_cents_completed_90d"], reverse=True)

    svc_sales = await db.execute(
        select(
            Service.id,
            Service.name,
            func.count(Appointment.id),
            func.coalesce(
                func.sum(func.coalesce(Appointment.charged_price_cents, Service.price_cents, 0)),
                0,
            ),
        )
        .join(Appointment, Appointment.service_id == Service.id)
        .where(
            Appointment.store_id == sid,
            Service.store_id == sid,
            Appointment.start_time >= win_start,
            Appointment.status == AppointmentStatus.COMPLETED.value,
        )
        .group_by(Service.id, Service.name)
    )
    services_ranked = [
        {
            "service_id": row[0],
            "name": row[1],
            "completed_count": int(row[2]),
            "revenue_cents": int(row[3] or 0),
        }
        for row in svc_sales.all()
    ]
    services_ranked.sort(key=lambda x: x["revenue_cents"], reverse=True)

    repeat_q = await db.execute(
        select(Client.id, Client.name, func.count(Appointment.id))
        .join(Appointment, Appointment.client_id == Client.id)
        .where(
            Client.store_id == sid,
            Appointment.store_id == sid,
            Appointment.start_time >= win_start,
            Appointment.status.in_(
                [AppointmentStatus.CONFIRMED.value, AppointmentStatus.COMPLETED.value]
            ),
        )
        .group_by(Client.id, Client.name)
        .having(func.count(Appointment.id) >= 2)
        .order_by(func.count(Appointment.id).desc())
        .limit(80)
    )
    repeat_clients = [
        {"client_id": cid, "name": cname, "visits": int(cnt)} for cid, cname, cnt in repeat_q.all()
    ]

    base_confirmed = and_(
        Appointment.store_id == sid,
        Appointment.status == AppointmentStatus.CONFIRMED.value,
    )
    # Una sola consulta: citas en curso, fin próximo o cierre atrasado (antes eran 4 round-trips).
    op_filter = or_(
        and_(Appointment.start_time <= now, Appointment.end_time > now),
        and_(Appointment.end_time > now, Appointment.end_time <= t15),
        and_(Appointment.end_time <= t30, Appointment.end_time > t60),
        Appointment.end_time <= t60,
    )
    r_live = await db.execute(
        select(Appointment, Client.name, Service, Professional.name)
        .outerjoin(Client, Client.id == Appointment.client_id)
        .join(Service, Service.id == Appointment.service_id)
        .join(Professional, Professional.id == Appointment.professional_id)
        .where(base_confirmed, op_filter)
    )
    ending_soon = []
    overdue_30m = []
    overdue_60m = []
    active_sessions = []
    for a, cname, svc, pname in r_live.all():
        end = a.end_time
        sname = svc.name if svc else None
        if end > now and end <= t15:
            ending_soon.append(_appt_alert_item(a, cname, sname, pname))
        if end <= t30 and end > t60:
            overdue_30m.append(_appt_alert_item(a, cname, sname, pname))
        if end <= t60:
            overdue_60m.append(_appt_alert_item(a, cname, sname, pname))
        if a.start_time <= now and end > now:
            active_sessions.append(
                {
                    **_appt_alert_item(a, cname, sname, pname),
                    "list_price_cents": svc.price_cents if svc else 0,
                    "allow_price_override": svc.allow_price_override if svc else True,
                    "currency": svc.currency if svc else "CLP",
                }
            )
    ending_soon.sort(key=lambda x: x["end_time"])
    overdue_30m.sort(key=lambda x: x["end_time"])
    overdue_60m.sort(key=lambda x: x["end_time"])
    active_sessions.sort(key=lambda x: x["start_time"])

    return {
        "range_days": 90,
        "staff": staff_out,
        "services_by_revenue": services_ranked,
        "repeat_clients": repeat_clients,
        "alerts": {
            "ending_soon": ending_soon,
            "overdue_close_30_60m": overdue_30m,
            "overdue_close_60m_plus": overdue_60m,
        },
        "active_sessions": active_sessions,
        "server_time_utc": now.isoformat(),
    }


# --- Dashboard ---


@router.get("/dashboard")
async def scheduling_dashboard(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES)),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
):
    fd = from_date or date.today() - timedelta(days=30)
    td = to_date or date.today() + timedelta(days=1)
    start = datetime(fd.year, fd.month, fd.day)
    end = datetime(td.year, td.month, td.day) + timedelta(days=1)

    sid = ctx.store_id
    common = (
        Appointment.store_id == sid,
        Appointment.start_time >= start,
        Appointment.start_time < end,
    )
    total = await db.execute(select(func.count(Appointment.id)).where(*common))
    cancelled = await db.execute(
        select(func.count(Appointment.id)).where(
            *common, Appointment.status == AppointmentStatus.CANCELLED.value
        )
    )
    noshow = await db.execute(
        select(func.count(Appointment.id)).where(*common, Appointment.status == AppointmentStatus.NO_SHOW.value)
    )
    confirmed = await db.execute(
        select(func.count(Appointment.id)).where(
            *common, Appointment.status == AppointmentStatus.CONFIRMED.value
        )
    )

    rev = await db.execute(
        select(func.coalesce(func.sum(Service.price_cents), 0))
        .select_from(Appointment)
        .join(Service, Service.id == Appointment.service_id)
        .where(
            Appointment.store_id == sid,
            Appointment.start_time >= start,
            Appointment.start_time < end,
            Appointment.status.in_(
                [AppointmentStatus.CONFIRMED.value, AppointmentStatus.COMPLETED.value]
            ),
        )
    )

    return {
        "range": {"from": fd.isoformat(), "to": td.isoformat()},
        "appointments_total": total.scalar() or 0,
        "confirmed": confirmed.scalar() or 0,
        "cancelled": cancelled.scalar() or 0,
        "no_show": noshow.scalar() or 0,
        "revenue_cents_estimated": int(rev.scalar() or 0),
    }


# --- Export CSV ---


@router.get("/appointments/export.csv")
async def export_appointments_csv(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(EXPORTAR_REGISTROS)),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
):
    fd = from_date or date.today() - timedelta(days=90)
    td = to_date or date.today() + timedelta(days=30)
    start = datetime(fd.year, fd.month, fd.day)
    end = datetime(td.year, td.month, td.day) + timedelta(days=1)
    r = await db.execute(
        select(Appointment)
        .where(
            Appointment.store_id == ctx.store_id,
            Appointment.start_time >= start,
            Appointment.start_time < end,
        )
        .order_by(Appointment.start_time)
    )
    rows = r.scalars().all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        ["id", "start_time", "end_time", "status", "professional_id", "service_id", "branch_id", "client_id"]
    )
    for a in rows:
        w.writerow(
            [
                a.id,
                a.start_time.isoformat(),
                a.end_time.isoformat(),
                a.status,
                a.professional_id,
                a.service_id,
                a.branch_id,
                a.client_id or "",
            ]
        )
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="citas.csv"'},
    )


# --- Audit ---


@router.get("/appointments/{appointment_id}/audit")
async def appointment_audit(
    appointment_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_TIENDA)),
):
    a = await db.get(Appointment, appointment_id)
    if not a or a.store_id != ctx.store_id:
        raise HTTPException(404, "No encontrada")
    r = await db.execute(
        select(AppointmentAuditLog)
        .where(AppointmentAuditLog.appointment_id == appointment_id)
        .order_by(AppointmentAuditLog.created_at.desc())
    )
    rows = r.scalars().all()
    return {
        "items": [
            {
                "id": x.id,
                "action": x.action,
                "actor_user_id": x.actor_user_id,
                "payload": x.payload,
                "created_at": x.created_at.isoformat(),
            }
            for x in rows
        ]
    }


# --- Payment intent stub ---


@router.post("/appointments/{appointment_id}/payment-intent")
async def create_payment_intent(
    appointment_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(EDITAR_CITA, VER_REPORTES_PAGOS)),
):
    a = await db.get(Appointment, appointment_id)
    if not a or a.store_id != ctx.store_id:
        raise HTTPException(404, "Cita no encontrada")
    sv = await db.get(Service, a.service_id)
    amt = sv.price_cents if sv else 0
    p = PaymentAttempt(
        store_id=ctx.store_id,
        appointment_id=a.id,
        provider="stripe",
        amount_cents=amt,
        currency=sv.currency if sv else "CLP",
        status=PaymentAttemptStatus.PENDING.value,
    )
    db.add(p)
    await db.flush()
    return {
        "payment_attempt_id": p.id,
        "client_secret": None,
        "message": "Configurar STRIPE_SECRET_KEY y completar integración en scheduling_webhooks",
    }


# --- Chatbot stub ---


@router.post("/ai/hint")
async def scheduling_ai_hint(
    message: str = Query(..., min_length=1),
):
    return {
        "reply": "Usa la API de Revotake: GET /public/scheduling/{slug}/slots para disponibilidad y POST .../bookings para reservar. Este endpoint es un marcador para conectar un LLM.",
        "intent": "unknown",
    }


# --- Fichas: documentos por cliente ---


class ClientDocumentCreate(BaseModel):
    client_id: str
    title: str
    file_url: str
    notes: Optional[str] = None


@router.get("/client-documents")
async def list_client_documents(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_FICHAS)),
):
    cl = await db.get(Client, client_id)
    if not cl or cl.store_id != ctx.store_id:
        raise HTTPException(400, "Cliente inválido")
    r = await db.execute(
        select(ClientDocument)
        .where(ClientDocument.client_id == client_id, ClientDocument.store_id == ctx.store_id)
        .order_by(ClientDocument.created_at.desc())
    )
    rows = r.scalars().all()
    return {
        "items": [
            {
                "id": d.id,
                "title": d.title,
                "file_url": d.file_url,
                "notes": d.notes,
                "created_at": d.created_at.isoformat(),
            }
            for d in rows
        ]
    }


@router.post("/client-documents")
async def create_client_document(
    data: ClientDocumentCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(CREAR_FICHAS)),
):
    cl = await db.get(Client, data.client_id)
    if not cl or cl.store_id != ctx.store_id:
        raise HTTPException(400, "Cliente inválido")
    d = ClientDocument(
        store_id=ctx.store_id,
        client_id=data.client_id,
        title=data.title.strip(),
        file_url=data.file_url.strip(),
        notes=data.notes,
    )
    db.add(d)
    await db.flush()
    return {"id": d.id}


# --- Waitlist ---


@router.get("/waitlist")
async def list_waitlist(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_AGENDA_TIENDA)),
    professional_id: Optional[str] = None,
    service_id: Optional[str] = None,
    status: Optional[str] = None,
):
    """Lista todas las entradas de lista de espera de la tienda."""
    q = select(WaitlistEntry).where(WaitlistEntry.store_id == ctx.store_id)
    if professional_id:
        q = q.where(WaitlistEntry.professional_id == professional_id)
    if service_id:
        q = q.where(WaitlistEntry.service_id == service_id)
    if status:
        q = q.where(WaitlistEntry.status == status)
    if ctx.branch_scope:
        q = q.where(WaitlistEntry.branch_id.in_(list(ctx.branch_scope)))
    q = q.order_by(WaitlistEntry.desired_date, WaitlistEntry.created_at)
    r = await db.execute(q)
    rows = r.scalars().all()
    return {
        "items": [
            {
                "id": e.id,
                "professional_id": e.professional_id,
                "service_id": e.service_id,
                "branch_id": e.branch_id,
                "client_name": e.client_name,
                "client_email": e.client_email,
                "client_phone": e.client_phone,
                "desired_date": e.desired_date.isoformat(),
                "status": e.status,
                "notified_at": e.notified_at.isoformat() if e.notified_at else None,
                "created_at": e.created_at.isoformat(),
            }
            for e in rows
        ]
    }


@router.delete("/waitlist/{entry_id}")
async def delete_waitlist_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    entry = await db.get(WaitlistEntry, entry_id)
    if not entry or entry.store_id != ctx.store_id:
        raise HTTPException(404, "No encontrado")
    await db.delete(entry)
    return {"ok": True}
