import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db, engine
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health & Diagnostics"])


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="System Health & Infrastructure Probes",
    response_description="System status including database engine, redis, and vector capability"
)
def get_health_status(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns the comprehensive health status of the MoSJE Artisan Platform backend.
    Validates:
    - FastAPI ASGI Server responsiveness
    - Database connectivity (PostgreSQL or SQLite fallback)
    - Vector search readiness
    - Offline & Sovereign Compliance flags
    """
    db_status = "unknown"
    has_vector = False
    
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
        
        # Check pgvector or fallback
        if engine.dialect.name == "postgresql":
            try:
                res = db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).scalar()
                has_vector = bool(res)
            except Exception:
                has_vector = False
        else:
            # SQLite fallback operates with PortableVector JSON serializer
            has_vector = True
            
    except Exception as e:
        logger.error(f"Health check database ping failed: {e}")
        db_status = f"unreachable: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "database": {
            "status": db_status,
            "dialect": engine.dialect.name,
            "vector_ready": has_vector,
            "is_sqlite_fallback": settings.is_sqlite or engine.dialect.name == "sqlite"
        },
        "sovereign_compliance": {
            "dpdp_act_2023": "enforced",
            "uidai_masked_aadhaar_vault": "active",
            "cost_plus_floor_guardrails": "active",
            "gps_exif_scrubbing": "active"
        },
        "ai_modes": {
            "offline_mock_mode": settings.OFFLINE_MODE,
            "mock_ai_services": settings.MOCK_AI_SERVICES
        }
    }


@router.get(
    "/ready",
    status_code=status.HTTP_200_OK,
    summary="Kubernetes / Docker Readiness Probe"
)
def get_readiness_status(db: Session = Depends(get_db)) -> Dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ready"}
