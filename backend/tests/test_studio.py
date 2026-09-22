import os
import io
import pytest
import numpy as np
from PIL import Image, ExifTags
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token
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
        token = create_access_token("art-studio-test-01", extra_claims={"app_metadata": {"role": "artisan"}})
        with open(sample_dhokra_image_path, "rb") as f:
            res = client.post(
                "/api/v1/products/studio",
                files={"image": ("dhokra.jpg", f, "image/jpeg")},
                data={"canvas_size": 1080},
                headers={"Authorization": f"Bearer {token}"}
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
        token = create_access_token("art-studio-test-01", extra_claims={"app_metadata": {"role": "artisan"}})
        res = client.post(
            "/api/v1/products/studio",
            files={"image": ("corrupt.jpg", b"not_an_image", "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 400

    def test_studio_endpoint_anonymous_rejected(self, client, sample_dhokra_image_path):
        """TC-STUDIO-07: Verifies anonymous request to studio upload returns 401."""
        with open(sample_dhokra_image_path, "rb") as f:
            res = client.post(
                "/api/v1/products/studio",
                files={"image": ("dhokra.jpg", f, "image/jpeg")},
                data={"canvas_size": 1080}
            )
        assert res.status_code == 401

    def test_studio_output_includes_owner_hash(self, sample_dhokra_image_path):
        """TC-STUDIO-08: Verifies studio_service generates filenames containing owner hash for DPDP tracking."""
        import hashlib
        owner_id = "artisan-dpdp-owner-123"
        expected_hash = hashlib.sha256(owner_id.encode("utf-8")).hexdigest()[:8]

        with open(sample_dhokra_image_path, "rb") as f:
            raw_bytes = f.read()

        result = studio_service.process_image_bytes(
            image_bytes=raw_bytes,
            original_filename="craft.jpg",
            owner_id=owner_id
        )
        assert expected_hash in result["studio_image_url"]
        assert expected_hash in result["before_after_preview_url"]
        # Verify only saved to static/studio, not studio_outputs
        assert "/static/studio/" in result["studio_image_url"]
        assert "/static/studio_outputs/" not in result["studio_image_url"]

    def test_studio_upload_endpoint_embeds_owner_hash(self, client, sample_dhokra_image_path):
        """TC-STUDIO-09: Verifies studio upload endpoint embeds authenticated user's hash into output URLs."""
        import hashlib
        user_id = "art-endpoint-user-888"
        expected_hash = hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:8]
        token = create_access_token(user_id, extra_claims={"app_metadata": {"role": "artisan"}})

        with open(sample_dhokra_image_path, "rb") as f:
            res = client.post(
                "/api/v1/products/studio",
                files={"image": ("dhokra.jpg", f, "image/jpeg")},
                data={"canvas_size": 1080},
                headers={"Authorization": f"Bearer {token}"}
            )
        assert res.status_code == 200
        data = res.json()
        assert expected_hash in data["studio_image_url"]
        assert expected_hash in data["before_after_preview_url"]


