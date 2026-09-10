import io
import logging
from typing import Tuple, Dict, Any
from PIL import Image, ExifTags
import numpy as np

logger = logging.getLogger("artisan_platform.exif_scrubber")


def strip_exif_from_image(image: Image.Image) -> Tuple[Image.Image, Dict[str, Any]]:
    """
    Sovereign EXIF & GPS Metadata Scrubber (DPDP Act 2023 & MoSJE Privacy Compliance).
    Completely purges all EXIF tags (including GPS coordinates, device serial numbers,
    and arbitrary user comments) before storage or publication.
    
    Returns:
        Tuple of (clean_image, scrubber_metadata)
    """
    had_exif = False
    had_gps = False
    original_tags_count = 0

    try:
        exif = image.getexif()
        if exif:
            had_exif = True
            original_tags_count = len(exif)
            gps_info = exif.get_ifd(ExifTags.Base.GPSInfo)
            if len(gps_info) > 0:
                had_gps = True
    except Exception as e:
        logger.warning(f"Could not read original EXIF tags: {e}")

    # Create a fresh PIL Image from the raw pixel buffer, entirely decoupling from metadata
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        clean_image = Image.fromarray(np.array(image.convert("RGBA")))
    else:
        clean_image = Image.fromarray(np.array(image.convert("RGB")))

    # Verify that clean_image has no lingering EXIF
    clean_exif = clean_image.getexif()
    clean_gps = clean_exif.get_ifd(ExifTags.Base.GPSInfo)
    assert len(clean_gps) == 0, "Failed to purge GPS metadata"

    metadata = {
        "exif_scrubbed": True,
        "had_exif": had_exif,
        "gps_removed": had_gps,
        "original_tags_count": original_tags_count
    }
    return clean_image, metadata


def strip_exif_from_bytes(image_bytes: bytes) -> Tuple[bytes, Dict[str, Any], Image.Image]:
    """
    Scrub EXIF tags directly from raw byte buffer.
    Returns:
        Tuple of (clean_jpeg_bytes, metadata, clean_image)
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        clean_img, meta = strip_exif_from_image(img)
        
        out_buf = io.BytesIO()
        # Save as clean JPEG or PNG without passing exif
        if clean_img.mode == "RGBA":
            clean_img.save(out_buf, format="PNG", optimize=True)
        else:
            clean_img.save(out_buf, format="JPEG", quality=95, optimize=True)
        clean_bytes = out_buf.getvalue()

    return clean_bytes, meta, clean_img
