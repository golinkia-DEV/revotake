from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.store_type import StoreType
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

# Orden de rubros belleza / bienestar / salud (tipos nuevos); el resto al final por nombre.
_WELLNESS_SLUG_ORDER = (
    "centro-estetica",
    "barberia",
    "centro-medico",
    "manicure-pedicure",
    "peluqueria",
    "salon-belleza",
    "spa",
    "consulta-psicologica",
    "clinica-salud",
    "consultas-medicas",
    "fisioterapia",
    "terapia-alternativa",
    "veterinaria",
    "estilista-independiente",
    "clinica-odontologica",
    "cejas-pestanas",
    "centro-deportivo",
    "gimnasio",
    "consultorio",
    "meditacion-yoga",
    "crossfit",
    "estudio-danza",
    "personal-trainer",
    "generic",
)


def _type_sort_key(t: StoreType) -> tuple:
    try:
        idx = _WELLNESS_SLUG_ORDER.index(t.slug)
    except ValueError:
        idx = 10_000
    return (idx, t.name or "")


@router.get("/")
async def list_store_types(db: AsyncSession = Depends(get_db), _user: User = Depends(get_current_user)):
    result = await db.execute(select(StoreType))
    rows = list(result.scalars().all())
    rows.sort(key=_type_sort_key)
    return {
        "items": [
            {
                "id": t.id,
                "name": t.name,
                "slug": t.slug,
                "description": t.description,
                "icon": t.icon,
                "default_settings": t.default_settings,
            }
            for t in rows
        ]
    }
