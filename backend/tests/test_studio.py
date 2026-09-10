import os
import io
import pytest
import numpy as np
from PIL import Image, ExifTags
from fastapi.testclient import TestClient

from app.main import app
from app.services.exif_scrubber import strip_exif_from_image, strip_exif_from_bytes
from app.services.shadow_engine import synthesize_procedural_shadows
from app.services.studio_service import (
    apply_clahe_and_white_balance,
    create_before_after_preview,
    studio_service
)


@pytest.fixture
def client():
    return TestClient(app)


class TestImageStudioPipeline:
    """R1: AI Photo Studio Pipeline Test Suite."""

    def test_exif_scrubber_purges_gps_metadata(self, sample_gps_exif_image_path):
        """TC-STUDIO-01: Verifies GPS EXIF tags are completely stripped."""
        with open(sample_gps_exif_image_path, "rb") as f:
            raw_bytes = f.read()

        clean_bytes, meta, clean_img = strip_exif_from_bytes(raw_bytes)
        assert meta["exif_scrubbed"] is True
        assert meta["gps_removed"] is True

        # Check clean image has zero GPS tags
        clean_exif = clean_img.getexif()
        assert len(clean_exif.get_ifd(ExifTags.Base.GPSInfo)) == 0

    def test_procedural_shadows_luminosity_drop(self, sample_dhokra_image_path):
        """TC-STUDIO-02: Verifies synthesized shadow creates >=30% luminosity drop."""
        with Image.open(sample_dhokra_image_path) as img:
            canvas_img, drop_pct = synthesize_procedural_shadows(img, canvas_size=1080)
            assert canvas_img.width == 1080
            assert canvas_img.height == 1080
            assert drop_pct >= 30.0, f"Shadow luminosity drop {drop_pct}% < 30%"

    def test_clahe_low_light_compensation(self, fixture_paths):
        """TC-STUDIO-03: Verifies CLAHE boosts low-light craft images (<20 lux)."""
        low_light_path = os.path.join(fixture_paths["images"], "edge_low_light_under20lux.jpg")
        with open(low_light_path, "rb") as f:
            raw_bytes = f.read()

        res = studio_service.process_image_bytes(raw_bytes, original_filename="low_light.jpg")
        assert res["metadata"]["low_light_compensated"] is True
        assert res["metadata"]["shadow_luminosity_drop_pct"] >= 30.0

    def test_before_after_preview_dimensions(self, sample_dhokra_image_path):
        """TC-STUDIO-04: Verifies Before/After comparison image is 2:1 side-by-side composite."""
        with Image.open(sample_dhokra_image_path) as raw_img:
            studio_img, _ = synthesize_procedural_shadows(raw_img, canvas_size=1080)
            preview = create_before_after_preview(raw_img, studio_img, preview_size=1080)
            assert preview.width == 2160
            assert preview.height == 1080

    def test_studio_endpoint_upload(self, client, sample_dhokra_image_path):
        """TC-STUDIO-05: Verifies POST /api/v1/products/studio multipart upload."""
        with open(sample_dhokra_image_path, "rb") as f:
            res = client.post(
                "/api/v1/products/studio",
                files={"image": ("dhokra.jpg", f, "image/jpeg")},
                data={"canvas_size": 1080}
            )
        assert res.status_code == 200
        data = res.json()
        assert "studio_image_url" in data
        assert "before_after_preview_url" in data
        assert data["metadata"]["width"] == 1080
        assert data["metadata"]["height"] == 1080
        assert data["metadata"]["exif_scrubbed"] is True
        assert data["metadata"]["shadow_luminosity_drop_pct"] >= 30.0

    def test_studio_endpoint_corrupt_data_rejected(self, client):
        """TC-STUDIO-06: Verifies empty or corrupted image data is rejected with HTTP 400."""
        res = client.post(
            "/api/v1/products/studio",
            files={"image": ("corrupt.jpg", b"not_an_image", "image/jpeg")}
        )
        assert res.status_code == 400

