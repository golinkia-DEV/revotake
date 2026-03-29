from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
import json
import anthropic
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.client import Client
from app.models.ticket import Ticket
from app.models.product import Product
from app.models.purchase import Purchase
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

class ChatMessage(BaseModel):
    message: str
    client_id: Optional[str] = None
    context: dict = {}

@router.post("/chat")
async def ai_chat(data: ChatMessage, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, "AI not configured")

    st = ctx.store.settings or {}
    ai_cfg = st.get("ai") or {}
    business_ctx = ai_cfg.get("business_context") or ""
    tone = ai_cfg.get("tone") or "professional"

    system_context = f"""Eres el asistente de la tienda «{ctx.store.name}» en RevoTake.
Tono: {tone}.
Reglas y contexto del negocio (configuración de la tienda):
{business_ctx or "No hay texto adicional configurado; infiere del tipo de negocio y los datos siguientes."}

Ayudas con: clientes, agenda, stock, tickets Kanban y automatizaciones.
Responde siempre en español. Sé conciso y útil.

Configuración técnica (JSON): {json.dumps(st, ensure_ascii=False)[:4000]}"""

    if data.client_id:
        client_result = await db.execute(
            select(Client).where(Client.id == data.client_id, Client.store_id == ctx.store_id)
        )
        client = client_result.scalar_one_or_none()
        if client:
            system_context += f"\n\nContexto del cliente actual:\n- Nombre: {client.name}\n- Email: {client.email}\n- Teléfono: {client.phone}\n- Notas: {client.notes}\n- Preferencias: {client.preferences}"
            n_tickets = (
                await db.execute(
                    select(func.count(Ticket.id)).where(Ticket.client_id == client.id, Ticket.store_id == ctx.store_id)
                )
            ).scalar() or 0
            system_context += f"\n- Tickets asociados: {n_tickets}"
            ph = await db.execute(
                select(
                    Purchase.quantity.label("qty"),
                    Purchase.total.label("line_total"),
                    Purchase.sold_at,
                    Product.name.label("product_name"),
                )
                .join(Product, Purchase.product_id == Product.id)
                .where(Purchase.client_id == client.id, Purchase.store_id == ctx.store_id)
                .order_by(Purchase.sold_at.desc())
                .limit(8)
            )
            rows = ph.all()
            if rows:
                lines = [
                    f"  • {r.product_name} x{r.qty} ({r.sold_at.date() if r.sold_at else ''}) total ${r.line_total:.0f}"
                    for r in rows
                ]
                system_context += "\n\nCompras recientes:\n" + "\n".join(lines)

    alerts_result = await db.execute(
        select(Product).where(Product.store_id == ctx.store_id, Product.stock_status.in_(["low", "critical"]))
    )
    alerts = alerts_result.scalars().all()
    if alerts:
        system_context += f"\n\nAlertas de stock: {', '.join([p.name for p in alerts])}"

    model = settings.ANTHROPIC_MODEL
    client_sdk = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client_sdk.messages.create(
        model=model,
        max_tokens=1024,
        system=system_context,
        messages=[{"role": "user", "content": data.message}],
    )
    text = response.content[0].text if response.content else ""
    return {"response": text, "model": model}

@router.post("/suggest-meeting-times")
async def suggest_times(data: ChatMessage, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, "AI not configured")
    agenda = (ctx.store.settings or {}).get("agenda") or {}
    dur = agenda.get("default_duration_minutes", 30)
    model = settings.ANTHROPIC_MODEL
    client_sdk = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client_sdk.messages.create(
        model=model,
        max_tokens=512,
        system=f"Responde siempre en español. Duración sugerida por defecto: {dur} minutos (tienda: {ctx.store.name}).",
        messages=[{"role": "user", "content": f"Sugiere 3 horarios de reunión para la próxima semana laboral. Contexto: {data.message}. Formato: lista con fecha, hora y duración."}],
    )
    text = response.content[0].text if response.content else ""
    return {"suggestions": text, "model": model}
