from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
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

REVOTAKE_DOCS = """
RevoTake es una plataforma de gestión empresarial con IA. Módulos disponibles:

**Dashboard** (/dashboard): KPIs — clientes totales, tickets abiertos, alertas de stock, reuniones próximas.

**Clientes** (/clients): CRM. Crear, editar, eliminar clientes. Buscar por nombre, email o teléfono. Importar en masa con IA pegando texto o Excel. Campo "Próximo contacto" para seguimiento.

**Operaciones / Kanban** (/kanban): Tablero de tickets por estado. Tipos: LEAD, REUNIÓN, PEDIDO, INCIDENCIA, TAREA. Arrastrar columnas para cambiar estado.

**Agenda / Reuniones** (/calendar): Reuniones con clientes. Envía confirmación por email con link para confirmar o declinar. Genera archivo .ics para Google Calendar/Outlook.

**Citas** (/scheduling): Sistema de agenda de citas profesional.
- Configuración: sucursales, profesionales, servicios (duración, precio, política cancelación, depósito, formulario intake, sugerencia re-agendamiento).
- Reglas de disponibilidad: horarios semanales o excepciones por fecha.
- Reserva pública: /book/{slug} — clientes reservan sin login.
- Lista de espera: si no hay slots, el cliente se anota y recibe email automático al liberarse un espacio.
- Notificaciones automáticas: confirmación, recordatorio 24h, recordatorio 1h, solicitud de reseña 2h después, sugerencia de re-agendamiento.
- Panel atención (/scheduling/panel): sesiones activas, alertas de cierre, métricas de profesionales.
- Mi agenda (/mi-agenda): vista personal del profesional.

**Inventario** (/products): Productos con stock. Alertas automáticas de stock bajo/crítico. Registro de ventas que descuenta stock.

**Asistente IA** (/ai): Chat con contexto del negocio. Puedes configurar el contexto de la tienda en Configuración → IA.

**Configuración** (/settings):
- Datos de la tienda: mismo formulario que el alta (nombre, logo, SII, dirección, horarios, comodidades, Kanban, agenda).
- Contexto IA: texto libre que describe el negocio, servicios, precios, horarios, políticas.
- Modo estricto: la IA solo responde sobre la información configurada, sin inventar.

**Notificaciones**: Campanita en la barra superior. Muestra alertas de stock crítico/bajo, citas próximas 24h, reuniones próximas, clientes en lista de espera.

**Tiendas** (/stores): Crear y gestionar múltiples tiendas. Cada tienda tiene su propia configuración, clientes, agenda e inventario.

Para soporte adicional visita la documentación o contacta al equipo de RevoTake.
"""

class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    client_id: Optional[str] = None
    context: dict = {}

class HelpMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)

class StoreContextUpdate(BaseModel):
    business_context: str
    strict_mode: bool = False

@router.post("/help")
async def ai_help(data: HelpMessage, current_user: User = Depends(get_current_user)):
    """Responde preguntas sobre cómo usar RevoTake."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, "AI not configured")
    system = f"""Eres el asistente de ayuda de RevoTake. Solo respondes preguntas sobre cómo usar la plataforma.
Si te preguntan algo que no está relacionado con RevoTake, redirige amablemente al tema de la app.
Responde en español, de forma concisa y clara.

Documentación de RevoTake:
{REVOTAKE_DOCS}"""
    client_sdk = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client_sdk.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=800,
        system=system,
        messages=[{"role": "user", "content": data.message}],
    )
    return {"response": response.content[0].text if response.content else ""}

@router.post("/context")
async def update_store_ai_context(
    data: StoreContextUpdate,
    ctx: StoreContext = Depends(require_store),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza el contexto IA de la tienda (business_context + strict_mode)."""
    from app.models.store import Store
    store = await db.get(Store, ctx.store_id)
    if not store:
        raise HTTPException(404, "Tienda no encontrada")
    settings_dict = dict(store.settings or {})
    ai_settings = dict(settings_dict.get("ai") or {})
    ai_settings["business_context"] = data.business_context
    ai_settings["strict_mode"] = data.strict_mode
    settings_dict["ai"] = ai_settings
    store.settings = settings_dict
    return {"ok": True, "business_context_length": len(data.business_context), "strict_mode": data.strict_mode}

@router.post("/chat")
async def ai_chat(data: ChatMessage, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, "AI not configured")

    st = ctx.store.settings or {}
    ai_cfg = st.get("ai") or {}
    business_ctx = ai_cfg.get("business_context") or ""
    tone = ai_cfg.get("tone") or "professional"
    strict_mode = bool(ai_cfg.get("strict_mode", False))

    if strict_mode and business_ctx:
        system_context = f"""Eres el asistente virtual de «{ctx.store.name}».
Tono: {tone}.
INSTRUCCIÓN IMPORTANTE: Solo puedes responder usando la información que aparece a continuación.
Si no sabes la respuesta basándote en este contexto, di exactamente: "No tengo esa información. Contacta directamente con {ctx.store.name}."
No inventes datos, precios, horarios ni servicios que no estén en el contexto.

=== CONTEXTO DEL NEGOCIO ===
{business_ctx}
===========================

Responde siempre en español. Sé conciso y útil."""
    else:
        system_context = f"""Eres el asistente de la tienda «{ctx.store.name}» en RevoTake.
Tono: {tone}.
Contexto del negocio:
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
