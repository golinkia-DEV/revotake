"""Integración WebPay Plus (Transbank) via REST API."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_SANDBOX_BASE = "https://webpay3gint.transbank.cl"
_PROD_BASE = "https://webpay3g.transbank.cl"
_PATH_INIT = "/rswebpaytransaction/api/webpay/v1.2/transactions"


def _base() -> str:
    return _SANDBOX_BASE if settings.WEBPAY_SANDBOX else _PROD_BASE


def _headers() -> dict[str, str]:
    return {
        "Tbk-Api-Key-Id": settings.WEBPAY_COMMERCE_CODE,
        "Tbk-Api-Key-Secret": settings.WEBPAY_API_KEY,
        "Content-Type": "application/json",
    }


async def init_transaction(
    *,
    buy_order: str,
    session_id: str,
    amount: int,
    return_url: str,
) -> dict[str, Any]:
    """
    Inicia una transacción WebPay Plus.
    Retorna {token, url} donde url es el formulario de pago Transbank.
    """
    body = {
        "buy_order": buy_order[:26],
        "session_id": session_id[:61],
        "amount": amount,
        "return_url": return_url,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            f"{_base()}{_PATH_INIT}",
            headers=_headers(),
            json=body,
        )
    if resp.status_code not in (200, 201):
        logger.error("WebPay init_transaction error %s: %s", resp.status_code, resp.text)
        raise RuntimeError(f"WebPay error {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    return {"token": data["token"], "url": data["url"]}


async def confirm_transaction(token: str) -> dict[str, Any]:
    """
    Confirma (PUT) la transacción tras el retorno del banco.
    Retorna el objeto completo de Transbank con status, amount, etc.
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.put(
            f"{_base()}{_PATH_INIT}/{token}",
            headers=_headers(),
        )
    if resp.status_code not in (200, 201):
        logger.error("WebPay confirm_transaction error %s: %s", resp.status_code, resp.text)
        raise RuntimeError(f"WebPay confirm error {resp.status_code}: {resp.text[:300]}")
    return resp.json()


async def refund_transaction(token: str, amount: int) -> dict[str, Any]:
    """Reversa / anulación parcial o total de una transacción."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            f"{_base()}{_PATH_INIT}/{token}/refunds",
            headers=_headers(),
            json={"amount": amount},
        )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"WebPay refund error {resp.status_code}: {resp.text[:200]}")
    return resp.json()
