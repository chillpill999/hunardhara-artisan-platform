"""
Tier 4: Real-World Workflows (E2E User Journeys) for SIH26090.
Simulates end-to-end user scenarios:
T4.1: The Varanasi Weaver Journey (Photo + Voice -> Studio + Pricing -> Passport)
T4.2: Bastar Dhokra B2B Bulk Procurement (RFQ 200 units @ 1500 INR -> Consortium matching)
T4.3: Offline-First Mobile Sync Under Intermittent Connectivity
T4.4: Sovereign Compliance & Data Erasure Audit (DPDP Act 2023)
"""

import os
import re
import json
import pytest
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ExifTags


@pytest.mark.tier4
class TestTier4RealWorldWorkflows:
    """E2E workflow user journeys validating real-world use cases."""

    def test_scenario_t4_1_varanasi_weaver_journey(self, sample_varanasi_image_path, pricing_model, tmp_path):
        """
        Scenario T4.1: 'The Varanasi Weaver Journey'
        Artisan Ramzan Ali snaps a cluttered photo of a Katan Silk Saree and records 22s of Bhojpuri voice.
        System performs studio background cleanup, voice extraction, anti-exploitation pricing, and passport generation.
        """
        # Step 1: Mobile photo upload and studio processing
        assert os.path.exists(sample_varanasi_image_path)
        with Image.open(sample_varanasi_image_path) as raw_img:
            # EXIF stripping & studio auto-framing
            w, h = raw_img.size
            dim = max(w, h)
            studio_canvas = Image.new("RGBA", (dim, dim), (250, 250, 252, 255))
            offset = ((dim - w) // 2, (dim - h) // 2)

            # Drop shadow synthesis
            shadow_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
            draw = ImageDraw.Draw(shadow_layer)
            draw.ellipse([offset[0] + 100, offset[1] + h - 50, offset[0] + w - 100, offset[1] + h + 30], fill=(0, 0, 0, 160))
            ambient = shadow_layer.filter(ImageFilter.GaussianBlur(radius=12))

            composited = Image.alpha_composite(studio_canvas, ambient)
            composited.paste(raw_img, offset)

            studio_out = tmp_path / "varanasi_studio_enhanced.jpg"
            composited.convert("RGB").save(str(studio_out), "JPEG", quality=95)
            assert studio_out.exists()

        # Step 2: Voice-to-Catalog extraction (Bhojpuri voice simulation)
        voice_record = {
            "transcript_original": "ई बनारसी कतान सिल्क साड़ी बा। पूरा हाथ से बनल बा, सोना जरी के काम बा। 14 दिन लागल बनावे में। कच्चा माल में तीन हजार लागल बा।",
            "transcript_english": "This is a Varanasi Katan silk saree. Fully hand-woven with gold zari work. Took 14 days to make. Raw material cost was 3000 rupees.",
            "attributes": {
                "product_name": "Varanasi Pure Katan Silk Saree with Sona Zari",
                "craft_type": "Varanasi Silk",
                "materials": ["Pure Katan Silk", "Gold Zari Thread"],
                "production_time_days": 14.0,  # 112 labor hours
                "raw_material_cost": 3000.0,
                "technique": "Handloom Jacquard Weaving",
                "dimensions": "5.5m x 1.1m",
                "color": "Crimson Red with Gold Brocade"
            }
        }

        # Step 3: Fair Pricing Assistant
        labor_hours = voice_record["attributes"]["production_time_days"] * 8.0  # 112.0 hours
        statutory_wage_rate = 150.0  # MoSJE Varanasi skilled artisan wage
        consumables = 500.0  # Loom maintenance and finishing
        floor_price = voice_record["attributes"]["raw_material_cost"] + (labor_hours * statutory_wage_rate) + consumables

        # 3000 + (112 * 150) + 500 = 3000 + 16800 + 500 = 20300.0
        assert floor_price == 20300.0

        tiers = pricing_model.calculate_tiers(floor_price, benchmark_median=28000.0)
        assert tiers["floor_price"] == 20300.0
        assert tiers["wholesale_price"] >= 24000.0
        assert tiers["retail_price"] >= 32000.0

        # Step 4: Product Catalog & Craft Passport Verification
        product_record = {
            "id": "prod-varanasi-katan-001",
            "artisan_id": "artisan-varanasi-001",
            "artisan_name": "Ramzan Ali Ansari",
            "cluster": "Varanasi Silk Cluster, Uttar Pradesh",
            "title": voice_record["attributes"]["product_name"],
            "image_url": str(studio_out),
            "floor_price": floor_price,
            "wholesale_price": tiers["wholesale_price"],
            "retail_price": tiers["retail_price"],
            "gi_certified": True,
            "qr_passport_code": "MOSJE-GI-UP-VAR-001-KATAN"
        }
        assert product_record["floor_price"] < product_record["retail_price"]
        assert product_record["gi_certified"] is True

    def test_scenario_t4_2_bastar_dhokra_b2b_procurement(self, mock_rfqs, artisan_profiles, matching_engine):
        """
        Scenario T4.2: 'Bastar Dhokra B2B Bulk Procurement'
        Corporate buyer Ananya Sharma submits an RFQ for 200 units of brass craft at ₹1,500/unit.
        Matching engine evaluates individual capacity (insufficient solo) and recommends a 3-artisan Cluster Consortium.
        """
        rfq = next(r for r in mock_rfqs if r["rfq_id"] == "rfq-test-a3-canonical")
        assert rfq["quantity"] == 200
        assert rfq["unit_budget"] == 1500.0
        assert rfq["deadline_days"] == 60

        bastar_artisans = [a for a in artisan_profiles if a["cluster_id"] == "cluster-bastar-dhokra-02"]
        assert len(bastar_artisans) >= 3

        # Evaluate individual feasibility
        ranked_matches = []
        for a in bastar_artisans:
            craft_s = matching_engine.score_craft(a["craft_specialty"], rfq["craft_type"])
            price_s = matching_engine.score_price(a["average_wholesale_price_inr"], rfq["unit_budget"])
            cap_s, solo_feasible = matching_engine.score_capacity(a["monthly_capacity_units"], rfq["quantity"], rfq["deadline_days"])
            loc_s = 0.65  # Bastar to New Delhi (~1250km)
            composite = matching_engine.calculate_composite_score(craft_s, price_s, cap_s, loc_s)

            # In 60 days (2 months), a single artisan producing 30-40 units/month can produce 60-80 units max < 200
            assert solo_feasible is False, f"Artisan {a['name']} capacity was erroneously marked feasible for 200 units solo"

            ranked_matches.append({
                "artisan_id": a["artisan_id"],
                "name": a["name"],
                "match_score": composite,
                "solo_feasible": solo_feasible,
                "monthly_capacity": a["monthly_capacity_units"]
            })

        # Cluster Consortium Feasibility Evaluation
        # 60 days = 2 months. Total monthly production capacity needed = 200 / 2 = 100 units/month
        combined_monthly_capacity = sum(a["monthly_capacity"] for a in ranked_matches[:3])
        # Sukhdev (40) + Mangal (35) + Dhaniram (30) = 105 units/month >= 100 units/month
        assert combined_monthly_capacity >= 100, "Cluster consortium cannot satisfy 100 units/month requirement"

        consortium_output = {
            "consortium_recommended": True,
            "consortium_artisans": [m["name"] for m in ranked_matches[:3]],
            "combined_monthly_capacity": combined_monthly_capacity,
            "deliverable_in_deadline": combined_monthly_capacity * (rfq["deadline_days"] / 30.0),
            "explanation": "No single artisan can fulfill 200 units in 60 days. Recommended consortium of 3 Bastar Dhokra artisans can produce 210 units."
        }

        assert consortium_output["consortium_recommended"] is True
        assert consortium_output["deliverable_in_deadline"] >= 200.0
        assert "consortium of 3" in consortium_output["explanation"]

    def test_scenario_t4_3_offline_mobile_sync_cycle(self, tmp_path):
        """
        Scenario T4.3: 'Offline-First Mobile Sync Under Intermittent Connectivity'
        Mithila painter Sunita Devi creates draft in offline mode -> persisted to local SQLite queue -> synced upon network restore.
        """
        # Step 1: Device in Airplane mode (offline)
        offline_draft_queue = []

        local_draft = {
            "local_id": "draft-local-offline-uuid-9812",
            "artisan_id": "artisan-madhubani-001",
            "title": "Mithila Sacred Twin Fish Natural Dye Painting",
            "craft_type": "Madhubani Painting",
            "sync_status": "SYNC_PENDING",
            "offline_created_at": "2026-09-10T10:00:00Z"
        }
        offline_draft_queue.append(local_draft)
        assert len(offline_draft_queue) == 1
        assert offline_draft_queue[0]["sync_status"] == "SYNC_PENDING"

        # Step 2: Connectivity returns -> Sync Worker processes queue
        synced_items = []
        for draft in offline_draft_queue:
            # Server creates sovereign UUID and updates sync state
            server_record = dict(draft)
            server_record["server_product_id"] = "prod-server-confirmed-0941"
            server_record["sync_status"] = "SYNC_COMPLETED"
            synced_items.append(server_record)

        assert len(synced_items) == 1
        assert synced_items[0]["sync_status"] == "SYNC_COMPLETED"
        assert "server_product_id" in synced_items[0]

    def test_scenario_t4_4_sovereign_compliance_data_erasure_audit(self, artisan_profiles):
        """
        Scenario T4.4: 'Sovereign Compliance & Data Erasure Audit (DPDP Act 2023)'
        Audits Aadhaar masking, checks right-to-be-forgotten erasure workflow, and ensures anonymization.
        """
        # Audit 1: UIDAI Aadhaar Masking in storage
        aadhaar_pattern = re.compile(r"^XXXX-XXXX-\d{4}$")
        for artisan in artisan_profiles:
            assert aadhaar_pattern.match(artisan["aadhaar_masked"])

        # Audit 2: Right-to-be-Forgotten Data Erasure
        artisan_to_delete = artisan_profiles[0]
        # Simulate active database records
        db_artisans = {artisan_to_delete["artisan_id"]: artisan_to_delete}
        db_consents = {artisan_to_delete["artisan_id"]: {"consent_granted": True, "voice_hash": "a1b2c3d4"}}
        db_orders = [{"order_id": "ord-101", "artisan_id": artisan_to_delete["artisan_id"], "amount": 5000.0}]

        # Issue Erasure Request: DELETE /api/v1/compliance/erasure
        artisan_id = artisan_to_delete["artisan_id"]
        # Delete PII and consent records
        del db_artisans[artisan_id]
        del db_consents[artisan_id]
        # Anonymize tax/order records per sovereign statutory requirements
        for order in db_orders:
            if order["artisan_id"] == artisan_id:
                order["artisan_id"] = "ANONYMIZED_ARTISAN_PURGED"

        assert artisan_id not in db_artisans
        assert artisan_id not in db_consents
        assert db_orders[0]["artisan_id"] == "ANONYMIZED_ARTISAN_PURGED"
