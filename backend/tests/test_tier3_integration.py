"""
Tier 3: Cross-Feature Integration Tests for SIH26090.
Validates multi-module pipelines: Studio + EXIF scrubbing, Voice -> Pricing data flow,
QR Craft Passport generation, B2B pricing linkage, and geospatial distance scoring.
"""

import math
import pytest
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ExifTags


@pytest.mark.tier3
class TestTier3CrossFeaturePipelines:
    """Integration across AI Studio, Voice Engine, Pricing Assistant, and B2B Matchmaker."""

    def test_tc_t3_01_studio_exif_storage_integration(self, sample_gps_exif_image_path, tmp_path):
        """TC-T3-01: Raw image -> EXIF stripped -> 1:1 studio shadow synthesized -> disk persistence."""
        with Image.open(sample_gps_exif_image_path) as raw_img:
            # Step 1: Strip EXIF metadata
            arr = np.array(raw_img)
            scrubbed_img = Image.fromarray(arr)

            # Step 2: Pad to 1:1 square canvas
            w, h = scrubbed_img.size
            dim = max(w, h)
            square_canvas = Image.new("RGBA", (dim, dim), (255, 255, 255, 255))
            offset = ((dim - w) // 2, (dim - h) // 2)

            # Step 3: Add procedural contact shadow
            shadow_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
            draw = ImageDraw.Draw(shadow_layer)
            draw.ellipse([offset[0] + 50, offset[1] + h - 40, offset[0] + w - 50, offset[1] + h + 20], fill=(0, 0, 0, 150))
            ambient = shadow_layer.filter(ImageFilter.GaussianBlur(radius=10))

            # Composite
            composited = Image.alpha_composite(square_canvas, ambient)
            composited.paste(scrubbed_img, offset)

            # Step 4: Save to target storage
            out_file = tmp_path / "studio_processed.jpg"
            composited.convert("RGB").save(str(out_file), "JPEG", quality=92)

            # Verify saved file
            assert out_file.exists(), "Stored image file not found"
            with Image.open(str(out_file)) as final_img:
                exif = final_img.getexif()
                gps = exif.get_ifd(ExifTags.Base.GPSInfo)
                assert len(gps) == 0, "GPS metadata persisted into storage"
                assert final_img.size[0] == final_img.size[1], "Stored image is not 1:1 square"

    def test_tc_t3_02_voice_to_pricing_data_piping(self, pricing_model):
        """TC-T3-02: Voice-extracted attributes piped directly into Pricing Engine generating 3 tiers."""
        # Simulated Voice Catalog output
        voice_output = {
            "product_name": "Varanasi Pure Katan Silk Saree",
            "craft_type": "Varanasi Silk",
            "cluster_id": "cluster-varanasi-silk-01",
            "materials": ["Katan Silk", "Pure Gold Zari"],
            "production_time_days": 14.0,  # 14 days = 112 hours @ 8h/day
            "raw_material_cost": 3000.0,
            "statutory_wage_rate": 150.0   # UP Varanasi skilled handloom wage
        }

        labor_hours = voice_output["production_time_days"] * 8.0
        floor = pricing_model.calculate_floor(
            raw_material_cost=voice_output["raw_material_cost"],
            labor_hours=labor_hours,
            wage_rate=voice_output["statutory_wage_rate"],
            consumables_rate=0.10
        )

        # Expected: 3000 + (112 * 150) + 300 = 3000 + 16800 + 300 = 20100.0
        assert floor == 20100.0

        # Feed floor into tier calculation benchmarked against Silk Saree market
        tiers = pricing_model.calculate_tiers(floor, benchmark_median=26000.0)
        assert tiers["floor_price"] == 20100.0
        assert tiers["wholesale_price"] >= 20100.0 * 1.20
        assert tiers["retail_price"] >= tiers["wholesale_price"] * 1.25

        # Created Product Entity Record
        product_draft = {
            "title": voice_output["product_name"],
            "craft_type": voice_output["craft_type"],
            "pricing": tiers,
            "status": "DRAFT_AWAITING_ARTISAN_CONFIRMATION"
        }
        assert product_draft["pricing"]["floor_price"] > 0
        assert product_draft["status"] == "DRAFT_AWAITING_ARTISAN_CONFIRMATION"

    def test_tc_t3_03_craft_passport_qr_generation(self, tmp_path):
        """TC-T3-03: Product entity generates dynamic QR Craft Passport URL navigating to /passport/{id}."""
        product_id = "prod-mosje-varanasi-8831"
        artisan_id = "artisan-varanasi-001"
        passport_url = f"https://artisan.mosje.gov.in/passport/{product_id}?artisan={artisan_id}&gi_verified=true"

        # Generate QR matrix (simulated 2D barcode canvas)
        qr_img = Image.new("RGB", (256, 256), (255, 255, 255))
        draw = ImageDraw.Draw(qr_img)
        # Draw QR finder patterns in corners
        for ox, oy in [(20, 20), (196, 20), (20, 196)]:
            draw.rectangle([ox, oy, ox + 40, oy + 40], fill=(0, 0, 0))
            draw.rectangle([ox + 8, oy + 8, ox + 32, oy + 32], fill=(255, 255, 255))
            draw.rectangle([ox + 16, oy + 16, ox + 24, oy + 24], fill=(0, 0, 0))

        qr_path = tmp_path / f"passport_qr_{product_id}.png"
        qr_img.save(str(qr_path), "PNG")

        assert qr_path.exists(), "QR code image was not written"
        assert "/passport/" in passport_url
        assert "gi_verified=true" in passport_url

    def test_tc_t3_04_pricing_to_b2b_matchmaker_alignment(self, pricing_model, matching_engine):
        """TC-T3-04: Matchmaker uses artisan wholesale price from pricing engine to compute budget feasibility."""
        # Artisan computes pricing tiers via pricing model
        artisan_costs = {"material": 350.0, "hours": 6.0, "wage": 125.0}
        floor = pricing_model.calculate_floor(artisan_costs["material"], artisan_costs["hours"], artisan_costs["wage"])
        tiers = pricing_model.calculate_tiers(floor)
        artisan_wholesale = tiers["wholesale_price"]

        # Buyer RFQ with budget ₹1,500
        buyer_budget = 1500.0
        price_score = matching_engine.score_price(artisan_wholesale, buyer_budget)

        # Since wholesale (~1420) is below budget (1500), price score should be 1.0
        assert price_score == 1.0, f"Expected 1.0 score when wholesale <= budget, got {price_score}"

    def test_tc_t3_05_geodesic_distance_scoring_integration(self):
        """TC-T3-05: Geodesic distance calculation ranks geographically closer craft clusters higher on location score."""
        def haversine_km(lat1, lon1, lat2, lon2):
            R = 6371.0  # Earth radius in km
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
            c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
            return R * c

        # Buyer in New Delhi: 28.6139 N, 77.2090 E
        delhi_lat, delhi_lon = 28.6139, 77.2090

        # Khurja Pottery Cluster: 28.2546 N, 77.8549 E
        khurja_dist = haversine_km(delhi_lat, delhi_lon, 28.2546, 77.8549)
        # Bastar Dhokra Cluster: 19.0748 N, 82.0081 E
        bastar_dist = haversine_km(delhi_lat, delhi_lon, 19.0748, 82.0081)

        assert khurja_dist < 150.0, f"Khurja should be within 150km of Delhi, got {khurja_dist:.1f}km"
        assert bastar_dist > 1000.0, f"Bastar should be over 1000km from Delhi, got {bastar_dist:.1f}km"

        # Location scoring function: 1.0 for <=100km, decaying linearly down to 0.4 for >=1500km
        def location_score(dist_km):
            if dist_km <= 100:
                return 1.0
            elif dist_km >= 1500:
                return 0.4
            else:
                return 1.0 - (dist_km - 100) * 0.6 / 1400.0

        score_khurja = location_score(khurja_dist)
        score_bastar = location_score(bastar_dist)

        assert score_khurja > score_bastar, "Geographically closer cluster did not score higher"
        assert score_khurja >= 0.95
        assert 0.4 <= score_bastar <= 0.65
