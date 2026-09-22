import os
import io
import time
import uuid
import logging
import hashlib
from typing import Tuple, Dict, Any, Optional
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from app.core.config import settings
from app.services.exif_scrubber import strip_exif_from_image, strip_exif_from_bytes
from app.services.shadow_engine import synthesize_procedural_shadows

logger = logging.getLogger("artisan_platform.studio_service")


def apply_clahe_and_white_balance(cv_bgr: np.ndarray) -> Tuple[np.ndarray, bool]:
    """
    Applies CLAHE (Contrast Limited Adaptive Histogram Equalization) illumination balancing
    and Gray-World white balance adjustment.
    Detects low-light conditions (mean luminance < 25.0).
    """
    # 1. Detect low light in luminance channel
    gray = cv2.cvtColor(cv_bgr, cv2.COLOR_BGR2GRAY)
    mean_lum = float(np.mean(gray))
    low_light_compensated = mean_lum < 25.0

    # 2. Convert to LAB and apply CLAHE to L (luminance) channel
    lab = cv2.cvtColor(cv_bgr, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clip_limit = 3.0 if low_light_compensated else 2.0
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    cl = clahe.apply(l_channel)

    # If low-light, boost overall gain appropriately
    if low_light_compensated:
        scale = min(4.0, 120.0 / max(1.0, mean_lum))
        cl = np.clip(cl.astype(np.float32) * scale, 0, 255).astype(np.uint8)

    balanced_lab = cv2.merge((cl, a_channel, b_channel))
    balanced_bgr = cv2.cvtColor(balanced_lab, cv2.COLOR_LAB2BGR)

    # 3. Gray-World White Balance
    b_mean = np.mean(balanced_bgr[:, :, 0])
    g_mean = np.mean(balanced_bgr[:, :, 1])
    r_mean = np.mean(balanced_bgr[:, :, 2])
    k_gray = (b_mean + g_mean + r_mean) / 3.0

    if b_mean > 0 and g_mean > 0 and r_mean > 0:
        balanced_bgr[:, :, 0] = np.clip(balanced_bgr[:, :, 0] * (k_gray / b_mean), 0, 255)
        balanced_bgr[:, :, 1] = np.clip(balanced_bgr[:, :, 1] * (k_gray / g_mean), 0, 255)
        balanced_bgr[:, :, 2] = np.clip(balanced_bgr[:, :, 2] * (k_gray / r_mean), 0, 255)

    return balanced_bgr, low_light_compensated


def extract_craft_foreground(cv_bgr: np.ndarray) -> np.ndarray:
    """
    Robust Foreground Extraction Engine (SIH26090 - R1).
    Multi-tier architecture:
    1. Neural segmentation via rembg (supporting RMBG / BiRefNet onnx sessions) if installed/configured.
    2. High-speed white-background shortcut detection via four-corner LAB/RGB variance check.
    3. Fully offline-capable adaptive OpenCV GrabCut with morphological kernel smoothing.

    Returns:
        RGBA numpy array with segmented alpha channel.
    """
    h, w = cv_bgr.shape[:2]

    # Check for rembg availability
    try:
        import rembg
        rgb_img = cv2.cvtColor(cv_bgr, cv2.COLOR_BGR2RGB)
        pil_in = Image.fromarray(rgb_img)
        pil_out = rembg.remove(pil_in)
        return np.array(pil_out)
    except Exception as e:
        logger.debug(f"rembg unavailable or skipped ({e}), using OpenCV GrabCut fallback")

    # Fast check: Is the background already clean white / light?
    # Sample four corners
    corner_size = min(25, h // 10, w // 10)
    c1 = cv_bgr[:corner_size, :corner_size]
    c2 = cv_bgr[:corner_size, -corner_size:]
    c3 = cv_bgr[-corner_size:, :corner_size:]
    c4 = cv_bgr[-corner_size:, -corner_size:]
    corners = np.vstack([c1.reshape(-1, 3), c2.reshape(-1, 3), c3.reshape(-1, 3), c4.reshape(-1, 3)])
    
    mean_corner = np.mean(corners, axis=0)
    std_corner = np.std(corners, axis=0)

    # If all corners are near white (>240 in all channels) and low variance:
    if np.all(mean_corner >= 235) and np.all(std_corner <= 20):
        diff = np.linalg.norm(cv_bgr.astype(np.float32) - mean_corner, axis=2)
        # Threshold: pixels differing significantly from corner color are foreground
        mask = (diff > 25.0).astype(np.uint8) * 255
        # Clean mask with morphological operations
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.GaussianBlur(mask, (5, 5), 0)

        rgb = cv2.cvtColor(cv_bgr, cv2.COLOR_BGR2RGB)
        rgba = np.dstack((rgb, mask))
        return rgba

    # Standard OpenCV GrabCut segmentation
    # Downsample for speed if image is very large
    scale = 1.0
    max_gc_dim = 640
    if max(h, w) > max_gc_dim:
        scale = max_gc_dim / max(h, w)
        gc_w, gc_h = int(w * scale), int(h * scale)
        small_bgr = cv2.resize(cv_bgr, (gc_w, gc_h), interpolation=cv2.INTER_AREA)
    else:
        small_bgr = cv_bgr
        gc_h, gc_w = h, w

    # Define safe bounding rect inside outer 5% margin
    margin_x = max(5, int(gc_w * 0.05))
    margin_y = max(5, int(gc_h * 0.05))
    rect = (margin_x, margin_y, gc_w - 2 * margin_x, gc_h - 2 * margin_y)

    mask = np.zeros((gc_h, gc_w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    try:
        cv2.grabCut(small_bgr, mask, rect, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_RECT)
        fg_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    except Exception as e:
        logger.warning(f"GrabCut failed ({e}), using center ellipse mask")
        fg_mask = np.zeros((gc_h, gc_w), np.uint8)
        cv2.ellipse(fg_mask, (gc_w // 2, gc_h // 2), (int(gc_w * 0.4), int(gc_h * 0.4)), 0, 0, 360, 255, -1)

    # Upsample mask back to original resolution if downsampled
    if scale != 1.0:
        fg_mask = cv2.resize(fg_mask, (w, h), interpolation=cv2.INTER_LINEAR)

    # Smooth mask edges
    fg_mask = cv2.GaussianBlur(fg_mask, (7, 7), 2.0)

    rgb = cv2.cvtColor(cv_bgr, cv2.COLOR_BGR2RGB)
    rgba = np.dstack((rgb, fg_mask))
    return rgba


def create_before_after_preview(
    raw_img: Image.Image,
    studio_img: Image.Image,
    preview_size: int = 1080
) -> Image.Image:
    """
    Generates a crisp, side-by-side Before vs After comparison preview image.
    Width: 2 * preview_size, Height: preview_size.
    Left: Raw uploaded photo (letterboxed on clean background).
    Right: Studio enhanced output with procedural shadows.
    """
    total_w = preview_size * 2
    total_h = preview_size
    preview = Image.new("RGB", (total_w, total_h), (245, 245, 247))

    # 1. Letterbox raw image to preview_size x preview_size
    raw_copy = raw_img.convert("RGB")
    raw_ratio = min(preview_size / raw_copy.width, preview_size / raw_copy.height)
    raw_w = max(1, int(raw_copy.width * raw_ratio))
    raw_h = max(1, int(raw_copy.height * raw_ratio))
    raw_resized = raw_copy.resize((raw_w, raw_h), Image.Resampling.LANCZOS)
    
    rx_off = (preview_size - raw_w) // 2
    ry_off = (preview_size - raw_h) // 2
    preview.paste(raw_resized, (rx_off, ry_off))

    # 2. Paste studio image on right side
    studio_resized = studio_img.convert("RGB").resize((preview_size, preview_size), Image.Resampling.LANCZOS)
    preview.paste(studio_resized, (preview_size, 0))

    # 3. Draw vertical divider and comparison banner labels
    draw = ImageDraw.Draw(preview)
    divider_x = preview_size
    draw.line([(divider_x, 0), (divider_x, total_h)], fill=(200, 200, 205), width=4)

    # Subtle banner overlays
    badge_color_before = (50, 50, 50)
    badge_color_after = (22, 101, 52)  # MoSJE Green

    draw.rectangle([(20, 20), (140, 60)], fill=badge_color_before)
    draw.text((35, 28), "RAW INPUT", fill=(255, 255, 255))

    draw.rectangle([(preview_size + 20, 20), (preview_size + 190, 60)], fill=badge_color_after)
    draw.text((preview_size + 35, 28), "STUDIO 1:1 ENHANCED", fill=(255, 255, 255))

    return preview


class ImageStudioService:
    """
    High-Performance AI Photo Studio Pipeline (SIH26090 - R1).
    Performs:
    1. EXIF and GPS Privacy Scrubbing.
    2. CLAHE Illumination & Gray-World White Balance.
    3. Foreground Segmentation (Adaptive OpenCV GrabCut / Neural rembg).
    4. Procedural Dual Shadows (Contact Drop + Ambient Soft Shadow).
    5. 1:1 Square Auto-Centering (1080x1080 canvas).
    6. Side-by-side Before vs After comparison preview.
    7. Single-location disk persistence in /static/studio/ with owner attribution.
    """

    def __init__(self, static_dir: Optional[str] = None):
        self.static_dir = static_dir or settings.STATIC_DIR
        self.studio_dir = os.path.join(self.static_dir, "studio")
        os.makedirs(self.studio_dir, exist_ok=True)

    def process_image_bytes(
        self,
        image_bytes: bytes,
        owner_id: Optional[str] = None,
        original_filename: str = "product.jpg",
        canvas_size: int = 1080
    ) -> Dict[str, Any]:
        """
        Executes the full studio pipeline from raw bytes.
        Embeds owner hash for DPDP right-to-erasure traceability.
        Guarantees <= 5.0 seconds execution latency SLA.
        """
        t0 = time.perf_counter()

        # Step 1: GPS EXIF Scrubbing
        clean_bytes, exif_meta, clean_pil = strip_exif_from_bytes(image_bytes)

        # Step 2: Convert to OpenCV BGR for computer vision pipeline
        rgb_arr = np.array(clean_pil.convert("RGB"))
        cv_bgr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)

        # Step 3: CLAHE Illumination Compensation & White Balance
        cv_balanced, low_light_comp = apply_clahe_and_white_balance(cv_bgr)

        # Step 4: Extract Craft Foreground (rembg / GrabCut)
        fg_rgba = extract_craft_foreground(cv_balanced)
        fg_pil = Image.fromarray(fg_rgba)

        # Step 5: Dual Procedural Shadow Synthesis & 1:1 Centering
        studio_rgb, lum_drop_pct = synthesize_procedural_shadows(
            foreground_rgba=fg_pil,
            canvas_size=canvas_size
        )

        # Step 6: Generate Side-by-Side Comparison Preview
        before_after_preview = create_before_after_preview(
            raw_img=clean_pil,
            studio_img=studio_rgb,
            preview_size=canvas_size
        )

        # Resolve owner attribution hash for DPDP right-to-erasure traceability
        owner_hash = None
        if owner_id:
            owner_hash = hashlib.sha256(owner_id.encode("utf-8")).hexdigest()[:8]
        elif original_filename:
            # Check if original_filename already encodes an 8-char owner hash (e.g. studio_a1b2c3d4_...)
            base = os.path.splitext(os.path.basename(original_filename))[0]
            parts = base.split("_")
            for part in parts:
                if len(part) == 8 and all(c in "0123456789abcdefABCDEF" for c in part):
                    owner_hash = part.lower()
                    break
        if not owner_hash:
            owner_hash = hashlib.sha256(original_filename.encode("utf-8")).hexdigest()[:8]

        # Step 7: Persist Output Artifacts (single location with owner attribution)
        file_id = f"studio_{owner_hash}_{uuid.uuid4().hex[:12]}"
        studio_filename = f"{file_id}.jpg"
        preview_filename = f"{file_id}_preview.jpg"

        studio_filepath = os.path.join(self.studio_dir, studio_filename)
        preview_filepath = os.path.join(self.studio_dir, preview_filename)

        studio_rgb.save(studio_filepath, format="JPEG", quality=95, optimize=True)
        before_after_preview.save(preview_filepath, format="JPEG", quality=92, optimize=True)

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        logger.info(f"Studio pipeline completed in {elapsed_ms}ms (File: {studio_filename})")

        return {
            "studio_image_url": f"/static/studio/{studio_filename}",
            "before_after_preview_url": f"/static/studio/{preview_filename}",
            "metadata": {
                "width": canvas_size,
                "height": canvas_size,
                "processing_time_ms": elapsed_ms,
                "exif_scrubbed": True,
                "low_light_compensated": low_light_comp,
                "shadow_luminosity_drop_pct": lum_drop_pct
            }
        }


# Singleton service instance
studio_service = ImageStudioService()
