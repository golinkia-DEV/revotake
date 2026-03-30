"""Subida de logotipo de tienda e imágenes de servicios (máx. 5 por servicio)."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import StoreContext, require_store_admin
from app.core.uploads_util import absolute_upload_url
from app.models.scheduling import Service

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
EXT_BY_TYPE = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_BYTES = settings.MAX_UPLOAD_IMAGE_MB * 1024 * 1024
MAX_SERVICE_IMAGES = 5


def _upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _validate_image(file: UploadFile, data: bytes) -> str:
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Solo se permiten imágenes JPEG, PNG o WebP")
    if len(data) > MAX_BYTES:
        raise HTTPException(400, f"Archivo demasiado grande (máx. {settings.MAX_UPLOAD_IMAGE_MB} MB)")
    return ct


def _disk_path_for_service_image(store_id: str, service_id: str, url: str) -> Path | None:
    marker = f"/uploads/stores/{store_id}/services/{service_id}/"
    if marker not in url:
        return None
    fname = url.split(marker, 1)[1]
    if not fname or "/" in fname or ".." in fname:
        return None
    base = _upload_root() / "stores" / store_id / "services" / service_id
    p = (base / fname).resolve()
    try:
        base_r = base.resolve()
        if not str(p).startswith(str(base_r)):
            return None
    except OSError:
        return None
    return p


@router.post("/store-logo")
async def upload_store_logo(
    file: UploadFile = File(...),
    ctx: StoreContext = Depends(require_store_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await file.read()
    ct = _validate_image(file, data)
    ext = EXT_BY_TYPE[ct]
    store_dir = _upload_root() / "stores" / ctx.store_id
    store_dir.mkdir(parents=True, exist_ok=True)
    for old in store_dir.glob("logo.*"):
        try:
            old.unlink()
        except OSError:
            pass
    rel = f"/uploads/stores/{ctx.store_id}/logo{ext}"
    path = store_dir / f"logo{ext}"
    path.write_bytes(data)
    url = absolute_upload_url(rel)
    settings_json = dict(ctx.store.settings or {})
    profile = dict(settings_json.get("store_profile") or {})
    branding = dict(profile.get("branding") or {})
    branding["logo_url"] = url
    profile["branding"] = branding
    settings_json["store_profile"] = profile
    ctx.store.settings = settings_json
    await db.commit()
    return {"path": rel, "url": url}


@router.post("/service-images/{service_id}")
async def upload_service_image(
    service_id: str,
    file: UploadFile = File(...),
    ctx: StoreContext = Depends(require_store_admin),
    db: AsyncSession = Depends(get_db),
):
    svc = await db.get(Service, service_id)
    if not svc or svc.store_id != ctx.store_id:
        raise HTTPException(404, "Servicio no encontrado")
    urls = list(svc.image_urls) if isinstance(svc.image_urls, list) else []
    if len(urls) >= MAX_SERVICE_IMAGES:
        raise HTTPException(400, f"Máximo {MAX_SERVICE_IMAGES} imágenes por servicio")

    data = await file.read()
    ct = _validate_image(file, data)
    ext = EXT_BY_TYPE[ct]
    uid = uuid.uuid4().hex
    svc_dir = _upload_root() / "stores" / ctx.store_id / "services" / service_id
    svc_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{uid}{ext}"
    path = svc_dir / fname
    path.write_bytes(data)
    rel = f"/uploads/stores/{ctx.store_id}/services/{service_id}/{fname}"
    url = absolute_upload_url(rel)
    urls.append(url)
    svc.image_urls = urls
    await db.commit()
    return {"url": url, "path": rel, "image_urls": urls}


class RemoveServiceImageBody(BaseModel):
    url: str = Field(..., min_length=8)


@router.delete("/service-images/{service_id}")
async def remove_service_image(
    service_id: str,
    body: RemoveServiceImageBody,
    ctx: StoreContext = Depends(require_store_admin),
    db: AsyncSession = Depends(get_db),
):
    svc = await db.get(Service, service_id)
    if not svc or svc.store_id != ctx.store_id:
        raise HTTPException(404, "Servicio no encontrado")
    urls = list(svc.image_urls) if isinstance(svc.image_urls, list) else []
    if body.url not in urls:
        raise HTTPException(400, "La URL no está en este servicio")

    disk = _disk_path_for_service_image(ctx.store_id, service_id, body.url)
    if disk and disk.is_file():
        try:
            disk.unlink()
        except OSError:
            pass

    urls = [u for u in urls if u != body.url]
    svc.image_urls = urls
    await db.commit()
    return {"image_urls": urls}
