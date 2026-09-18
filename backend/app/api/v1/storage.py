import os
import mimetypes
import hashlib
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.security import CurrentUser, get_current_user, get_optional_current_user
from app.core.storage_security import (
    ALLOWED_CATEGORIES,
    validate_uploaded_file,
    generate_secure_filename,
    resolve_safe_storage_path,
    generate_file_token,
    verify_file_token,
    delete_stored_file
)

logger = logging.getLogger("artisan_platform.api.storage")
router = APIRouter(prefix="/storage", tags=["Authorized Storage & File Management"])


@router.get("/files/{category}/{filename}", summary="Retrieve Private Storage File")
async def get_storage_file(
    category: str,
    filename: str,
    token: Optional[str] = Query(None, description="Time-limited HMAC-SHA256 signed access token"),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user)
):
    """
    Authorized File Retrieval:
    Private files (profiles, audio, private uploads, studio drafts) are strictly isolated
    outside public static routes.
    Access requires either:
    1. A valid, unexpired signed URL token (?token=...), OR
    2. An authenticated session (Bearer token) matching the file owner or an administrator.
    """
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"INVALID_CATEGORY: Storage category '{category}' is invalid."
        )

    # 1. Authorize via Signed URL token if provided
    is_authorized = False
    if token:
        valid, token_owner = verify_file_token(category, filename, token)
        if valid:
            is_authorized = True
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN_FILE_ACCESS: Signed URL token is invalid or expired."
            )

    # 2. Authorize via Authenticated Session
    if not is_authorized:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="AUTHENTICATION_REQUIRED: Private storage access requires an authenticated session or signed URL."
            )

        if current_user.is_admin:
            is_authorized = True
        else:
            # Check ownership encoded in filename
            owner_hash = hashlib.sha256(current_user.id.encode("utf-8")).hexdigest()[:8]
            if owner_hash in filename:
                is_authorized = True
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="FORBIDDEN_OWNERSHIP: You are not authorized to view this private file."
                )

    # 3. Path Traversal & Existence check
    file_path = resolve_safe_storage_path(category, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"FILE_NOT_FOUND: File '{filename}' was not found in storage category '{category}'."
        )

    # 4. Determine secure MIME type
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "application/octet-stream"

    # 5. Return with strict security headers
    return FileResponse(
        path=file_path,
        media_type=mime_type,
        filename=filename,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
            "Cache-Control": "private, no-cache, no-store, must-revalidate"
        }
    )


@router.post("/upload", summary="Authorized File Upload")
async def upload_storage_file(
    file: UploadFile = File(..., description="Binary media file (JPEG, PNG, WebP, WAV, OGG, WebM)"),
    category: str = Form("uploads", description="Target storage category (profiles, audio, uploads, studio_drafts)"),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Authorized File Upload:
    - Enforces authentication.
    - Validates file size, extension, MIME type, and binary magic bytes.
    - Rejects executable/script files and double extension evasions.
    - Generates server-side unique collision-resistant filename.
    - Returns storage path and time-limited signed URL.
    """
    if category not in ("profiles", "audio", "uploads", "studio_drafts"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"INVALID_CATEGORY: Storage category '{category}' is not writable."
        )

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_FILE_DATA: Filename missing."
        )

    data = await file.read()
    expected_type = "audio" if category == "audio" else "image"

    canonical_ext = validate_uploaded_file(
        data=data,
        original_filename=file.filename,
        expected_type=expected_type,
        max_size_mb=settings.UPLOAD_MAX_SIZE_MB
    )

    secure_fn = generate_secure_filename(
        owner_id=current_user.id,
        extension=canonical_ext,
        prefix=category[:3]
    )

    dest_path = resolve_safe_storage_path(category, secure_fn)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)

    with open(dest_path, "wb") as f:
        f.write(data)

    signed_tok = generate_file_token(category, secure_fn, owner_id=current_user.id)

    return {
        "success": True,
        "category": category,
        "filename": secure_fn,
        "storage_path": f"/api/v1/storage/files/{category}/{secure_fn}",
        "signed_url": f"/api/v1/storage/files/{category}/{secure_fn}?token={signed_tok}",
        "token": signed_tok,
        "size_bytes": len(data),
        "content_type": file.content_type
    }


@router.delete("/files/{category}/{filename}", summary="Delete Stored Private File")
def delete_storage_file(
    category: str,
    filename: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Authorized File Deletion:
    Requires the caller to be the verified file owner or an administrator.
    Safely unlinks file from disk.
    """
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_CATEGORY: Invalid storage category."
        )

    # Ownership check
    owner_hash = hashlib.sha256(current_user.id.encode("utf-8")).hexdigest()[:8]
    if not current_user.is_admin and owner_hash not in filename:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You are not authorized to delete this file."
        )

    target_path = resolve_safe_storage_path(category, filename)
    if not os.path.isfile(target_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"FILE_NOT_FOUND: File '{filename}' not found."
        )

    try:
        os.remove(target_path)
        logger.info(f"Deleted storage file '{target_path}' by user '{current_user.id}'")
        return {"success": True, "status": "deleted", "filename": filename}
    except Exception as e:
        logger.error(f"Error unlinking storage file '{target_path}': {e}")
        raise HTTPException(status_code=500, detail="STORAGE_DELETE_ERROR")
