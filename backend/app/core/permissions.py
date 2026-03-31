"""Permisos y helpers RBAC (legacy + jerarquía nueva)."""

from __future__ import annotations

from typing import FrozenSet

from app.models.store import StoreMember, StoreMemberRole
from app.models.user import UserRole

# --- Claves de permiso (snake_case, estables para API y JWT) ---

VER_AGENDA_TIENDA = "ver_agenda_tienda"
VER_AGENDA_PROPIA = "ver_agenda_propia"
VER_AGENDA_GRUPO = "ver_agenda_grupo"
CREAR_CITA = "crear_cita"
EDITAR_CITA = "editar_cita"
ELIMINAR_CITA = "eliminar_cita"
GESTIONAR_BLOQUEOS = "gestionar_bloqueos"
VER_REPORTES = "ver_reportes"
VER_REPORTES_PAGOS = "ver_reportes_pagos"
VER_REPORTES_COMISIONES = "ver_reportes_comisiones"
EXPORTAR_REGISTROS = "exportar_registros"
REGISTRAR_VENTAS = "registrar_ventas"
VER_BASE_CLIENTES = "ver_base_clientes"
VER_CLIENTES_PROPIOS = "ver_clientes_propios"
GESTIONAR_CLIENTES = "gestionar_clientes"
VER_FICHAS = "ver_fichas"
CREAR_FICHAS = "crear_fichas"
EDITAR_FICHAS = "editar_fichas"
ELIMINAR_FICHAS = "eliminar_fichas"
VER_MARKETING_EMAIL = "ver_marketing_email"
VER_CAMPOS_PERSONALIZADOS = "ver_campos_personalizados"
EDITAR_CAMPOS_PERSONALIZADOS = "editar_campos_personalizados"
VER_CATALOGO_AGENDA = "ver_catalogo_agenda"

ALL_STORE_PERMISSIONS: FrozenSet[str] = frozenset(
    {
        VER_AGENDA_TIENDA,
        VER_AGENDA_PROPIA,
        VER_AGENDA_GRUPO,
        CREAR_CITA,
        EDITAR_CITA,
        ELIMINAR_CITA,
        GESTIONAR_BLOQUEOS,
        VER_REPORTES,
        VER_REPORTES_PAGOS,
        VER_REPORTES_COMISIONES,
        EXPORTAR_REGISTROS,
        REGISTRAR_VENTAS,
        VER_BASE_CLIENTES,
        VER_CLIENTES_PROPIOS,
        GESTIONAR_CLIENTES,
        VER_FICHAS,
        CREAR_FICHAS,
        EDITAR_FICHAS,
        ELIMINAR_FICHAS,
        VER_MARKETING_EMAIL,
        VER_CAMPOS_PERSONALIZADOS,
        EDITAR_CAMPOS_PERSONALIZADOS,
        VER_CATALOGO_AGENDA,
    }
)

# --- Permisos de plataforma ---
PLATFORM_VIEW_DASHBOARD = "platform_view_dashboard"
PLATFORM_MANAGE_STORES = "platform_manage_stores"
PLATFORM_MANAGE_PLANS = "platform_manage_plans"
PLATFORM_MANAGE_GLOBAL_PAYMENTS = "platform_manage_global_payments"
PLATFORM_MANAGE_USERS = "platform_manage_users"
PLATFORM_MANAGE_NOTIFICATIONS = "platform_manage_notifications"
PLATFORM_VIEW_FINANCE = "platform_view_finance"
PLATFORM_EXPORT_FINANCE = "platform_export_finance"

ALL_PLATFORM_PERMISSIONS: FrozenSet[str] = frozenset(
    {
        PLATFORM_VIEW_DASHBOARD,
        PLATFORM_MANAGE_STORES,
        PLATFORM_MANAGE_PLANS,
        PLATFORM_MANAGE_GLOBAL_PAYMENTS,
        PLATFORM_MANAGE_USERS,
        PLATFORM_MANAGE_NOTIFICATIONS,
        PLATFORM_VIEW_FINANCE,
        PLATFORM_EXPORT_FINANCE,
    }
)


def normalize_global_role(role: UserRole) -> str:
    if role in (UserRole.ADMIN, UserRole.PLATFORM_ADMIN):
        return UserRole.PLATFORM_ADMIN.value
    if role in (UserRole.OPERATOR, UserRole.PLATFORM_OPERATOR):
        return UserRole.PLATFORM_OPERATOR.value
    return role.value


def is_platform_admin(role: UserRole) -> bool:
    return normalize_global_role(role) == UserRole.PLATFORM_ADMIN.value


def is_platform_operator(role: UserRole) -> bool:
    return normalize_global_role(role) == UserRole.PLATFORM_OPERATOR.value


def normalize_store_member_role(role: StoreMemberRole) -> str:
    if role == StoreMemberRole.ADMIN:
        return StoreMemberRole.STORE_ADMIN.value
    if role == StoreMemberRole.SELLER:
        return StoreMemberRole.BRANCH_ADMIN.value
    if role == StoreMemberRole.OPERATOR:
        return StoreMemberRole.WORKER.value
    return role.value


def member_branch_scope(member: StoreMember) -> FrozenSet[str]:
    raw = member.branch_ids
    if not isinstance(raw, list):
        return frozenset()
    return frozenset(str(b).strip() for b in raw if str(b).strip())


def effective_platform_permissions(role: UserRole) -> FrozenSet[str]:
    normalized = normalize_global_role(role)
    if normalized == UserRole.PLATFORM_ADMIN.value:
        return ALL_PLATFORM_PERMISSIONS
    if normalized == UserRole.PLATFORM_OPERATOR.value:
        return frozenset({PLATFORM_VIEW_FINANCE, PLATFORM_EXPORT_FINANCE})
    return frozenset()


def _default_permissions_for_role(role: StoreMemberRole) -> FrozenSet[str]:
    normalized = normalize_store_member_role(role)
    if normalized == StoreMemberRole.STORE_ADMIN.value:
        return ALL_STORE_PERMISSIONS
    if normalized == StoreMemberRole.BRANCH_ADMIN.value:
        return frozenset(
            {
                VER_AGENDA_TIENDA,
                VER_CATALOGO_AGENDA,
                CREAR_CITA,
                EDITAR_CITA,
                ELIMINAR_CITA,
                GESTIONAR_BLOQUEOS,
                VER_REPORTES,
                VER_REPORTES_PAGOS,
                EXPORTAR_REGISTROS,
                REGISTRAR_VENTAS,
                VER_BASE_CLIENTES,
                VER_CLIENTES_PROPIOS,
                GESTIONAR_CLIENTES,
                VER_FICHAS,
                CREAR_FICHAS,
                EDITAR_FICHAS,
                ELIMINAR_FICHAS,
                VER_MARKETING_EMAIL,
                VER_CAMPOS_PERSONALIZADOS,
                EDITAR_CAMPOS_PERSONALIZADOS,
            }
        )
    if normalized == StoreMemberRole.BRANCH_OPERATOR.value:
        return frozenset(
            {
                VER_REPORTES,
                VER_REPORTES_PAGOS,
                VER_REPORTES_COMISIONES,
                EXPORTAR_REGISTROS,
            }
        )
    return frozenset(
        {
            VER_AGENDA_PROPIA,
            VER_CLIENTES_PROPIOS,
            VER_REPORTES_COMISIONES,
            VER_FICHAS,
            VER_CAMPOS_PERSONALIZADOS,
        }
    )


def effective_permissions(member: StoreMember) -> FrozenSet[str]:
    raw = member.permissions
    if raw is not None and isinstance(raw, list):
        return frozenset(str(p) for p in raw if p)
    return _default_permissions_for_role(member.role)
