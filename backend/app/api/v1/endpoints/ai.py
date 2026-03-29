from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import anthropic
from app.core.config import settings
from app.core.database import get_db
from app.models.client import Client
from app.models.ticket import Ticket
from app.models.product import Product
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

class ChatMessage(BaseModel):
    message: str
    client_id: Optional[str] = None
    context: dict = {}

@router.post("/chat")
async def ai_chat(data: ChatMessage, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, "AI not configured")

    system_context = """Eres el asistente de RevoTake, una plataforma de gestión empresarial inteligente.
Ayudas al equipo con: gestión de clientes, agenda de reuniones, control de stock, tickets Kanban, y automatizaciones.
Responde siempre en español. Sé conciso y útil."""

    if data.client_id:
        client_result = await db.execute(select(Client).where(Client.id == data.client_id))
        client = client_result.scalar_one_or_none()
        if client:
            system_context += f"\n\nContexto del cliente actual:\n- Nombre: {client.name}\n- Email: {client.email}\n- Notas: {client.notes}\n- Preferencias: {client.preferences}"

    alerts_result = await db.execute(select(Product).where(Product.stock_status.in_(["low", "critical"])))
    alerts = alerts_result.scalars().all()
    if alerts:
        system_context += f"\n\nAlertas de stock crítico: {', '.join([p.name for p in alerts])}"

    client_sdk = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client_sdk.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_context,
        messages=[{"role": "user", "content": data.message}]
    )
    return {"response": response.content[0].text, "model": "claude-sonnet-4-6"}

@router.post("/suggest-meeting-times")
async def suggest_times(data: ChatMessage, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, "AI not configured")
    client_sdk = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client_sdk.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": f"Sugiere 3 horarios de reunión para la próxima semana laboral. Contexto: {data.message}. Formato: lista con fecha, hora y duración."}]
    )
    return {"suggestions": response.content[0].text}
