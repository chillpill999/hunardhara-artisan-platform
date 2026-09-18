import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from app.schemas.studio import StudioResponse, StudioMetadata
from app.services.studio_service import studio_service
from app.core.security import CurrentUser, require_artisan
from app.core.storage_security import validate_uploaded_file, generate_secure_filename

logger = logging.getLogger("artisan_platform.api.studio")
router = APIRouter(prefix="/products", tags=["AI Photo Studio"])


@router.post("/studio", response_model=StudioResponse, summary="AI Product Photo Studio")
async def process_studio_photo(
    image: UploadFile = File(..., description="Raw handicraft photo to enhance"),
    canvas_size: int = Form(1080, description="Square canvas dimension (default 1080px)"),
    current_user: CurrentUser = Depends(require_artisan)
):
    if not image.filename:
        raise HTTPException(status_code=400, detail="INVALID_IMAGE_DATA: Filename missing")

    image_bytes = await image.read()
    canonical_ext = validate_uploaded_file(
        data=image_bytes,
        original_filename=image.filename,
        expected_type="image",
        max_size_mb=15
    )
    safe_filename = generate_secure_filename(owner_id=current_user.id, extension=canonical_ext, prefix="studio")

    # Clamp canvas_size to safe bounded range (512px to 2048px) to prevent memory exhaustion DoS
    safe_canvas_size = max(512, min(int(canvas_size), 2048))

    try:
        result = studio_service.process_image_bytes(
            image_bytes=image_bytes,
            original_filename=safe_filename,
            canvas_size=safe_canvas_size
        )
        return StudioResponse(
            studio_image_url=result["studio_image_url"],
            before_after_preview_url=result["before_after_preview_url"],
            metadata=StudioMetadata(**result["metadata"])
        )
    except Exception as e:
        logger.error(f"Studio pipeline failed: {e}")
        raise HTTPException(status_code=400, detail=f"STUDIO_PROCESSING_ERROR: {str(e)}")

