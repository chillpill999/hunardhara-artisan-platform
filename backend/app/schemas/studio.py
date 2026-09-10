from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class StudioMetadata(BaseModel):
    width: int = Field(..., description="Canvas width in pixels", example=1080)
    height: int = Field(..., description="Canvas height in pixels", example=1080)
    processing_time_ms: float = Field(..., description="Pipeline execution duration in milliseconds", example=245.8)
    exif_scrubbed: bool = Field(default=True, description="True if EXIF GPS and device metadata was purged")
    low_light_compensated: bool = Field(default=False, description="True if CLAHE compensation was triggered")
    shadow_luminosity_drop_pct: float = Field(default=35.0, description="Measured luminosity drop under contact shadow", example=38.5)


class StudioResponse(BaseModel):
    studio_image_url: str = Field(..., description="URL to 1:1 square studio image with procedural shadows", example="/static/studio/bastar_horse_studio.jpg")
    before_after_preview_url: str = Field(..., description="URL to side-by-side comparison preview", example="/static/studio/bastar_horse_compare.jpg")
    metadata: StudioMetadata
