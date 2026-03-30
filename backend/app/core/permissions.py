"""
Permisos por módulo (estilo AgendaPro).

Roles en tienda (StoreMemberRole), alineados con negocio:
- admin → Gerente de tienda: configura sucursales, servicios, profesionales, reportes.
- seller → Recepcionista: ve todas las agendas de la tienda y gestiona reservas.
- operator → Trabajador: ve su agenda (vía profesional vinculado) y marca asistencia.

Rol global (UserRole):
- admin → Admin global: puede gestionar usuarios y permisos a nivel sistema (endpoints dedicados).
"""

from __future__ import annotations

from typing import FrozenSet

from app.models.store import StoreMember, StoreMemberRole

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
# Clientes vistos en la propia agenda (profesional); el gerente puede quitar este permiso en el miembro
VER_CLIENTES_PROPIOS = "ver_clientes_propios"
GESTIONAR_CLIENTES = "gestionar_clientes"
VER_FICHAS = "ver_fichas"
CREAR_FICHAS = "crear_fichas"
EDITAR_FICHAS = "editar_fichas"
ELIMINAR_FICHAS = "eliminar_fichas"
VER_MARKETING_EMAIL = "ver_marketing_email"
VER_CAMPOS_PERSONALIZADOS = "ver_campos_personalizados"
EDITAR_CAMPOS_PERSONALIZADOS = "editar_campos_personalizados"

# Incluye lectura de sucursales/profesionales/servicios/horarios para operar la agenda
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


def _default_permissions_for_role(role: StoreMemberRole) -> FrozenSet[str]:
    if role == StoreMemberRole.ADMIN:
        return ALL_STORE_PERMISSIONS
    if role == StoreMemberRole.SELLER:
        # Recepcionista (edición): comparable a AgendaPro recepcionista
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
    # operator → trabajador: agenda propia vía /scheduling/staff/* (profesional vinculado)
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
    """Lista efectiva: override en StoreMember.permissions o defaults por rol."""
    raw = member.permissions
    if raw is not None and isinstance(raw, list):
        return frozenset(str(p) for p in raw if p)
    return _default_permissions_for_role(member.role)
