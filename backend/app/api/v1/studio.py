import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.schemas.studio import StudioResponse, StudioMetadata
from app.services.studio_service import studio_service

logger = logging.getLogger("artisan_platform.api.studio")
router = APIRouter(prefix="/products", tags=["AI Photo Studio"])


@router.post("/studio", response_model=StudioResponse, summary="AI Product Photo Studio")
async def process_studio_photo(
    image: UploadFile = File(..., description="Raw handicraft photo to enhance"),
    canvas_size: int = Form(1080, description="Square canvas dimension (default 1080px)")
):
    if not image.filename:
        raise HTTPException(status_code=400, detail="INVALID_IMAGE_DATA: Filename missing")

    image_bytes = await image.read()
    if not image_bytes or len(image_bytes) < 10:
        raise HTTPException(status_code=400, detail="INVALID_IMAGE_DATA: Empty or corrupted image buffer")

    try:
        result = studio_service.process_image_bytes(
            image_bytes=image_bytes,
            original_filename=image.filename,
            canvas_size=canvas_size
        )
        return StudioResponse(
            studio_image_url=result["studio_image_url"],
            before_after_preview_url=result["before_after_preview_url"],
            metadata=StudioMetadata(**result["metadata"])
        )
    except Exception as e:
        logger.error(f"Studio pipeline failed: {e}")
        raise HTTPException(status_code=400, detail=f"STUDIO_PROCESSING_ERROR: {str(e)}")

