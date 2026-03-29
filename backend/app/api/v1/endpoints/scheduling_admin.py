"""Panel: sucursales, profesionales, servicios, citas, métricas, export."""
import csv
import io
import re
from datetime import date, datetime, time, timedelta
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import StoreContext, require_store_admin, require_store_permission
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
from app.models.store import StoreMember
from app.models.client_document import ClientDocument
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
    PaymentAttempt,
    PaymentAttemptStatus,
)
from app.services.scheduling_availability import compute_slots
from app.services.scheduling_booking import create_appointment_booking, schedule_reminder_jobs
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
    timezone: str = "UTC"


@router.get("/branches")
async def list_branches(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
):
    r = await db.execute(select(Branch).where(Branch.store_id == ctx.store_id).order_by(Branch.name))
    rows = r.scalars().all()
    return {"items": [{"id": b.id, "name": b.name, "slug": b.slug, "timezone": b.timezone, "is_active": b.is_active} for b in rows]}


@router.post("/branches")
async def create_branch(
    data: BranchCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    slug = _slugify(data.slug or data.name)
    b = Branch(store_id=ctx.store_id, name=data.name.strip(), slug=slug, timezone=data.timezone)
    db.add(b)
    await db.flush()
    return {"id": b.id, "slug": b.slug}


# --- Professionals ---


class ProfessionalCreate(BaseModel):
    name: str
    email: Optional[str] = None
    branch_ids: list[str] = Field(default_factory=list)


@router.get("/professionals")
async def list_professionals(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
):
    r = await db.execute(
        select(Professional).where(Professional.store_id == ctx.store_id).order_by(Professional.name)
    )
    rows = r.scalars().all()
    out = []
    for p in rows:
        br = await db.execute(
            select(ProfessionalBranch.branch_id).where(ProfessionalBranch.professional_id == p.id)
        )
        bids = [x[0] for x in br.all()]
        out.append(
            {
                "id": p.id,
                "name": p.name,
                "email": p.email,
                "user_id": p.user_id,
                "branch_ids": bids,
            }
        )
    return {"items": out}


@router.post("/professionals")
async def create_professional(
    data: ProfessionalCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_admin),
):
    p = Professional(store_id=ctx.store_id, name=data.name.strip(), email=data.email)
    db.add(p)
    await db.flush()
    for bid in data.branch_ids:
        br = await db.get(Branch, bid)
        if not br or br.store_id != ctx.store_id:
            raise HTTPException(400, "Sucursal inválida")
        db.add(ProfessionalBranch(professional_id=p.id, branch_id=bid, is_primary=len(data.branch_ids) == 1))
    return {"id": p.id}


class ProfessionalPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    branch_ids: Optional[list[str]] = None
    user_id: Optional[str] = None  # null o vacío = desvincular; debe ser miembro de la tienda


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
        await db.execute(delete(ProfessionalBranch).where(ProfessionalBranch.professional_id == p.id))
        for bid in data.branch_ids:
            br = await db.get(Branch, bid)
            if not br or br.store_id != ctx.store_id:
                raise HTTPException(400, "Sucursal inválida")
            db.add(ProfessionalBranch(professional_id=p.id, branch_id=bid, is_primary=False))
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
    return {"id": p.id, "user_id": p.user_id}


# --- Services ---


class ServiceCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    duration_minutes: int = 30
    buffer_before_minutes: int = 0
    buffer_after_minutes: int = 0
    price_cents: int = 0
    currency: str = "CLP"


@router.get("/services")
async def list_services(
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(VER_CATALOGO_AGENDA, VER_AGENDA_TIENDA)),
):
    r = await db.execute(
        select(Service).where(Service.store_id == ctx.store_id).order_by(Service.name)
    )
    rows = r.scalars().all()
    return {
        "items": [
            {
                "id": s.id,
                "name": s.name,
                "slug": s.slug,
                "duration_minutes": s.duration_minutes,
                "buffer_before_minutes": s.buffer_before_minutes,
                "buffer_after_minutes": s.buffer_after_minutes,
                "price_cents": s.price_cents,
                "currency": s.currency,
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
    s = Service(
        store_id=ctx.store_id,
        name=data.name.strip(),
        slug=slug,
        duration_minutes=data.duration_minutes,
        buffer_before_minutes=data.buffer_before_minutes,
        buffer_after_minutes=data.buffer_after_minutes,
        price_cents=data.price_cents,
        currency=data.currency,
    )
    db.add(s)
    await db.flush()
    return {"id": s.id, "slug": s.slug}


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
    q = select(Appointment).where(Appointment.store_id == ctx.store_id).order_by(Appointment.start_time)
    if from_date:
        q = q.where(Appointment.start_time >= datetime(from_date.year, from_date.month, from_date.day))
    if to_date:
        end = datetime(to_date.year, to_date.month, to_date.day) + timedelta(days=1)
        q = q.where(Appointment.start_time < end)
    if professional_id:
        q = q.where(Appointment.professional_id == professional_id)
    if branch_id:
        q = q.where(Appointment.branch_id == branch_id)
    if status:
        q = q.where(Appointment.status == status)
    r = await db.execute(q)
    rows = r.scalars().all()
    out = []
    for a in rows:
        out.append(
            {
                "id": a.id,
                "branch_id": a.branch_id,
                "professional_id": a.professional_id,
                "service_id": a.service_id,
                "client_id": a.client_id,
                "start_time": a.start_time.isoformat(),
                "end_time": a.end_time.isoformat(),
                "status": a.status,
                "payment_mode": a.payment_mode,
                "payment_status": a.payment_status,
                "manage_token": a.manage_token,
            }
        )
    return {"items": out}


@router.post("/appointments")
async def create_admin_appointment(
    data: AdminAppointmentCreate,
    db: AsyncSession = Depends(get_db),
    ctx: StoreContext = Depends(require_store_permission(CREAR_CITA)),
    user: User = Depends(get_current_user),
):
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
    await schedule_reminder_jobs(db, ctx.store_id, appt.id, appt.start_time)
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
    status: Optional[str] = None
    notes: Optional[str] = None


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
    prev = {"status": a.status, "notes": a.notes}
    if data.status is not None:
        a.status = data.status
    if data.notes is not None:
        a.notes = data.notes
    await log_appointment_action(
        db,
        appointment_id=a.id,
        store_id=ctx.store_id,
        action="admin_patch",
        actor_user_id=user.id,
        payload={"before": prev, "after": {"status": a.status, "notes": a.notes}},
    )
    return {"id": a.id, "status": a.status}


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
