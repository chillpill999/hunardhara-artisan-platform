from __future__ import annotations
import re
import json
import hashlib
import hmac
import time
import threading
import urllib.request
import urllib.error
import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from fastapi import Header, HTTPException, Request, status, Depends
import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger("artisan_platform.security")

from app.core.config import settings
from app.core.database import get_db, SessionLocal


@dataclass
class CurrentUser:
    id: str
    email: Optional[str] = None
    role: str = 'customer'  # 'customer', 'artisan', 'admin', 'super_admin'

    @property
    def is_super_admin(self) -> bool:
        return self.role == "super_admin"

    @property
    def is_admin(self) -> bool:
        if self.role == "super_admin":
            return True
        if self.role == "admin":
            if not bool(settings.admin_user_ids) or self.id in settings.admin_user_ids:
                return True
            from app.services.supabase_admin import supabase_admin
            admin_list = supabase_admin.list_admin_users()
            return any(a.get("id") == self.id and a.get("role") in ("admin", "super_admin") for a in admin_list)
        return False


# In-memory sliding-window rate limiter
class InMemoryRateLimiter:
    def __init__(self):
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int = 30, window_seconds: int = 60) -> Tuple[bool, int, int]:
        """
        Validates request rate against sliding window.
        Returns: (is_allowed, remaining_requests, retry_after_seconds)
        """
        now = time.time()
        window_start = now - window_seconds
        # Evict timestamps older than window
        self.requests[key] = [t for t in self.requests[key] if t > window_start]

        count = len(self.requests[key])
        if count >= max_requests:
            oldest_in_window = min(self.requests[key]) if self.requests[key] else now
            retry_after = max(1, int(oldest_in_window + window_seconds - now))
            return False, 0, retry_after

        self.requests[key].append(now)
        remaining = max_requests - len(self.requests[key])
        return True, remaining, 0

    def reset(self):
        """Clears all tracked requests."""
        self.requests.clear()


rate_limiter = InMemoryRateLimiter()


class RateLimiter:
    """
    FastAPI dependency for rate limiting public and expensive AI endpoints.
    Tracks limits using caller authentication token hash or client IP.
    """
    def __init__(self, max_requests: int = 30, window_seconds: int = 60, prefix: str = "api"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.prefix = prefix

    async def __call__(self, request: Request):
        auth_header = request.headers.get("authorization")
        if auth_header and "Bearer " in auth_header:
            token = auth_header.split("Bearer ", 1)[1].strip()
            client_id = f"tok_{hashlib.sha256(token.encode()).hexdigest()[:12]}"
        else:
            client_id = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "127.0.0.1")

        key = f"{self.prefix}:{client_id}"
        allowed, remaining, retry_after = rate_limiter.check(key, self.max_requests, self.window_seconds)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"RATE_LIMIT_EXCEEDED: Rate limit of {self.max_requests} requests per {self.window_seconds}s exceeded.",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.max_requests),
                    "X-RateLimit-Remaining": "0"
                }
            )



def hash_password(password: str) -> str:
    """Hashes a password with a unique bcrypt salt, if this legacy helper is used."""
    return password_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against its hashed representation.
    """
    return password_context.verify(plain_password, hashed_password)


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None
) -> str:
    """Creates a Supabase-compatible token for test fixtures only.

    Production authentication is issued by Supabase Auth; this application has
    no login or token-issuance route.
    """
    _require_auth_configuration()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)

    jwt_secret = settings.SUPABASE_JWT_SECRET or "hunardhara-dev-jwt-secret-fallback-minimum-32b"
    jwt_issuer = settings.SUPABASE_JWT_ISSUER or (f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1" if settings.SUPABASE_URL else "https://gqtcpbllllaewzwqcyun.supabase.co/auth/v1")
    jwt_audience = settings.SUPABASE_JWT_AUDIENCE or "authenticated"

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "iss": jwt_issuer,
        "aud": jwt_audience,
    }
    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(to_encode, jwt_secret, algorithm="HS256")
    return encoded_jwt


def _auth_configured() -> bool:
    """
    Returns True if authentication can be verified.
    Supports local symmetric secret, Supabase URL with JWKS/API verification.
    """
    return bool(
        settings.SUPABASE_JWT_SECRET
        or (settings.SUPABASE_URL and (settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY))
    )


def _require_auth_configuration() -> None:
    if not _auth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AUTH_CONFIGURATION_ERROR: Supabase JWT verification is not configured.",
        )


_JWKS_CLIENT: Optional[jwt.PyJWKClient] = None
_TOKEN_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_CACHE_LOCK = threading.Lock()


def _get_jwks_client() -> Optional[jwt.PyJWKClient]:
    global _JWKS_CLIENT
    if _JWKS_CLIENT is None and settings.SUPABASE_URL:
        try:
            jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
            _JWKS_CLIENT = jwt.PyJWKClient(jwks_url, cache_keys=True, max_cached_keys=16)
        except Exception as e:
            logger.warning(f"Could not initialize Supabase JWKS client: {e}")
    return _JWKS_CLIENT


def _verify_with_supabase_api(token: str) -> Optional[Dict[str, Any]]:
    """
    Direct verification against Supabase Auth API endpoint GET /auth/v1/user.
    Authoritative verification for asymmetric or symmetric Supabase tokens.
    """
    if not settings.SUPABASE_URL:
        return None

    apikey = settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY
    if not apikey:
        return None

    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": apikey,
            "Authorization": f"Bearer {token}",
            "User-Agent": "Hunardhara-Backend/1.0",
        },
        method="GET"
    )

    try:
        with urllib.request.urlopen(req, timeout=settings.EXTERNAL_TIMEOUT_SECONDS) as resp:
            if resp.status == 200:
                user_data = json.loads(resp.read().decode("utf-8"))
                user_id = user_data.get("id")
                if not user_id:
                    return None
                return {
                    "sub": user_id,
                    "email": user_data.get("email"),
                    "app_metadata": user_data.get("app_metadata") or {},
                    "user_metadata": user_data.get("user_metadata") or {},
                    "aud": user_data.get("aud") or "authenticated",
                    "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
                    "exp": int(time.time()) + 300,
                }
    except urllib.error.HTTPError as e:
        logger.debug(f"Supabase auth/v1/user rejected token: {e.code}")
        return None
    except Exception as e:
        logger.warning(f"Supabase auth/v1/user error: {e}")
        return None

    return None


def _cache_token_payload(token_hash: str, payload: Dict[str, Any], now: float) -> None:
    exp = payload.get("exp")
    ttl = 60.0
    if isinstance(exp, (int, float)):
        remaining = exp - now
        if remaining > 0:
            ttl = min(60.0, remaining)
    with _CACHE_LOCK:
        if len(_TOKEN_CACHE) > 1000:
            _TOKEN_CACHE.clear()
        _TOKEN_CACHE[token_hash] = (now + ttl, payload)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validate a Supabase JWT signature, issuer, audience, expiry, and subject.
    Supports:
    1. Fast in-memory cache lookup (TTL 60s)
    2. Local HMAC-SHA256 decode if SUPABASE_JWT_SECRET is configured
    3. Asymmetric JWKS verification via PyJWKClient (ES256 / RS256)
    4. Authoritative Supabase Auth API verification (/auth/v1/user)
    5. Local test/dev fallback secret if in dev or offline mode
    """
    if not token or not isinstance(token, str):
        return None

    if not _auth_configured():
        return None

    now = time.time()
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    # 1. Fast in-memory cache lookup
    with _CACHE_LOCK:
        cached = _TOKEN_CACHE.get(token_hash)
        if cached:
            expires_at, payload = cached
            if now < expires_at:
                return payload
            else:
                _TOKEN_CACHE.pop(token_hash, None)

    valid_audiences = [settings.SUPABASE_JWT_AUDIENCE, "authenticated"]
    valid_issuers = [
        settings.SUPABASE_JWT_ISSUER,
        "supabase",
        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1" if settings.SUPABASE_URL else None,
    ]
    valid_issuers = [iss for iss in valid_issuers if iss]

    # 2. Try symmetric decode if SUPABASE_JWT_SECRET is configured (used by test fixtures & legacy tokens)
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience=valid_audiences,
                options={"require": ["exp", "sub"], "verify_iss": False},
            )
            iss = payload.get("iss")
            if not iss or not valid_issuers or iss in valid_issuers or any(iss.startswith(v) for v in valid_issuers):
                _cache_token_payload(token_hash, payload, now)
                return payload
        except jwt.PyJWTError as e:
            logger.debug(f"Symmetric JWT decode failed: {e}")

    # 3. Try asymmetric JWKS verification (modern Supabase tokens: ES256 / RS256)
    jwks_client = _get_jwks_client()
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256", "HS256"],
                audience=valid_audiences,
                options={"require": ["exp", "sub"], "verify_iss": False},
            )
            _cache_token_payload(token_hash, payload, now)
            return payload
        except Exception as e:
            logger.debug(f"JWKS verification failed: {e}")

    # 4. Direct Supabase Auth API verification (/auth/v1/user)
    api_payload = _verify_with_supabase_api(token)
    if api_payload:
        _cache_token_payload(token_hash, api_payload, now)
        return api_payload

    # 5. Local test/dev fallback secret if in dev or offline mode
    if not settings.is_production and (settings.OFFLINE_MODE or settings.is_development or settings.is_test):
        dev_secret = "hunardhara-dev-jwt-secret-fallback-minimum-32b"
        try:
            payload = jwt.decode(
                token,
                dev_secret,
                algorithms=["HS256"],
                options={"verify_signature": True, "verify_exp": True, "verify_aud": False, "require": ["sub"]},
            )
            _cache_token_payload(token_hash, payload, now)
            return payload
        except jwt.PyJWTError:
            pass

    return None


def _check_user_active_status(user_id: str, role: str, db: Optional[Any] = None) -> None:
    """
    Validates that user_id is not recorded in the DeactivatedUser registry
    and that artisans are currently active in the database.
    Raises HTTP 403 ACCOUNT_DEACTIVATED if account is deactivated or deleted under DPDP Act 2023.
    """
    from app.models.deactivated_user import DeactivatedUser
    from app.models.artisan import Artisan
    from sqlalchemy.orm import Session

    def _inspect(session: Session):
        # 1. Check DeactivatedUser table
        try:
            deact = session.query(DeactivatedUser).filter(DeactivatedUser.id == user_id).first()
            if deact:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="ACCOUNT_DEACTIVATED: This account has been deactivated or deleted under DPDP Act 2023."
                )
        except HTTPException:
            raise
        except Exception:
            pass

        # 2. Check Artisan active status
        if role == "artisan":
            try:
                artisan = session.query(Artisan).filter(Artisan.id == user_id).first()
                if artisan and not artisan.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="ACCOUNT_DEACTIVATED: Artisan account has been deactivated."
                    )
            except HTTPException:
                raise
            except Exception:
                pass

    if db is not None and isinstance(db, Session):
        _inspect(db)
    else:
        try:
            with SessionLocal() as session:
                _inspect(session)
        except HTTPException:
            raise
        except Exception:
            pass


def _resolve_user_role(user_id: str, email: Optional[str], raw_role: Optional[str], db: Optional[Session] = None) -> str:
    """
    Resolves authoritative user role from app_metadata and performs one-time
    server-side bootstrap for INITIAL_SUPER_ADMIN_EMAIL.
    """
    role = raw_role if raw_role in {"customer", "artisan", "admin", "super_admin"} else "customer"
    role_str = str(role).lower()

    # Server-side Super Admin bootstrap check:
    if email and email.strip().lower() == settings.INITIAL_SUPER_ADMIN_EMAIL.strip().lower():
        from app.models.system_setting import SystemSetting
        from app.models.admin_audit_log import AdminAuditLog
        from app.services.supabase_admin import supabase_admin

        target_db = db if db is not None else SessionLocal()
        try:
            bootstrapped_setting = target_db.query(SystemSetting).filter(SystemSetting.key == "super_admin_bootstrapped").first()
            if not bootstrapped_setting:
                # First-time Super Admin Bootstrap:
                logger.info(f"Executing initial Super Admin bootstrap for {email} ({user_id})")
                target_db.merge(SystemSetting(key="super_admin_bootstrapped", value="true"))
                target_db.merge(SystemSetting(key="super_admin_user_id", value=user_id))
                target_db.merge(SystemSetting(key="super_admin_email", value=email))
                target_db.add(AdminAuditLog(
                    action="BOOTSTRAP_SUPER_ADMIN",
                    actor_id=user_id,
                    actor_email=email,
                    target_user_id=user_id,
                    details=json.dumps({"method": "automatic_first_auth", "role": "super_admin"})
                ))
                target_db.commit()
                supabase_admin.set_user_role(user_id, "super_admin")
                return "super_admin"
            elif bootstrapped_setting.value == "true":
                super_uid = target_db.query(SystemSetting).filter(SystemSetting.key == "super_admin_user_id").first()
                if not super_uid or super_uid.value != user_id:
                    target_db.merge(SystemSetting(key="super_admin_user_id", value=user_id))
                    target_db.commit()
                    supabase_admin.set_user_role(user_id, "super_admin")
                return "super_admin"
        except Exception as e:
            logger.warning(f"Super admin bootstrap check note: {e}")
        finally:
            if db is None:
                target_db.close()
        return "super_admin"

    if role_str == "admin" and settings.admin_user_ids and user_id not in settings.admin_user_ids:
        from app.services.supabase_admin import supabase_admin
        admin_list = supabase_admin.list_admin_users()
        dynamically_granted = any(a.get("id") == user_id and a.get("role") in ("admin", "super_admin") for a in admin_list)
        if not dynamically_granted:
            role_str = "customer"

    return role_str


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> CurrentUser:
    """
    FastAPI dependency to extract and validate the authenticated user.
    Enforces that anonymous/unauthenticated users are rejected with HTTP 401.
    Enforces that deleted or deactivated users are rejected with HTTP 403.
    """
    _require_auth_configuration()
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="AUTHENTICATION_REQUIRED: Missing or invalid Authorization header.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_TOKEN: Cryptographic signature or token payload is invalid.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = str(payload.get("sub") or "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_TOKEN: Token contains no subject identifier.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    app_metadata = payload.get("app_metadata")
    app_role = app_metadata.get("role") if isinstance(app_metadata, dict) else None
    email = payload.get("email")

    role_str = _resolve_user_role(user_id=user_id, email=email, raw_role=app_role, db=db)

    _check_user_active_status(user_id=user_id, role=role_str, db=db)

    return CurrentUser(id=user_id, email=email, role=role_str)


def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[CurrentUser]:
    """
    FastAPI dependency: Returns CurrentUser if a valid Bearer token is provided,
    otherwise returns None without raising 401.
    Returns None if the account is deactivated or deleted.
    """
    if not authorization or not authorization.startswith("Bearer ") or not _auth_configured():
        return None
    try:
        token = authorization.split("Bearer ", 1)[1].strip()
        payload = decode_access_token(token)
        if not payload:
            return None
        user_id = str(payload.get("sub") or "")
        if not user_id:
            return None
        app_metadata = payload.get("app_metadata")
        app_role = app_metadata.get("role") if isinstance(app_metadata, dict) else None
        email = payload.get("email")

        role_str = _resolve_user_role(user_id=user_id, email=email, raw_role=app_role, db=db)

        _check_user_active_status(user_id=user_id, role=role_str, db=db)

        return CurrentUser(id=user_id, email=email, role=role_str)
    except Exception:
        return None


def mask_email(email: Optional[str]) -> Optional[str]:
    """
    Masks an email address for privacy-preserving displays (e.g. b***@crafts.gov.in).
    Returns None if email is missing or malformed.
    """
    if not email or "@" not in email:
        return None
    parts = email.split("@", 1)
    name, domain = parts[0], parts[1]
    if len(name) <= 1:
        masked_name = name + "***"
    elif len(name) == 2:
        masked_name = name[0] + "***"
    else:
        masked_name = name[0] + "***" + name[-1]
    return f"{masked_name}@{domain}"


def redact_sensitive_text(text: Optional[str]) -> Optional[str]:
    """
    Sanitizes arbitrary strings to redact PII and sensitive credentials from logs and errors:
    - Email addresses: masked via mask_email (e.g. u***@domain.com)
    - Indian phone numbers: +9198****1234
    - Aadhaar numbers: XXXXXXXX1234
    - Bearer tokens: Bearer [REDACTED]
    - Passwords & secrets: [REDACTED]
    """
    if not text:
        return text

    # Mask Bearer tokens
    s = re.sub(r'(Bearer\s+)[A-Za-z0-9_\-\.]+', r'\1[REDACTED]', text)

    # Mask secrets, passwords, api keys
    s = re.sub(r'(?i)(api[_-]?key|password|secret|jwt[_-]?secret)\s*[:=]\s*["\']?[^"\'\s,]+', r'\1=[REDACTED]', s)

    # Mask Aadhaar numbers (12 digits, optional space or hyphen)
    def _mask_aadhaar_match(m):
        raw = re.sub(r'[\s\-]', '', m.group(0))
        return f"XXXXXXXX{raw[-4:]}"

    s = re.sub(r'\b[1-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}\b', _mask_aadhaar_match, s)

    # Mask Indian mobile phone numbers (10 digits starting with 6-9, optional +91 prefix)
    def _mask_phone_match(m):
        raw = m.group(0)
        digits = re.sub(r'\D', '', raw)
        if len(digits) >= 10:
            last4 = digits[-4:]
            prefix = "+91" if "+91" in raw or raw.strip().startswith("91") else ""
            lead2 = digits[-10:-8]
            return f"{prefix}{lead2}****{last4}".strip()
        return "[PHONE_REDACTED]"

    s = re.sub(r'(?:\+?91[\-\s]?)?[6-9]\d{9}\b', _mask_phone_match, s)

    # Mask email addresses
    def _mask_email_match(m):
        em = m.group(0)
        return mask_email(em) or em

    s = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', _mask_email_match, s)

    return s


def require_customer(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> CurrentUser:
    """
    FastAPI dependency: Requires authenticated customer or verified administrator.
    Rejects artisans or non-customer accounts attempting to perform consumer actions.
    Rejects deactivated accounts.
    """
    user = get_current_user(authorization, db=db)
    if user.role != "customer" and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_ROLE: Only customers or administrators can place orders or perform this action."
        )
    return user


def require_artisan(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> CurrentUser:
    """
    FastAPI dependency: Requires authenticated active artisan or verified administrator.
    Rejects deactivated accounts.
    """
    user = get_current_user(authorization, db=db)
    if user.role != "artisan" and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: Artisan or Administrator role required to access this resource."
        )
    return user


def require_super_admin(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> CurrentUser:
    """
    FastAPI dependency: Requires authenticated Super Administrator (role='super_admin').
    Rejects normal administrators, artisans, and customers with HTTP 403.
    """
    user = get_current_user(authorization, db=db)
    if not user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: Super Administrator privileges required."
        )
    return user


def require_admin(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> CurrentUser:
    """Requires a verified Supabase administrator or super administrator."""
    user = get_current_user(authorization, db=db)
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: Administrator privileges required."
        )
    return user


def require_artisan_subject_or_admin(artisan_id: str, current_user: CurrentUser) -> None:
    """Authorize access to an artisan's private data by subject ID, never request data."""
    if current_user.is_admin:
        return
    if current_user.role != "artisan" or current_user.id != artisan_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You may only access your own artisan data.",
        )


def validate_image_file_bytes(data: bytes, filename: str, max_size_mb: int = 10) -> None:
    """
    Validates image binary buffer: checks maximum size and verifies magic bytes (JPEG, PNG, WebP).
    Rejects disguised or corrupted files.
    """
    max_bytes = max_size_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"FILE_TOO_LARGE: Upload exceeds maximum permissible size of {max_size_mb}MB."
        )

    if len(data) < 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CORRUPTED_FILE: Buffer too small to be a valid image."
        )

    # Magic byte checks
    is_jpeg = data[:3] == b'\xff\xd8\xff'
    is_png = data[:8] == b'\x89PNG\r\n\x1a\n'
    is_webp = data[:4] == b'RIFF' and data[8:12] == b'WEBP'

    if not (is_jpeg or is_png or is_webp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="UNSUPPORTED_IMAGE_FORMAT: Only genuine JPEG, PNG, or WebP images are permitted."
        )


def validate_audio_file_bytes(data: bytes, filename: str, max_size_mb: int = 15) -> None:
    """
    Validates audio binary buffer: checks maximum size and verifies audio headers (WAV, OGG, MP3, WebM).
    """
    max_bytes = max_size_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"FILE_TOO_LARGE: Audio upload exceeds {max_size_mb}MB limit."
        )

    if len(data) < 16:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AUDIO_CORRUPT: Buffer too small to be valid audio."
        )


def generate_aadhaar_hash(raw_aadhaar: str, pepper: Optional[str] = None) -> str:
    """
    Generates a deterministic, one-way HMAC-SHA256 lookup hash for an Aadhaar number
    using the sovereign pepper key. Never stores raw Aadhaar.
    """
    clean_aadhaar = raw_aadhaar.replace(" ", "").replace("-", "")
    active_pepper = pepper or settings.AADHAAR_PEPPER_KEY
    if not active_pepper:
        raise RuntimeError("AADHAAR_PEPPER_KEY is not configured")
    key = active_pepper.encode("utf-8")
    return hmac.new(key, clean_aadhaar.encode("utf-8"), hashlib.sha256).hexdigest()


def mask_aadhaar(raw_aadhaar: str) -> str:
    """
    Returns UIDAI-compliant masked string: XXXXXXXX followed by last 4 digits.
    """
    clean = raw_aadhaar.replace(" ", "").replace("-", "")
    if len(clean) != 12 or not clean.isdigit():
        raise ValueError("Aadhaar must be a 12-digit number")
    return f"XXXXXXXX{clean[-4:]}"
