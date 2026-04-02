"""Endpoints de checkout de pago para citas (MercadoPago + WebPay Plus)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.scheduling import (
    Appointment,
    AppointmentStatus,
    PaymentAttempt,
    PaymentAttemptStatus,
    PaymentStatus,
    Service,
)
from app.models.store import Store
from app.services import payment_mercadopago as mp_svc
from app.services import payment_webpay as wp_svc

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _get_store_by_slug(db: AsyncSession, slug: str) -> Store:
    r = await db.execute(select(Store).where(Store.slug == slug, Store.is_active.is_(True)))
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Tienda no encontrada")
    return s


async def _get_pending_appointment(db: AsyncSession, appointment_id: str, store_id: str) -> Appointment:
    appt = await db.get(Appointment, appointment_id)
    if not appt or appt.store_id != store_id:
        raise HTTPException(404, "Cita no encontrada")
    if appt.status != AppointmentStatus.PENDING_PAYMENT.value:
        raise HTTPException(400, "La cita no está en estado pendiente de pago")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if appt.hold_expires_at and appt.hold_expires_at < now:
        raise HTTPException(400, "El tiempo de reserva ha expirado, intenta de nuevo")
    return appt


def _confirm_appointment(appt: Appointment, payment_attempt: PaymentAttempt) -> None:
    appt.status = AppointmentStatus.CONFIRMED.value
    appt.payment_status = PaymentStatus.PAID.value
    appt.hold_expires_at = None
    payment_attempt.status = PaymentAttemptStatus.SUCCEEDED.value
    payment_attempt.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)


# ─────────────────────────────────────────────────────────────────────────────
# MercadoPago
# ─────────────────────────────────────────────────────────────────────────────

class MPCheckoutRequest(BaseModel):
    appointment_id: str
    payer_email: str | None = None


@router.post("/{store_slug}/checkout/mercadopago")
async def checkout_mercadopago(
    store_slug: str,
    body: MPCheckoutRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Crea una preferencia de MercadoPago para pagar el depósito de una cita.
    Retorna {init_point, sandbox_init_point, payment_attempt_id}.
    """
    access_token = settings.MERCADOPAGO_ACCESS_TOKEN.strip()
    if not access_token:
        raise HTTPException(503, "MercadoPago no configurado en este entorno")

    store = await _get_store_by_slug(db, store_slug)
    appt = await _get_pending_appointment(db, body.appointment_id, store.id)

    svc = await db.get(Service, appt.service_id)
    deposit = svc.deposit_required_cents if svc else 0
    if deposit <= 0:
        raise HTTPException(400, "Este servicio no requiere depósito online")

    currency = svc.currency if svc else "CLP"
    title = f"{svc.name if svc else 'Reserva'} — {store.name}"
    base = settings.FRONTEND_URL.rstrip("/")
    api_base = settings.PUBLIC_API_BASE.rstrip("/")

    pref = await mp_svc.create_preference(
        title=title,
        amount_cents=deposit,
        currency=currency,
        external_reference=appt.id,
        back_url_success=f"{base}/book/manage/{appt.manage_token}?pago=ok",
        back_url_failure=f"{base}/book/manage/{appt.manage_token}?pago=error",
        back_url_pending=f"{base}/book/manage/{appt.manage_token}?pago=pendiente",
        notification_url=f"{api_base}/webhooks/scheduling/mercadopago",
        payer_email=body.payer_email,
    )

    attempt = PaymentAttempt(
        store_id=store.id,
        appointment_id=appt.id,
        provider="mercadopago",
        amount_cents=deposit,
        currency=currency,
        status=PaymentAttemptStatus.PENDING.value,
        external_id=pref["preference_id"],
        raw_payload=pref,
    )
    db.add(attempt)
    await db.commit()

    return {
        "payment_attempt_id": attempt.id,
        "preference_id": pref["preference_id"],
        "init_point": pref["init_point"],
        "sandbox_init_point": pref["sandbox_init_point"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# WebPay Plus
# ─────────────────────────────────────────────────────────────────────────────

class WPCheckoutRequest(BaseModel):
    appointment_id: str


@router.post("/{store_slug}/checkout/webpay")
async def checkout_webpay(
    store_slug: str,
    body: WPCheckoutRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Inicia una transacción WebPay Plus.
    Retorna {token, url} — el frontend debe hacer redirect a url?token_ws=token.
    """
    commerce_code = settings.WEBPAY_COMMERCE_CODE.strip()
    api_key = settings.WEBPAY_API_KEY.strip()
    if not commerce_code or not api_key:
        raise HTTPException(503, "WebPay Plus no configurado en este entorno")

    store = await _get_store_by_slug(db, store_slug)
    appt = await _get_pending_appointment(db, body.appointment_id, store.id)

    svc = await db.get(Service, appt.service_id)
    deposit = svc.deposit_required_cents if svc else 0
    if deposit <= 0:
        raise HTTPException(400, "Este servicio no requiere depósito online")

    currency = svc.currency if svc else "CLP"
    amount_clp = round(deposit / 100)  # Transbank usa pesos enteros
    api_base = settings.PUBLIC_API_BASE.rstrip("/")

    buy_order = appt.id[:26]
    session_id = appt.manage_token[:61]

    tx = await wp_svc.init_transaction(
        buy_order=buy_order,
        session_id=session_id,
        amount=amount_clp,
        return_url=f"{api_base}/webhooks/scheduling/webpay/return",
    )

    attempt = PaymentAttempt(
        store_id=store.id,
        appointment_id=appt.id,
        provider="webpay",
        amount_cents=deposit,
        currency=currency,
        status=PaymentAttemptStatus.PENDING.value,
        external_id=tx["token"],
        raw_payload={"token": tx["token"], "url": tx["url"]},
    )
    db.add(attempt)
    await db.commit()

    return {
        "payment_attempt_id": attempt.id,
        "token": tx["token"],
        "url": tx["url"],
    }


@router.get("/webpay/return")
async def webpay_return(
    token_ws: str | None = Query(None),
    TBK_TOKEN: str | None = Query(None),  # noqa: N803
    TBK_ORDEN_COMPRA: str | None = Query(None),  # noqa: N803
    db: AsyncSession = Depends(get_db),
):
    """
    URL de retorno de WebPay Plus (GET). Confirma o rechaza la transacción.
    Hace redirect al frontend con el resultado.
    """
    # TBK_TOKEN presente → usuario canceló en el formulario Transbank
    effective_token = token_ws or TBK_TOKEN
    if not effective_token:
        base = settings.FRONTEND_URL.rstrip("/")
        return RedirectResponse(f"{base}/?pago=error&razon=sin_token")

    # Buscar PaymentAttempt por token
    r = await db.execute(
        select(PaymentAttempt).where(
            PaymentAttempt.provider == "webpay",
            PaymentAttempt.external_id == effective_token,
        )
    )
    attempt = r.scalar_one_or_none()
    base = settings.FRONTEND_URL.rstrip("/")

    if not attempt:
        return RedirectResponse(f"{base}/?pago=error&razon=intento_no_encontrado")

    appt = await db.get(Appointment, attempt.appointment_id)
    if not appt:
        return RedirectResponse(f"{base}/?pago=error&razon=cita_no_encontrada")

    manage_url = f"{base}/book/manage/{appt.manage_token}"

    # Si es TBK_TOKEN (anulado por usuario) sin token_ws → cancelado
    if TBK_TOKEN and not token_ws:
        attempt.status = PaymentAttemptStatus.FAILED.value
        attempt.raw_payload = {**attempt.raw_payload, "cancelled_by_user": True}
        await db.commit()
        return RedirectResponse(f"{manage_url}?pago=cancelado")

    try:
        confirmation = await wp_svc.confirm_transaction(effective_token)
    except Exception as exc:
        logger.error("WebPay confirm error: %s", exc)
        attempt.status = PaymentAttemptStatus.FAILED.value
        attempt.raw_payload = {**attempt.raw_payload, "confirm_error": str(exc)}
        await db.commit()
        return RedirectResponse(f"{manage_url}?pago=error")

    attempt.raw_payload = {**attempt.raw_payload, "confirmation": confirmation}

    status_code = confirmation.get("response_code", -1)
    vci = confirmation.get("vci", "")

    # response_code 0 = aprobado
    if status_code == 0 and vci not in ("TSY", "NP"):
        _confirm_appointment(appt, attempt)
        await db.commit()
        return RedirectResponse(f"{manage_url}?pago=ok")
    else:
        attempt.status = PaymentAttemptStatus.FAILED.value
        await db.commit()
        return RedirectResponse(f"{manage_url}?pago=rechazado")
