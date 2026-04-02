"""Integración MercadoPago Checkout Pro via REST API."""
from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

MP_API_BASE = "https://api.mercadopago.com"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "X-Idempotency-Key": "",
    }


async def create_preference(
    *,
    title: str,
    amount_cents: int,
    currency: str,
    external_reference: str,
    back_url_success: str,
    back_url_failure: str,
    back_url_pending: str,
    notification_url: str,
    payer_email: str | None = None,
) -> dict[str, Any]:
    """
    Crea una preferencia de pago en MercadoPago.
    Retorna {init_point, sandbox_init_point, preference_id}.
    """
    unit_price = round(amount_cents / 100, 2)
    body: dict[str, Any] = {
        "items": [
            {
                "title": title[:256],
                "quantity": 1,
                "unit_price": unit_price,
                "currency_id": currency,
            }
        ],
        "external_reference": external_reference,
        "back_urls": {
            "success": back_url_success,
            "failure": back_url_failure,
            "pending": back_url_pending,
        },
        "auto_return": "approved",
        "notification_url": notification_url,
        "binary_mode": True,
    }
    if payer_email:
        body["payer"] = {"email": payer_email}

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            f"{MP_API_BASE}/checkout/preferences",
            headers=_headers(),
            json=body,
        )

    if resp.status_code not in (200, 201):
        logger.error("MP create_preference error %s: %s", resp.status_code, resp.text)
        raise RuntimeError(f"MercadoPago error {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    return {
        "preference_id": data["id"],
        "init_point": data["init_point"],
        "sandbox_init_point": data.get("sandbox_init_point", data["init_point"]),
    }


async def get_payment(payment_id: str) -> dict[str, Any]:
    """Obtiene estado de un pago por su ID."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{MP_API_BASE}/v1/payments/{payment_id}",
            headers=_headers(),
        )
    if resp.status_code != 200:
        raise RuntimeError(f"MP get_payment error {resp.status_code}")
    return resp.json()


def verify_webhook_signature(
    body: bytes,
    x_signature: str | None,
    x_request_id: str | None,
    data_id: str | None,
) -> bool:
    """
    Verifica la firma x-signature de un webhook MP.
    Formato: ts=...,v1=<HMAC-SHA256>
    Mensaje: id:<data_id>;request-id:<x_request_id>;ts:<ts>;
    """
    secret = settings.MERCADOPAGO_WEBHOOK_SECRET.strip()
    if not secret:
        # Si no hay secreto configurado, aceptamos (ambiente dev)
        logger.warning("MERCADOPAGO_WEBHOOK_SECRET no configurado — omitiendo verificación de firma")
        return True
    if not x_signature:
        return False

    ts: str | None = None
    v1: str | None = None
    for part in x_signature.split(","):
        part = part.strip()
        if part.startswith("ts="):
            ts = part[3:]
        elif part.startswith("v1="):
            v1 = part[3:]

    if not ts or not v1:
        return False

    # Construir el mensaje según documentación MP
    msg_parts = []
    if data_id:
        msg_parts.append(f"id:{data_id}")
    if x_request_id:
        msg_parts.append(f"request-id:{x_request_id}")
    msg_parts.append(f"ts:{ts}")
    message = ";".join(msg_parts) + ";"

    expected = hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()  # type: ignore[attr-defined]

    return hmac.compare_digest(expected, v1)
