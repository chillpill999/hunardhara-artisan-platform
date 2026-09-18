import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("artisan_platform.http")


class RequestIDAndLoggingMiddleware(BaseHTTPMiddleware):
    """
    Production Hardening Middleware:
    1. Extracts or injects a unique X-Request-ID into every HTTP transaction.
    2. Measures transaction duration with high precision.
    3. Injects X-Request-ID and security headers into all responses.
    4. Emits structured server-side logs with sanitized request parameters (no passwords, tokens, or Aadhaar).
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Resolve or generate request ID
        req_id = request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:16]}"
        request.state.request_id = req_id

        # 2. Timing
        start_time = time.perf_counter()

        client_ip = request.headers.get("x-forwarded-for")
        if client_ip:
            client_ip = client_ip.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        # 3. Call downstream handlers
        try:
            response: Response = await call_next(request)
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"HTTP_ERROR: method={request.method} path={request.url.path} "
                f"duration_ms={duration_ms:.2f} request_id={req_id} ip={client_ip} error={type(e).__name__}: {str(e)}"
            )
            raise e

        duration_ms = (time.perf_counter() - start_time) * 1000

        # 4. Attach request ID & standard security headers
        response.headers["X-Request-ID"] = req_id
        if "X-Content-Type-Options" not in response.headers:
            response.headers["X-Content-Type-Options"] = "nosniff"
        if "X-Frame-Options" not in response.headers:
            response.headers["X-Frame-Options"] = "DENY"

        # 5. Structured logging
        level = logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(
            level,
            f"HTTP_TRANSACTION: method={request.method} path={request.url.path} "
            f"status={response.status_code} duration_ms={duration_ms:.2f} "
            f"request_id={req_id} ip={client_ip}"
        )

        return response
