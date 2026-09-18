import time
import threading
import logging
from typing import Dict, Any, Optional, Tuple
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("artisan_platform.security.idempotency")


class IdempotencyRecord:
    def __init__(self, status: str, created_at: float, response_data: Optional[Any] = None, status_code: int = 200):
        self.status = status  # "processing" | "completed"
        self.created_at = created_at
        self.response_data = response_data
        self.status_code = status_code


class IdempotencyStore:
    """
    In-memory idempotency coordinator with thread-safe atomic transitions.
    Prevents duplicate submissions and re-processes identical requests safely.
    """
    def __init__(self, ttl_seconds: Optional[int] = None):
        self.ttl = ttl_seconds or settings.IDEMPOTENCY_TTL_SECONDS
        self._lock = threading.Lock()
        self._store: Dict[str, IdempotencyRecord] = {}

    def _purge_expired(self, now: float) -> None:
        expired_keys = [
            k for k, rec in self._store.items()
            if (now - rec.created_at) > self.ttl
        ]
        for k in expired_keys:
            del self._store[k]

    def acquire(self, key: str, scope: str = "") -> Tuple[str, Optional[IdempotencyRecord]]:
        """
        Attempts to acquire an idempotency key.
        Returns:
            ("acquired", None) -> Caller must execute the operation.
            ("processing", None) -> Duplicate in-flight request; caller should return HTTP 409.
            ("replay", record) -> Operation previously completed; caller should return cached result.
        """
        if not key:
            return "none", None

        composite_key = f"{scope}:{key}" if scope else key
        now = time.time()

        with self._lock:
            self._purge_expired(now)

            if composite_key in self._store:
                rec = self._store[composite_key]
                if (now - rec.created_at) > self.ttl:
                    # Expired, reset
                    self._store[composite_key] = IdempotencyRecord(status="processing", created_at=now)
                    return "acquired", None
                if rec.status == "processing":
                    return "processing", None
                if rec.status == "completed":
                    return "replay", rec

            self._store[composite_key] = IdempotencyRecord(status="processing", created_at=now)
            return "acquired", None

    def complete(self, key: str, response_data: Any, status_code: int = 200, scope: str = "") -> None:
        """Marks operation as successfully completed with cached response payload."""
        if not key:
            return
        composite_key = f"{scope}:{key}" if scope else key
        with self._lock:
            self._store[composite_key] = IdempotencyRecord(
                status="completed",
                created_at=time.time(),
                response_data=response_data,
                status_code=status_code
            )

    def abort(self, key: str, scope: str = "") -> None:
        """Removes key on unhandled failure so the client can retry cleanly."""
        if not key:
            return
        composite_key = f"{scope}:{key}" if scope else key
        with self._lock:
            self._store.pop(composite_key, None)

    def reset(self) -> None:
        """Clears store (useful for tests)."""
        with self._lock:
            self._store.clear()


idempotency_store = IdempotencyStore()


def check_idempotency_header(key: Optional[str], scope: str = ""):
    """
    Validates an idempotency key header.
    If 'processing', raises HTTP 409 Conflict.
    If 'replay', returns cached response tuple (status_code, response_data).
    If 'acquired', returns None.
    """
    if not key:
        return None

    state, record = idempotency_store.acquire(key, scope=scope)
    if state == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="IDEMPOTENCY_CONFLICT: A request with this Idempotency-Key is currently being processed. Please do not retry concurrently."
        )
    if state == "replay" and record:
        return record.status_code, record.response_data
    return None
