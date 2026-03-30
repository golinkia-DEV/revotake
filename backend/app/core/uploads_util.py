"""URLs públicas para archivos subidos (logos, fotos de servicios)."""

from app.core.config import settings


def public_api_origin() -> str:
    """Origen sin /api/v1, p. ej. http://localhost:8001."""
    b = (settings.PUBLIC_API_BASE or "").rstrip("/")
    if b.endswith("/api/v1"):
        return b[: -len("/api/v1")] or "http://localhost:8001"
    return b.replace("/api/v1", "").rstrip("/") or "http://localhost:8001"


def absolute_upload_url(relative_path: str) -> str:
    rel = relative_path if relative_path.startswith("/") else f"/{relative_path}"
    return f"{public_api_origin()}{rel}"
