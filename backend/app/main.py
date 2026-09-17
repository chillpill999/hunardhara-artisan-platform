import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("artisan_platform")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager: Initializes database tables and creates static directories.
    """
    logger.info("Initializing MoSJE Artisan Platform backend...")
    
    # 1. Initialize database models/tables
    try:
        init_db()
        logger.info("Database schemas verified.")
        should_auto_seed = settings.OFFLINE_MODE or os.getenv("AUTO_SEED", "false").lower() in ("true", "1")
        if should_auto_seed:
            try:
                from app.core.database import SessionLocal
                from app.models.craft_cluster import CraftCluster
                from db.seeds.seed_craft_clusters import seed_database
                with SessionLocal() as db:
                    if db.query(CraftCluster).count() == 0:
                        logger.info("Database clusters empty and auto-seed enabled, running seed...")
                        seed_database()
            except Exception as seed_err:
                logger.warning(f"Auto-seed skipped or non-critical error: {seed_err}")
        else:
            logger.info("Automatic database seeding is disabled for production data integrity.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        
    # 2. Ensure static file directories exist
    static_dirs = [
        settings.STATIC_DIR,
        os.path.join(settings.STATIC_DIR, "uploads"),
        os.path.join(settings.STATIC_DIR, "studio"),
        os.path.join(settings.STATIC_DIR, "studio_outputs"),
        os.path.join(settings.STATIC_DIR, "profiles"),
        os.path.join(settings.STATIC_DIR, "benchmarks"),
    ]
    for sdir in static_dirs:
        os.makedirs(sdir, exist_ok=True)
        
    logger.info("MoSJE Artisan Platform backend started successfully.")
    yield
    logger.info("Shutting down MoSJE Artisan Platform backend.")


# Initialize FastAPI ASGI Application
app = FastAPI(
    title="MoSJE AI-Driven Artisan Market Linkage & Smart Cataloging Platform",
    description=(
        "Smart India Hackathon 2026 (Problem Statement SIH26090) — "
        "Ministry of Social Justice and Empowerment (MoSJE).\n\n"
        "Empowering rural, marginalized Indian artisans to turn a single unedited craft photo "
        "and regional voice recording into an e-commerce catalog with certified fair market pricing "
        "and direct B2B market linkages ('Speak. Snap. Sell.')."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS Middleware Configuration (Supporting Next.js 15 Web & Flutter Mobile Clients)
trusted_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://hunardhara.technogamerzthenextlevel.workers.dev",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=trusted_origins,
    allow_origin_regex=r"https://.*\.workers\.dev",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Mount Static Files for Uploads, Studio Previews, and Benchmarks
os.makedirs(settings.STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")

# Mount API v1 Routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root & Discovery"])
def root():
    """
    Root discovery endpoint providing platform metadata and navigation links.
    """
    return {
        "project": "MoSJE AI Artisan Market Linkage & Smart Cataloging Platform",
        "tagline": "Speak. Snap. Sell.",
        "hackathon": "Smart India Hackathon 2026 (SIH26090)",
        "ministry": "Ministry of Social Justice and Empowerment (MoSJE)",
        "version": "1.0.0",
        "interactive_docs": "/docs",
        "redoc_docs": "/redoc",
        "health_endpoint": f"{settings.API_V1_STR}/health",
        "craft_clusters_endpoint": f"{settings.API_V1_STR}/clusters",
        "environment": settings.ENVIRONMENT,
        "offline_mock_mode": settings.OFFLINE_MODE
    }


@app.get("/health", tags=["Root & Discovery"])
def root_health():
    """
    Root level health check endpoint for standard container probes.
    """
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "docs": "/docs"
        }
    )
