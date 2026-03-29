from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scheduling import AppointmentAuditLog


async def log_appointment_action(
    db: AsyncSession,
    *,
    appointment_id: str,
    store_id: str,
    action: str,
    actor_user_id: str | None,
    payload: dict[str, Any] | None = None,
) -> None:
    db.add(
        AppointmentAuditLog(
            appointment_id=appointment_id,
            store_id=store_id,
            actor_user_id=actor_user_id,
            action=action,
            payload=payload or {},
        )
    )
