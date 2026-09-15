import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "MoSJE AI Artisan Market Linkage Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Server-only security configuration. These values must be supplied by the
    # deployment secret manager; there are deliberately no development fallbacks.
    SUPABASE_JWT_SECRET: Optional[str] = None
    SUPABASE_JWT_ISSUER: Optional[str] = None
    SUPABASE_JWT_AUDIENCE: Optional[str] = None
    ADMIN_USER_IDS: str = ""
    AADHAAR_PEPPER_KEY: Optional[str] = None

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
    # Offline mock is disabled by default and allowed ONLY when explicitly enabled via OFFLINE_MODE=true
    OFFLINE_MODE: bool = os.getenv("OFFLINE_MODE", "false").lower() in ("true", "1")
    MOCK_AI_SERVICES: bool = os.getenv("MOCK_AI_SERVICES", "false").lower() in ("true", "1")

    # Bhashini ULCA API Credentials (Optional)
    BHASHINI_API_KEY: Optional[str] = None
    BHASHINI_USER_ID: Optional[str] = None
    BHASHINI_PIPELINE_ID: Optional[str] = None

    # Sarvam AI API Credentials
    SARVAM_API_KEY: Optional[str] = os.getenv("SARVAM_API_KEY", None)

    # OpenRouter AI Credentials (Gemma 4 31B Multimodal)
    OPENROUTER_API_KEY: Optional[str] = os.getenv("OPENROUTER_API_KEY", None)
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "google/gemma-4-31b-it:free")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

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

    @property
    def admin_user_ids(self) -> set[str]:
        """Configured Supabase subject IDs allowed to exercise administrator roles."""
        return {
            user_id.strip()
            for user_id in self.ADMIN_USER_IDS.split(",")
            if user_id.strip()
        }


settings = Settings()
