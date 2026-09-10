import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "MoSJE AI Artisan Market Linkage Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security & Tokens
    SECRET_KEY: str = "mosje_super_secret_jwt_key_sih2026_artisan_platform_dev"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    AADHAAR_PEPPER_KEY: str = "mosje_sovereign_aadhaar_pepper_secret_2026"

    # Database Configuration
    # Defaults to SQLite for immediate local testing if Postgres is not configured
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./artisan_platform.db"
    )
    SYNC_DATABASE_URL: Optional[str] = os.getenv(
        "SYNC_DATABASE_URL",
        None
    )

    # Redis & Celery
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

    # AI Services Configuration
    OFFLINE_MODE: bool = True
    MOCK_AI_SERVICES: bool = True

    # Bhashini ULCA API Credentials (Optional)
    BHASHINI_API_KEY: Optional[str] = None
    BHASHINI_USER_ID: Optional[str] = None
    BHASHINI_PIPELINE_ID: Optional[str] = None

    # Storage & File Uploads
    STATIC_DIR: str = os.getenv("STATIC_DIR", "./static")
    UPLOAD_MAX_SIZE_MB: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL.lower()

    @property
    def sync_db_url(self) -> str:
        if self.SYNC_DATABASE_URL:
            return self.SYNC_DATABASE_URL
        if self.is_sqlite:
            # Strip aiosqlite if present
            return self.DATABASE_URL.replace("+aiosqlite", "")
        # Convert asyncpg to standard psycopg2 / postgresql if needed
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


settings = Settings()
