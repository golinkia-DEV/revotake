import json
import re

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Optional

from app.api.v1.endpoints.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.client import Client
from app.models.meeting import Meeting
from app.models.product import Product
from app.models.purchase import Purchase
from app.models.scheduling import Appointment, Branch, Professional, Service
from app.models.ticket import Ticket
from app.models.user import User

router = APIRouter()

_ACTIVITY_LIMIT_PER_KIND = 120
_ACTIVITY_MERGED_LIMIT = 250

MAX_IMPORT_CHARS = 400_000
MAX_CLIENTS_AI_IMPORT = 120

class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    preferences: dict = {}
    custom_fields: dict = {}


class ClientImportAIRequest(BaseModel):
    raw_text: str = Field(..., min_length=1, max_length=MAX_IMPORT_CHARS)


def _extract_json_array(text: str) -> list[Any]:
    t = text.strip()
    if "```" in t:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", t, re.IGNORECASE)
        if m:
            t = m.group(1).strip()
    try:
        data = json.loads(t)
    except json.JSONDecodeError:
        start = t.find("[")
        end = t.rfind("]")
        if start >= 0 and end > start:
            data = json.loads(t[start : end + 1])
        else:
            raise
    if not isinstance(data, list):
        raise ValueError("La respuesta no es un array JSON")
    return data


def _str_or_none(v: Any, max_len: int = 2000) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    return s[:max_len]


def _normalize_import_row(row: Any) -> Optional[dict[str, Any]]:
    if not isinstance(row, dict):
        return None
    name = _str_or_none(row.get("name"), 500)
    if not name:
        return None
    prefs = row.get("preferences") if isinstance(row.get("preferences"), dict) else {}
    cf = row.get("custom_fields") if isinstance(row.get("custom_fields"), dict) else {}
    known = {"name", "email", "phone", "address", "notes", "preferences", "custom_fields"}
    for k, v in row.items():
        if k in known:
            continue
        if v is None or v == "":
            continue
        key = str(k).strip()[:120] or "extra"
        if isinstance(v, (dict, list)):
            cf[key] = v
        else:
            cf[key] = str(v)[:2000]
    return {
        "name": name,
        "email": _str_or_none(row.get("email"), 320),
        "phone": _str_or_none(row.get("phone"), 80),
        "address": _str_or_none(row.get("address"), 500),
        "notes": _str_or_none(row.get("notes"), 8000),
        "preferences": prefs or {},
        "custom_fields": cf or {},
    }


@router.post("/import-ai")
async def import_clients_ai(
    data: ClientImportAIRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store),
):
    """Parsea texto/Excel pegado con IA y crea perfiles de cliente en la tienda actual."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=400, detail="IA no configurada en el servidor (ANTHROPIC_API_KEY)")

    raw = data.raw_text.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Texto vacío")

    system = f"""Eres un extractor de datos para un CRM en español. El usuario pegó texto desde Excel, CSV, una tabla o una lista libre.
Debes responder ÚNICAMENTE con un array JSON válido UTF-8. Sin markdown, sin texto antes ni después.

Cada elemento del array es un objeto con:
- "name" (string, obligatorio): nombre completo o razón social
- "email" (string o null)
- "phone" (string o null): incluye +56 o formato local si aparece
- "address" (string o null)
- "notes" (string o null): comentarios u observaciones generales
- "preferences" (objeto): preferencias explícitas como pares clave-valor; {{}} si no hay
- "custom_fields" (objeto): columnas extra (RUT, ciudad, última visita, etiquetas, etc.) con nombres legibles o snake_case

Reglas:
- Detecta la fila de encabezados y mapea columnas aunque tengan nombres distintos (ej. "Tel", "Móvil", "Celular" → phone).
- Omite filas sin nombre identificable.
- Como máximo {MAX_CLIENTS_AI_IMPORT} objetos en el array (si hay más filas de datos, incluye solo las primeras {MAX_CLIENTS_AI_IMPORT})."""

    clip = raw[: min(len(raw), 280_000)]
    user_block = f"Contenido pegado:\n\n{clip}"

    client_sdk = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = client_sdk.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=24_000,
            system=system,
            messages=[{"role": "user", "content": user_block}],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al llamar a la IA: {e!s}") from e

    text = response.content[0].text if response.content else ""
    try:
        items = _extract_json_array(text)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"No se pudo interpretar el JSON devuelto por la IA: {e!s}") from e

    created = 0
    skipped = 0
    for row in items[:MAX_CLIENTS_AI_IMPORT]:
        norm = _normalize_import_row(row)
        if not norm:
            skipped += 1
            continue
        data_create = ClientCreate(
            name=norm["name"],
            email=norm["email"],
            phone=norm["phone"],
            address=norm["address"],
            notes=norm["notes"],
            preferences=norm["preferences"],
            custom_fields=norm["custom_fields"],
        )
        db.add(Client(store_id=ctx.store_id, **data_create.model_dump()))

        created += 1

    return {"created": created, "skipped_rows": skipped, "parsed_from_model": len(items)}

@router.get("/")
async def list_clients(skip: int = 0, limit: int = 50, search: Optional[str] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    from sqlalchemy import or_
    count_stmt = select(func.count(Client.id)).where(Client.store_id == ctx.store_id)
    query = select(Client).where(Client.store_id == ctx.store_id)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filt = or_(
            Client.name.ilike(term),
            Client.email.ilike(term),
            Client.phone.ilike(term),
        )
        count_stmt = count_stmt.where(filt)
        query = query.where(filt)
    total = (await db.execute(count_stmt)).scalar() or 0
    query = query.offset(skip).limit(limit).order_by(Client.created_at.desc())
    result = await db.execute(query)
    clients = result.scalars().all()
    return {
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "phone": c.phone,
                "address": c.address,
                "notes": c.notes,
                "created_at": c.created_at,
                "preferences": c.preferences or {},
            }
            for c in clients
        ],
        "total": total,
    }

@router.post("/")
async def create_client(data: ClientCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    client = Client(store_id=ctx.store_id, **data.model_dump())
    db.add(client)
    return {"id": client.id, "name": client.name}

@router.get("/{client_id}")
async def get_client(client_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Client).where(Client.id == client_id, Client.store_id == ctx.store_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found")
    return {"id": client.id, "name": client.name, "email": client.email, "phone": client.phone, "address": client.address, "notes": client.notes, "preferences": client.preferences, "custom_fields": client.custom_fields, "created_at": client.created_at}


@router.get("/{client_id}/activity")
async def get_client_activity(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store),
):
    """Historial unificado: citas/reservas (con profesional aunque esté inactivo), compras, tickets y reuniones."""
    result = await db.execute(select(Client).where(Client.id == client_id, Client.store_id == ctx.store_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found")

    sid = ctx.store_id
    events: list[dict[str, Any]] = []

    appt_rows = await db.execute(
        select(Appointment, Service.name, Professional.name, Professional.is_active, Branch.name)
        .join(Service, Service.id == Appointment.service_id)
        .join(Professional, Professional.id == Appointment.professional_id)
        .join(Branch, Branch.id == Appointment.branch_id)
        .where(Appointment.client_id == client_id, Appointment.store_id == sid)
        .order_by(Appointment.start_time.desc())
        .limit(_ACTIVITY_LIMIT_PER_KIND)
    )
    for a, svc_name, prof_name, prof_active, branch_name in appt_rows.all():
        events.append(
            {
                "kind": "appointment",
                "at": a.start_time.isoformat(),
                "id": a.id,
                "service_name": svc_name,
                "professional_id": a.professional_id,
                "professional_name": prof_name,
                "professional_is_active": bool(prof_active),
                "branch_name": branch_name,
                "status": a.status,
                "start_time": a.start_time.isoformat(),
                "end_time": a.end_time.isoformat(),
                "payment_status": a.payment_status,
                "charged_price_cents": a.charged_price_cents,
            }
        )

    pur_rows = await db.execute(
        select(Purchase, Product.name)
        .join(Product, Product.id == Purchase.product_id)
        .where(Purchase.client_id == client_id, Purchase.store_id == sid)
        .order_by(Purchase.sold_at.desc())
        .limit(_ACTIVITY_LIMIT_PER_KIND)
    )
    for p, product_name in pur_rows.all():
        events.append(
            {
                "kind": "purchase",
                "at": p.sold_at.isoformat(),
                "id": p.id,
                "product_name": product_name,
                "quantity": p.quantity,
                "unit_price": p.unit_price,
                "total": p.total,
            }
        )

    tick_rows = await db.execute(
        select(Ticket)
        .where(Ticket.client_id == client_id, Ticket.store_id == sid)
        .order_by(Ticket.updated_at.desc())
        .limit(_ACTIVITY_LIMIT_PER_KIND)
    )
    for t in tick_rows.scalars().all():
        events.append(
            {
                "kind": "ticket",
                "at": t.updated_at.isoformat(),
                "id": t.id,
                "title": t.title,
                "ticket_type": t.type.value if hasattr(t.type, "value") else str(t.type),
                "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "created_at": t.created_at.isoformat(),
            }
        )

    meet_rows = await db.execute(
        select(Meeting, User.name)
        .join(User, User.id == Meeting.organizer_id)
        .where(Meeting.client_id == client_id, Meeting.store_id == sid)
        .order_by(Meeting.start_time.desc())
        .limit(_ACTIVITY_LIMIT_PER_KIND)
    )
    for m, organizer_name in meet_rows.all():
        events.append(
            {
                "kind": "meeting",
                "at": m.start_time.isoformat(),
                "id": m.id,
                "title": m.title,
                "organizer_name": organizer_name,
                "confirmation_status": m.confirmation_status,
                "start_time": m.start_time.isoformat(),
                "end_time": m.end_time.isoformat(),
            }
        )

    events.sort(key=lambda e: e["at"], reverse=True)
    events = events[:_ACTIVITY_MERGED_LIMIT]

    return {
        "client": {
            "id": client.id,
            "name": client.name,
            "email": client.email,
            "phone": client.phone,
            "address": client.address,
            "notes": client.notes,
            "preferences": client.preferences or {},
            "custom_fields": client.custom_fields or {},
            "created_at": client.created_at.isoformat() if client.created_at else None,
        },
        "events": events,
    }


@router.put("/{client_id}")
async def update_client(client_id: str, data: ClientCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Client).where(Client.id == client_id, Client.store_id == ctx.store_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found")
    for k, v in data.model_dump().items():
        setattr(client, k, v)
    return {"id": client.id, "name": client.name}

@router.delete("/{client_id}")
async def delete_client(client_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Client).where(Client.id == client_id, Client.store_id == ctx.store_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found")
    await db.delete(client)
    return {"message": "Deleted"}
