import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import init_db
from app.core.middleware import RequestIDAndLoggingMiddleware
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

    # 0. Enforce fail-fast production configuration check
    settings.validate_production_configuration()

    # 1. Initialize database models/tables
    try:
        init_db()
        logger.info("Database schemas verified.")
        should_auto_seed = (
            settings.ENVIRONMENT.lower() != "production"
            and (settings.OFFLINE_MODE or os.getenv("AUTO_SEED", "false").lower() in ("true", "1"))
        )
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
            logger.info("Automatic database seeding is permanently locked out in production for data integrity.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        
    # 2. Ensure public static file directories exist (strictly non-sensitive assets)
    static_dirs = [
        settings.STATIC_DIR,
        os.path.join(settings.STATIC_DIR, "studio"),
        os.path.join(settings.STATIC_DIR, "benchmarks"),
    ]
    for sdir in static_dirs:
        os.makedirs(sdir, exist_ok=True)

    # 3. Ensure private storage directories exist (outside public static mount)
    storage_dirs = [
        settings.STORAGE_DIR,
        os.path.join(settings.STORAGE_DIR, "profiles"),
        os.path.join(settings.STORAGE_DIR, "audio"),
        os.path.join(settings.STORAGE_DIR, "uploads"),
        os.path.join(settings.STORAGE_DIR, "studio_drafts"),
        os.path.join(settings.STORAGE_DIR, "internal"),
    ]
    for pdir in storage_dirs:
        os.makedirs(pdir, exist_ok=True)
        
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

# Production Hardening: Strict CORS Configuration
cors_origins = settings.cors_origins
is_production = settings.ENVIRONMENT.lower() == "production"

# In production, allow ONLY explicitly configured origins; never use broad wildcard regex
allow_origin_regex = None if is_production else r"https://.*\.workers\.dev"

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Authorization", "Content-Type", "Accept", "Origin",
        "X-Request-ID", "Idempotency-Key", "X-Idempotency-Key"
    ],
)

# Request ID & Structured Logging Middleware
app.add_middleware(RequestIDAndLoggingMiddleware)


from app.core.security import redact_sensitive_text

# Global Production Exception Handlers: Safe Error Responses & No Stack Trace Leaks
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    req_id = getattr(request.state, "request_id", "unknown")
    clean_errors = []
    for err in exc.errors():
        field_name = ".".join(str(loc) for loc in err.get("loc", []) if loc != "body")
        clean_errors.append({
            "field": field_name,
            "message": redact_sensitive_text(str(err.get("msg", "Validation error"))),
            "type": err.get("type", "value_error")
        })
    return JSONResponse(
        status_code=422,
        content={
            "error": "VALIDATION_ERROR",
            "detail": clean_errors,
            "request_id": req_id
        },
        headers={"X-Request-ID": req_id}
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    req_id = getattr(request.state, "request_id", "unknown")
    error_code = exc.detail if isinstance(exc.detail, str) and "_" in exc.detail and exc.detail.isupper() else f"HTTP_{exc.status_code}"
    headers = {"X-Request-ID": req_id}
    if getattr(exc, "headers", None):
        headers.update(exc.headers)
    safe_detail = redact_sensitive_text(str(exc.detail)) if isinstance(exc.detail, str) else exc.detail
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": error_code,
            "detail": safe_detail,
            "request_id": req_id
        },
        headers=headers
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "unknown")
    safe_exc = redact_sensitive_text(str(exc))
    logger.exception(f"UNHANDLED_EXCEPTION: request_id={req_id} path={request.url.path}: {safe_exc}")

    is_prod = settings.ENVIRONMENT.lower() == "production" or not settings.DEBUG
    safe_detail = "An internal server error occurred. Please contact support with the request ID." if is_prod else f"{type(exc).__name__}: {safe_exc}"

    return JSONResponse(
        status_code=500,
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "detail": safe_detail,
            "request_id": req_id
        },
        headers={"X-Request-ID": req_id}
    )


from starlette.responses import Response

DISALLOWED_STATIC_EXTENSIONS = {
    ".exe", ".dll", ".so", ".sh", ".bash", ".bat", ".cmd",
    ".py", ".pyc", ".pyd", ".php", ".phtml", ".pl", ".cgi",
    ".js", ".mjs", ".html", ".htm", ".xhtml", ".svg", ".xml",
    ".jsp", ".asp", ".aspx", ".vbs", ".ps1", ".env"
}

BLOCKED_STATIC_PREFIXES = ("profiles", "uploads", "audio", "internal")


class SecuredStaticFiles(StaticFiles):
    """
    Hardened StaticFiles handler:
    - Blocks access to private directory paths (profiles, uploads, audio, internal).
    - Blocks hidden files and dotfiles.
    - Prevents serving scripts and executable files.
    - Enforces X-Content-Type-Options: nosniff on all static assets.
    """
    async def get_response(self, path: str, scope) -> Response:
        norm_path = path.replace("\\", "/").strip("/")
        parts = [p for p in norm_path.split("/") if p]

        # 1. Block access to private directory names
        if any(part in BLOCKED_STATIC_PREFIXES for part in parts):
            return Response(status_code=403, content=b"FORBIDDEN: Private directory access blocked.")

        # 2. Block hidden files / dotfiles
        if any(part.startswith(".") for part in parts):
            return Response(status_code=403, content=b"FORBIDDEN: Hidden files cannot be accessed.")

        # 3. Block executable or script extensions
        _, ext = os.path.splitext(norm_path.lower())
        if ext in DISALLOWED_STATIC_EXTENSIONS:
            return Response(status_code=403, content=b"FORBIDDEN: Script or executable file serving is blocked.")

        response = await super().get_response(path, scope)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response


# Mount Hardened Static Files for Benchmarks and Public Studio Artifacts
os.makedirs(settings.STATIC_DIR, exist_ok=True)
app.mount("/static", SecuredStaticFiles(directory=settings.STATIC_DIR), name="static")

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


@app.get("/health", tags=["Root & Diagnostics"])
@app.get("/healthz", tags=["Root & Diagnostics"])
def root_liveness_probe():
    """
    Kubernetes / Container Liveness Probe:
    Fast in-memory check validating process responsiveness.
    Does NOT depend on database or external services.
    """
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "probe": "liveness",
            "service": settings.PROJECT_NAME,
            "version": "1.0.0"
        }
    )


@app.get("/ready", tags=["Root & Diagnostics"])
@app.get("/readyz", tags=["Root & Diagnostics"])
def root_readiness_probe():
    """
    Kubernetes / Container Readiness Probe:
    Verifies that the application is fully ready to accept user traffic.
    Checks database connectivity and storage directory accessibility.
    Returns HTTP 200 when ready, HTTP 503 if any critical dependency is unavailable.
    """
    from sqlalchemy import text
    from app.core.database import SessionLocal

    db_ready = False
    db_error = None
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
            db_ready = True
    except Exception as e:
        db_error = str(e)
        logger.error(f"Readiness check database failure: {e}")

    storage_ready = os.path.isdir(settings.STORAGE_DIR)
    is_ready = db_ready and storage_ready
    status_code = 200 if is_ready else 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if is_ready else "not_ready",
            "probe": "readiness",
            "database": "connected" if db_ready else f"unreachable: {db_error}",
            "storage": "available" if storage_ready else "unavailable",
            "environment": settings.ENVIRONMENT
        }
    )

