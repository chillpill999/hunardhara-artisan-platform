import os
import re
import hmac
import base64
import hashlib
import secrets
import logging
from typing import Optional, Tuple, Set
from datetime import datetime, timezone
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("artisan_platform.security.storage")

# Whitelists of allowed extensions
ALLOWED_IMAGE_EXTENSIONS: Set[str] = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_AUDIO_EXTENSIONS: Set[str] = {".wav", ".ogg", ".opus", ".m4a", ".webm", ".mp3"}

# Strictly prohibited script and executable extensions (Case-insensitive)
DISALLOWED_EXTENSIONS: Set[str] = {
    ".exe", ".dll", ".so", ".sh", ".bash", ".bat", ".cmd", ".com",
    ".py", ".pyc", ".pyd", ".pyw",
    ".php", ".php3", ".php4", ".php5", ".phtml", ".phps",
    ".pl", ".pm", ".cgi",
    ".js", ".mjs", ".cjs", ".ts",
    ".html", ".htm", ".xhtml", ".shtml",
    ".svg", ".xml", ".xsl",
    ".jsp", ".jspx", ".asp", ".aspx", ".asa", ".asax",
    ".vbs", ".vbe", ".wsf", ".wsh", ".ps1", ".ps2",
    ".jar", ".war", ".ear"
}

ALLOWED_CATEGORIES: Set[str] = {"profiles", "audio", "uploads", "studio_drafts", "internal"}


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes client filename: extracts basename and removes illegal filesystem characters.
    """
    if not filename:
        return ""
    # Strip path components across POSIX and Windows
    base = os.path.basename(filename.replace("\\", "/"))
    # Remove control characters and null bytes
    cleaned = re.sub(r'[\x00-\x1f\x7f]', '', base).strip()
    return cleaned


def validate_uploaded_file(
    data: bytes,
    original_filename: str,
    expected_type: str = "image",
    max_size_mb: int = 15
) -> str:
    """
    Validates uploaded file binary data against:
    1. Minimum and maximum file size limits (HTTP 400 / HTTP 413).
    2. Forbidden executable / script extensions (HTTP 400).
    3. Double extension evasion attacks (HTTP 400).
    4. Allowed extension whitelist for expected media type (HTTP 400).
    5. Binary file signature / magic bytes verification (HTTP 400).

    Returns the validated canonical file extension.
    """
    if not data or len(data) < 16:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_FILE_DATA: Uploaded file is empty or too small to be valid media."
        )

    max_bytes = max_size_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"PAYLOAD_TOO_LARGE: Uploaded file exceeds maximum allowed size of {max_size_mb}MB."
        )

    clean_name = sanitize_filename(original_filename)
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_FILENAME: Missing or invalid filename."
        )

    # Check for path traversal characters in filename
    if ".." in original_filename or "/" in original_filename or "\\" in original_filename or "\x00" in original_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PATH_TRAVERSAL_DETECTED: Filename contains illegal path characters."
        )

    name_lower = clean_name.lower()

    # Split all extensions to detect double extension attacks (e.g. exploit.php.jpg)
    parts = name_lower.split(".")
    if len(parts) > 1:
        for ext_part in parts[1:]:
            dotted = f".{ext_part}"
            if dotted in DISALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"DISALLOWED_FILE_TYPE: Script or executable extension '{dotted}' is strictly prohibited."
                )

    _, primary_ext = os.path.splitext(name_lower)
    if not primary_ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_FILE_EXTENSION: Missing file extension."
        )

    if primary_ext in DISALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"DISALLOWED_FILE_TYPE: Executable or script extension '{primary_ext}' is strictly prohibited."
        )

    if expected_type == "image":
        if primary_ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"UNSUPPORTED_IMAGE_FORMAT: Extension '{primary_ext}' is not permitted. Allowed: {sorted(ALLOWED_IMAGE_EXTENSIONS)}"
            )

        # Magic byte signature verification for images
        is_jpeg = data[:3] == b'\xff\xd8\xff'
        is_png = data[:8] == b'\x89PNG\r\n\x1a\n'
        is_webp = data[:4] == b'RIFF' and len(data) >= 12 and data[8:12] == b'WEBP'

        if not (is_jpeg or is_png or is_webp):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="INVALID_FILE_SIGNATURE: Binary content does not match genuine JPEG, PNG, or WebP image headers."
            )

        if is_jpeg:
            canonical_ext = ".jpg"
        elif is_png:
            canonical_ext = ".png"
        else:
            canonical_ext = ".webp"

    elif expected_type == "audio":
        if primary_ext not in ALLOWED_AUDIO_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"UNSUPPORTED_AUDIO_FORMAT: Extension '{primary_ext}' is not permitted. Allowed: {sorted(ALLOWED_AUDIO_EXTENSIONS)}"
            )

        # Magic byte signature verification for audio
        is_wav = data[:4] == b'RIFF' and len(data) >= 12 and data[8:12] == b'WAVE'
        is_ogg = data[:4] == b'OggS'
        is_webm = data[:4] == b'\x1a\x45\xdf\xa3'
        is_mp3 = data[:3] == b'ID3' or (len(data) >= 2 and data[:2] in (b'\xff\xfb', b'\xff\xf3', b'\xff\xf2'))
        is_m4a = len(data) >= 12 and data[4:8] == b'ftyp'

        if not (is_wav or is_ogg or is_webm or is_mp3 or is_m4a):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="INVALID_FILE_SIGNATURE: Binary content does not match genuine audio headers (WAV, OGG, WebM, MP3, M4A)."
            )

        if is_wav:
            canonical_ext = ".wav"
        elif is_webm:
            canonical_ext = ".webm"
        elif is_ogg:
            canonical_ext = ".ogg" if primary_ext != ".opus" else ".opus"
        elif is_m4a:
            canonical_ext = ".m4a"
        else:
            canonical_ext = ".mp3"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"UNKNOWN_EXPECTED_TYPE: '{expected_type}' is not a recognized upload category."
        )

    return canonical_ext


def generate_secure_filename(owner_id: str, extension: str, prefix: str = "") -> str:
    """
    Generates a cryptographically strong, collision-resistant server-side filename.
    Never uses client-supplied filenames.
    Format: [prefix_][owner_token]_[uuid4]_[random_hex][ext]
    """
    clean_owner = hashlib.sha256(owner_id.encode("utf-8")).hexdigest()[:8]
    random_token = secrets.token_hex(8)
    clean_ext = extension if extension.startswith(".") else f".{extension}"
    prefix_part = f"{prefix}_" if prefix else ""
    return f"{prefix_part}{clean_owner}_{random_token}{clean_ext}"


def resolve_safe_storage_path(category: str, filename: str) -> str:
    """
    Resolves an absolute file path within STORAGE_DIR for a given category.
    Guarantees strict path traversal immunity.
    """
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"INVALID_CATEGORY: Storage category '{category}' is not permitted."
        )

    clean_filename = sanitize_filename(filename)
    if clean_filename != filename or ".." in filename or "/" in filename or "\\" in filename or "\x00" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PATH_TRAVERSAL_DETECTED: Filename contains illegal path characters."
        )

    base_dir = os.path.abspath(os.path.join(settings.STORAGE_DIR, category))
    target_path = os.path.abspath(os.path.join(base_dir, clean_filename))

    # Verify target path is strictly contained within base_dir
    try:
        common = os.path.commonpath([target_path, base_dir])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PATH_TRAVERSAL_DETECTED: Incompatible drive path."
        )

    if common != base_dir:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PATH_TRAVERSAL_DETECTED: Attempted path escape out of storage directory."
        )

    return target_path


def generate_file_token(category: str, filename: str, owner_id: str, expires_in_seconds: Optional[int] = None) -> str:
    """
    Generates a time-limited HMAC-SHA256 token for authorized direct file access.
    """
    ttl = expires_in_seconds or settings.STORAGE_SIGNED_URL_EXPIRY_SECONDS
    now_ts = int(datetime.now(timezone.utc).timestamp())
    expires_at = now_ts + ttl

    payload = f"{category}:{filename}:{owner_id}:{expires_at}"
    encoded_payload = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")

    secret = settings.STORAGE_SIGNED_URL_SECRET.encode("utf-8")
    sig = hmac.new(secret, encoded_payload.encode("utf-8"), hashlib.sha256).hexdigest()

    return f"{encoded_payload}.{sig}"


def verify_file_token(category: str, filename: str, token: str) -> Tuple[bool, Optional[str]]:
    """
    Verifies a time-limited signed URL token.
    Returns (is_valid, owner_id).
    """
    if not token or "." not in token:
        return False, None

    try:
        encoded_payload, sig = token.rsplit(".", 1)
        secret = settings.STORAGE_SIGNED_URL_SECRET.encode("utf-8")
        expected_sig = hmac.new(secret, encoded_payload.encode("utf-8"), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(sig, expected_sig):
            return False, None

        payload = base64.urlsafe_b64decode(encoded_payload.encode("utf-8")).decode("utf-8")
        parts = payload.split(":")
        if len(parts) != 4:
            return False, None

        tok_cat, tok_fn, owner_id, exp_str = parts
        if tok_cat != category or tok_fn != filename:
            return False, None

        exp = int(exp_str)
        now_ts = int(datetime.now(timezone.utc).timestamp())
        if now_ts > exp:
            return False, None

        return True, owner_id
    except Exception as e:
        logger.warning(f"File token verification failed: {e}")
        return False, None


def delete_stored_file(file_url_or_path: Optional[str]) -> bool:
    """
    Safely removes a stored file from disk given either its relative URL, API path, or disk path.
    Enforces containment within STORAGE_DIR or STATIC_DIR.
    """
    if not file_url_or_path:
        return False

    # Extract relative path from URL
    path_str = file_url_or_path.strip()
    if path_str.startswith("http://") or path_str.startswith("https://"):
        # Strip scheme and host
        path_str = "/" + path_str.split("://", 1)[1].split("/", 1)[-1]

    candidates = []

    # Check if it points to /api/v1/storage/files/{category}/{filename}
    if "/storage/files/" in path_str:
        sub = path_str.split("/storage/files/", 1)[1].split("?")[0]
        parts = sub.split("/", 1)
        if len(parts) == 2:
            cat, fn = parts
            if cat in ALLOWED_CATEGORIES:
                try:
                    candidates.append(resolve_safe_storage_path(cat, fn))
                except Exception:
                    pass

    # Check if it points to /static/{subdir}/{filename}
    if path_str.startswith("/static/"):
        rel_static = path_str[len("/static/"):].split("?")[0]
        safe_rel = os.path.normpath(rel_static).lstrip("\\/")
        if ".." not in safe_rel:
            candidates.append(os.path.join(settings.STATIC_DIR, safe_rel))

    # Direct filesystem path check
    if os.path.isabs(path_str):
        candidates.append(path_str)

    deleted = False
    for c in candidates:
        try:
            abs_candidate = os.path.abspath(c)
            # Verify containment in either STORAGE_DIR or STATIC_DIR
            storage_base = os.path.abspath(settings.STORAGE_DIR)
            static_base = os.path.abspath(settings.STATIC_DIR)

            in_storage = os.path.commonpath([abs_candidate, storage_base]) == storage_base
            in_static = os.path.commonpath([abs_candidate, static_base]) == static_base

            if (in_storage or in_static) and os.path.isfile(abs_candidate):
                os.remove(abs_candidate)
                logger.info(f"Safely unlinked stored file: {abs_candidate}")
                deleted = True
        except Exception as e:
            logger.error(f"Failed to unlink file '{c}': {e}")

    return deleted


def delete_user_stored_files(user_id: str) -> int:
    """
    Scans storage categories and removes all files belonging to a specific user.
    Matches the user's SHA-256 prefix hash or explicit user ID.
    Returns the count of removed files.
    """
    if not user_id:
        return 0

    owner_hash = hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:8]
    count = 0
    storage_base = os.path.abspath(settings.STORAGE_DIR)

    # Search in STORAGE_DIR categories
    for cat in ALLOWED_CATEGORIES:
        cat_dir = os.path.abspath(os.path.join(storage_base, cat))
        if not os.path.isdir(cat_dir):
            continue
        try:
            for fname in os.listdir(cat_dir):
                if f"_{owner_hash}_" in fname or fname.startswith(f"{owner_hash}_") or user_id in fname:
                    fpath = os.path.join(cat_dir, fname)
                    if os.path.isfile(fpath):
                        try:
                            if os.path.commonpath([fpath, storage_base]) == storage_base:
                                os.remove(fpath)
                                count += 1
                                logger.info(f"Unlinked user storage file for {user_id}: {fpath}")
                        except Exception as e:
                            logger.error(f"Error unlinking {fpath}: {e}")
        except Exception as e:
            logger.error(f"Error scanning category {cat} for user {user_id}: {e}")

    return count

