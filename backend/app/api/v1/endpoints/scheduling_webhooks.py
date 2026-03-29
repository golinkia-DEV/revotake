"""Webhooks de pasarelas (stubs listos para Stripe / Mercado Pago)."""
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.scheduling import PaymentAttempt, Appointment, AppointmentStatus, PaymentStatus, PaymentAttemptStatus

router = APIRouter()


@router.post("/stripe")
async def webhook_stripe(
    request: Request,
    db: AsyncSession = Depends(get_db),
    stripe_signature: str | None = Header(None, alias="Stripe-Signature"),
):
    """
    Stub: en producción verificar firma y parsear evento payment_intent.succeeded.
    Aquí se documenta el flujo esperado.
    """
    _ = stripe_signature
    body = await request.body()
    return {
        "received": True,
        "bytes": len(body),
        "message": "Implementar con stripe-python: confirmar PaymentAttempt y pasar cita a confirmed",
    }


@router.post("/mercadopago")
async def webhook_mercadopago(request: Request, db: AsyncSession = Depends(get_db)):
    _ = db
    body = await request.body()
    return {"received": True, "bytes": len(body), "message": "Implementar notificaciones IPN Mercado Pago"}


@router.post("/dev/confirm-payment/{payment_attempt_id}")
async def dev_confirm_payment(
    payment_attempt_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Solo desarrollo: marca pago OK y confirma cita (no usar en producción)."""
    p = await db.get(PaymentAttempt, payment_attempt_id)
    if not p:
        raise HTTPException(404, "Intento no encontrado")
    p.status = PaymentAttemptStatus.SUCCEEDED.value
    appt = await db.get(Appointment, p.appointment_id)
    if appt:
        appt.status = AppointmentStatus.CONFIRMED.value
        appt.payment_status = PaymentStatus.PAID.value
        appt.hold_expires_at = None
    return {"ok": True}
