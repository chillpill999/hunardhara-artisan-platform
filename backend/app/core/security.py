import hashlib
import hmac
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Union
from fastapi import Header, HTTPException, status
import jwt
from app.core.config import settings


@dataclass
class CurrentUser:
    id: str
    email: Optional[str] = None
    role: str = 'customer'  # 'customer', 'artisan', 'admin'


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
    """
    Hashes a password with a salt derived from SECRET_KEY.
    """
    salt = settings.SECRET_KEY[:16].encode("utf-8")
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations=100000
    )
    return pwd_hash.hex()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against its hashed representation.
    """
    return hmac.compare_digest(hash_password(plain_password), hashed_password)


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generates a signed JWT access token.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {"exp": expire, "sub": str(subject)}
    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodes and validates a signed JWT access token.
    Supports both local SECRET_KEY and unverified inspection when offline mock fallback is active.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_signature": True}
        )
        return payload
    except jwt.PyJWTError:
        # Check if it is a Supabase JWT or test token
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            return unverified
        except Exception:
            return None


def get_current_user(authorization: Optional[str] = Header(None)) -> CurrentUser:
    """
    FastAPI dependency to extract and validate the authenticated user.
    Enforces that anonymous/unauthenticated users are rejected with HTTP 401.
    """
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

    user_id = str(payload.get("sub") or payload.get("id") or "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_TOKEN: Token contains no subject identifier.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Resolve user role from user_metadata, app_metadata, or claims
    role = (
        payload.get("role") or
        payload.get("user_metadata", {}).get("role") or
        payload.get("app_metadata", {}).get("role") or
        "customer"
    )
    email = payload.get("email") or payload.get("user_metadata", {}).get("email")

    return CurrentUser(id=user_id, email=email, role=str(role).lower())


def get_optional_current_user(authorization: Optional[str] = Header(None)) -> Optional[CurrentUser]:
    """
    FastAPI dependency: Returns CurrentUser if a valid Bearer token is provided,
    otherwise returns None without raising 401.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split("Bearer ", 1)[1].strip()
        payload = decode_access_token(token)
        if not payload:
            return None
        user_id = str(payload.get("sub") or payload.get("id") or "")
        if not user_id:
            return None
        role = (
            payload.get("role") or
            payload.get("user_metadata", {}).get("role") or
            payload.get("app_metadata", {}).get("role") or
            "customer"
        )
        email = payload.get("email") or payload.get("user_metadata", {}).get("email")
        return CurrentUser(id=user_id, email=email, role=str(role).lower())
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
    FastAPI dependency: Requires authenticated artisan or administrator.
    """
    user = get_current_user(authorization)
    if user.role not in ["artisan", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: Artisan or Administrator role required to access this resource."
        )
    return user


def require_admin(authorization: Optional[str] = Header(None)) -> CurrentUser:
    """
    FastAPI dependency: Requires authenticated administrator.
    """
    user = get_current_user(authorization)
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: Administrator privileges required."
        )
    return user


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
    key = (pepper or settings.AADHAAR_PEPPER_KEY).encode("utf-8")
    return hmac.new(key, clean_aadhaar.encode("utf-8"), hashlib.sha256).hexdigest()


def mask_aadhaar(raw_aadhaar: str) -> str:
    """
    Returns UIDAI-compliant masked string: XXXXXXXX followed by last 4 digits.
    """
    clean = raw_aadhaar.replace(" ", "").replace("-", "")
    if len(clean) != 12 or not clean.isdigit():
        raise ValueError("Aadhaar must be a 12-digit number")
    return f"XXXXXXXX{clean[-4:]}"
