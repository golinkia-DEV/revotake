"""Webhooks de pasarelas de pago (MercadoPago + WebPay Plus)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.scheduling import (
    Appointment,
    AppointmentStatus,
    PaymentAttempt,
    PaymentAttemptStatus,
    PaymentStatus,
)
from app.services import payment_mercadopago as mp_svc

logger = logging.getLogger(__name__)
router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _confirm_appointment(appt: Appointment, attempt: PaymentAttempt) -> None:
    appt.status = AppointmentStatus.CONFIRMED.value
    appt.payment_status = PaymentStatus.PAID.value
    appt.hold_expires_at = None
    attempt.status = PaymentAttemptStatus.SUCCEEDED.value
    attempt.updated_at = _now()


# ─────────────────────────────────────────────────────────────────────────────
# MercadoPago IPN
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/mercadopago")
async def webhook_mercadopago(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_signature: str | None = Header(None, alias="x-signature"),
    x_request_id: str | None = Header(None, alias="x-request-id"),
    data_id: str | None = Query(None, alias="data.id"),
):
    """
    Recibe notificaciones IPN de MercadoPago.
    Verifica firma x-signature y actualiza el PaymentAttempt + Appointment.
    """
    body = await request.body()

    # Verificar firma
    if not mp_svc.verify_webhook_signature(body, x_signature, x_request_id, data_id):
        logger.warning("MP webhook firma inválida — x-signature=%s data.id=%s", x_signature, data_id)
        raise HTTPException(400, "Firma inválida")

    payload: dict = {}
    try:
        import json
        payload = json.loads(body)
    except Exception:
        raise HTTPException(400, "Body inválido")

    topic = payload.get("type") or payload.get("topic", "")
    resource_id = data_id or (payload.get("data", {}) or {}).get("id")

    logger.info("MP IPN tipo=%s resource_id=%s", topic, resource_id)

    # Solo procesamos pagos
    if topic not in ("payment", "merchant_order"):
        return {"received": True, "skipped": True}

    if not resource_id:
        return {"received": True, "skipped": True, "reason": "no_resource_id"}

    # Fetch payment desde MP
    try:
        payment = await mp_svc.get_payment(resource_id)
    except Exception as exc:
        logger.error("MP get_payment(%s) error: %s", resource_id, exc)
        raise HTTPException(502, "No se pudo consultar el pago en MercadoPago")

    external_ref = payment.get("external_reference") or ""
    mp_status = payment.get("status", "")

    # Buscar PaymentAttempt por preference_id (external_id) o external_reference (appointment_id)
    r = await db.execute(
        select(PaymentAttempt).where(
            PaymentAttempt.provider == "mercadopago",
            PaymentAttempt.appointment_id == external_ref,
        )
    )
    attempt = r.scalar_one_or_none()

    if not attempt:
        logger.warning("MP IPN: no se encontró PaymentAttempt para appointment_id=%s", external_ref)
        return {"received": True, "skipped": True, "reason": "attempt_not_found"}

    # Actualizar raw_payload con últimos datos
    attempt.raw_payload = {**attempt.raw_payload, "last_payment": payment, "mp_payment_id": str(resource_id)}

    appt = await db.get(Appointment, attempt.appointment_id)

    if mp_status == "approved":
        if appt:
            _confirm_appointment(appt, attempt)
        else:
            attempt.status = PaymentAttemptStatus.SUCCEEDED.value
    elif mp_status in ("rejected", "cancelled"):
        attempt.status = PaymentAttemptStatus.FAILED.value
    elif mp_status == "refunded":
        attempt.status = PaymentAttemptStatus.REFUNDED.value
        if appt:
            appt.payment_status = PaymentStatus.REFUNDED.value
    # pending / in_process → no cambiar estado

    await db.commit()
    return {"received": True, "mp_status": mp_status}


# ─────────────────────────────────────────────────────────────────────────────
# Dev helper (solo desarrollo)
# ─────────────────────────────────────────────────────────────────────────────

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
    await db.commit()
    return {"ok": True}
