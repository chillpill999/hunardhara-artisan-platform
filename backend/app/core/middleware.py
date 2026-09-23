import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.security import redact_sensitive_text

logger = logging.getLogger("artisan_platform.http")


def _mask_ip(ip: str) -> str:
    """Masks the host portion of IPv4/IPv6 addresses to preserve caller network privacy."""
    if not ip or ip in ("unknown", "127.0.0.1", "localhost", "testclient"):
        return ip
    if "." in ip:
        parts = ip.split(".")
        if len(parts) == 4:
            return f"{parts[0]}.{parts[1]}.{parts[2]}.xxx"
    elif ":" in ip:
        parts = ip.split(":")
        if len(parts) >= 2:
            return f"{parts[0]}:{parts[1]}::xxxx"
    return ip


class RequestIDAndLoggingMiddleware(BaseHTTPMiddleware):
    """
    Production Hardening & Privacy Middleware:
    1. Extracts or injects a unique X-Request-ID into every HTTP transaction.
    2. Measures transaction duration with high precision.
    3. Injects X-Request-ID and security headers into all responses.
    4. Emits structured server-side logs with sanitized request parameters (no passwords, tokens, or Aadhaar).
    5. Mask client IP addresses to comply with sovereign privacy principles.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Resolve or generate request ID
        req_id = request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:16]}"
        request.state.request_id = req_id

        # 2. Timing
        start_time = time.perf_counter()

        client_ip = request.headers.get("x-forwarded-for")
        if client_ip:
            raw_ip = client_ip.split(",")[0].strip()
        else:
            raw_ip = request.client.host if request.client else "unknown"
        masked_ip = _mask_ip(raw_ip)

        # 3. Sanitize query string for logging
        log_path = request.url.path
        if request.url.query:
            log_path = f"{request.url.path}?{redact_sensitive_text(request.url.query)}"

        # 4. Check Emergency Maintenance Mode
        path = request.url.path
        if (
            path.startswith("/api/v1")
            and not path.startswith("/api/v1/admin")
            and not path.startswith("/api/v1/health")
            and path != "/health"
        ):
            try:
                from app.core.database import SessionLocal
                from app.services.platform_settings_service import platform_settings_service
                with SessionLocal() as db:
                    if platform_settings_service.is_maintenance_mode(db):
                        auth = request.headers.get("authorization")
                        is_admin_req = False
                        if auth and "Bearer " in auth:
                            try:
                                from app.core.security import decode_access_token
                                token = auth.split("Bearer ", 1)[1].strip()
                                payload = decode_access_token(token)
                                if payload:
                                    role = payload.get("app_metadata", {}).get("role")
                                    if role in ("admin", "super_admin"):
                                        is_admin_req = True
                            except Exception:
                                pass
                        if not is_admin_req:
                            msg = platform_settings_service.get_setting(db, "maintenance_message")
                            from starlette.responses import JSONResponse
                            return JSONResponse(
                                status_code=503,
                                content={
                                    "error": "PLATFORM_MAINTENANCE",
                                    "detail": msg,
                                    "maintenance_mode": True
                                },
                                headers={"X-Request-ID": req_id, "Retry-After": "300"}
                            )
            except Exception as maint_err:
                logger.warning(f"Maintenance check bypassed on error: {maint_err}")

        # 5. Call downstream handlers
        try:
            response: Response = await call_next(request)
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            safe_err = redact_sensitive_text(f"{type(e).__name__}: {str(e)}")
            logger.error(
                f"HTTP_ERROR: method={request.method} path={log_path} "
                f"duration_ms={duration_ms:.2f} request_id={req_id} ip={masked_ip} error={safe_err}"
            )
            raise e

        duration_ms = (time.perf_counter() - start_time) * 1000

        # 5. Attach request ID & standard security headers
        response.headers["X-Request-ID"] = req_id
        if "X-Content-Type-Options" not in response.headers:
            response.headers["X-Content-Type-Options"] = "nosniff"
        if "X-Frame-Options" not in response.headers:
            response.headers["X-Frame-Options"] = "DENY"

        # 6. Structured logging
        level = logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(
            level,
            f"HTTP_TRANSACTION: method={request.method} path={log_path} "
            f"status={response.status_code} duration_ms={duration_ms:.2f} "
            f"request_id={req_id} ip={masked_ip}"
        )

        return response
