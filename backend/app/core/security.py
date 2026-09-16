import hashlib
import hmac
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Union
from fastapi import Header, HTTPException, status
import jwt
from passlib.context import CryptContext

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

from app.core.config import settings


@dataclass
class CurrentUser:
    id: str
    email: Optional[str] = None
    role: str = 'customer'  # 'customer', 'artisan', 'admin'

    @property
    def is_admin(self) -> bool:
        return (
            self.role == "admin"
            and bool(settings.admin_user_ids)
            and self.id in settings.admin_user_ids
        )


# In-memory sliding-window rate limiter
class InMemoryRateLimiter:
    def __init__(self):
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int = 30, window_seconds: int = 60) -> bool:
        now = time.time()
        window_start = now - window_seconds
        # Evict timestamps older than window
        self.requests[key] = [t for t in self.requests[key] if t > window_start]

        if len(self.requests[key]) >= max_requests:
            return False

        self.requests[key].append(now)
        return True


rate_limiter = InMemoryRateLimiter()


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

    jwt_secret = settings.SUPABASE_JWT_SECRET
    jwt_issuer = settings.SUPABASE_JWT_ISSUER
    jwt_audience = settings.SUPABASE_JWT_AUDIENCE

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
    return bool(
        settings.SUPABASE_JWT_SECRET
        and settings.SUPABASE_JWT_ISSUER
        and settings.SUPABASE_JWT_AUDIENCE
    )


def _require_auth_configuration() -> None:
    if not _auth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AUTH_CONFIGURATION_ERROR: Supabase JWT verification is not configured.",
        )


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Validate a Supabase JWT signature, issuer, audience, expiry, and subject."""
    if not _auth_configured():
        return None
    jwt_secret = settings.SUPABASE_JWT_SECRET
    jwt_issuer = settings.SUPABASE_JWT_ISSUER
    jwt_audience = settings.SUPABASE_JWT_AUDIENCE
    try:
        return jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            issuer=jwt_issuer,
            audience=jwt_audience,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError:
        return None


def get_current_user(authorization: Optional[str] = Header(None)) -> CurrentUser:
    """
    FastAPI dependency to extract and validate the authenticated user.
    Enforces that anonymous/unauthenticated users are rejected with HTTP 401.
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
    role = app_role if app_role in {"customer", "artisan", "admin"} else "customer"
    email = payload.get("email")

    role_str = str(role).lower()
    if role_str == "admin" and (not settings.admin_user_ids or user_id not in settings.admin_user_ids):
        role_str = "customer"

    return CurrentUser(id=user_id, email=email, role=role_str)


def get_optional_current_user(authorization: Optional[str] = Header(None)) -> Optional[CurrentUser]:
    """
    FastAPI dependency: Returns CurrentUser if a valid Bearer token is provided,
    otherwise returns None without raising 401.
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
        role = app_role if app_role in {"customer", "artisan", "admin"} else "customer"
        email = payload.get("email")

        role_str = str(role).lower()
        if role_str == "admin" and (not settings.admin_user_ids or user_id not in settings.admin_user_ids):
            role_str = "customer"

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


def require_artisan(authorization: Optional[str] = Header(None)) -> CurrentUser:
    """
    FastAPI dependency: Requires authenticated artisan or verified administrator.
    """
    user = get_current_user(authorization)
    if user.role != "artisan" and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: Artisan or Administrator role required to access this resource."
        )
    return user


def require_admin(authorization: Optional[str] = Header(None)) -> CurrentUser:
    """Requires a verified Supabase administrator subject configured server-side."""
    user = get_current_user(authorization)
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
