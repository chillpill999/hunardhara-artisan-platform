"""
AI Photo Studio Service Alias & Entry Point (SIH26090 - R1).
Re-exports studio_service, shadow_engine, and exif_scrubber utilities.
"""

from app.services.studio_service import (
    ImageStudioService,
    studio_service,
    extract_craft_foreground,
    apply_clahe_and_white_balance,
    create_before_after_preview
)
from app.services.shadow_engine import synthesize_procedural_shadows
from app.services.exif_scrubber import strip_exif_from_image, strip_exif_from_bytes

__all__ = [
    "ImageStudioService",
    "studio_service",
    "extract_craft_foreground",
    "apply_clahe_and_white_balance",
    "create_before_after_preview",
    "synthesize_procedural_shadows",
    "strip_exif_from_image",
    "strip_exif_from_bytes",
]
