from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://revotake:revotake123@postgres:5432/revotake"
    REDIS_URL: str = "redis://redis:6379/0"
    SECRET_KEY: str = "super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    ANTHROPIC_API_KEY: str = ""
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://revotake.vercel.app", "https://revotake.golinkia.com"]
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FRONTEND_URL: str = "https://revotake.vercel.app"

    class Config:
        env_file = ".env"

settings = Settings()
