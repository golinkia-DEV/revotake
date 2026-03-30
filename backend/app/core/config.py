from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://revotake:revotake123@postgres:5432/revotake"
    REDIS_URL: str = "redis://redis:6379/0"
    SECRET_KEY: str = "super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    ALLOW_OPEN_REGISTRATION: bool = False
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://revotake.vercel.app", "https://revotake.golinkia.com"]
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "RevoTake"
    FRONTEND_URL: str = "https://revotake.vercel.app"
    # Base pública de la API (sin barra final), p. ej. https://api.tudominio.com/api/v1 — usada en enlaces del correo de confirmación
    PUBLIC_API_BASE: str = "http://localhost:8001/api/v1"
    # Horas antes del inicio de la cita para enviar recordatorio y pedir confirmación (override por tienda en settings.agenda.reminder_hours_before)
    MEETING_REMINDER_HOURS_BEFORE: int = 24
    # Intervalo en segundos del worker que busca citas a recordar (también puedes usar POST .../internal/run-meeting-reminders con CRON_SECRET)
    MEETING_REMINDER_INTERVAL_SEC: int = 300
    CRON_SECRET: str = ""
    # Directorio para logos y fotos de servicios (persistir en volumen en producción)
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_IMAGE_MB: int = 5

    class Config:
        env_file = ".env"

settings = Settings()
