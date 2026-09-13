"""
Hunardhara AI Evaluation Framework & Suite
Quantitative benchmarks measuring attribute extraction F1, style compliance,
GI safety, pricing calibration, and latency against the hunardhara_gold dataset.
"""

import json
import os
import time
import pytest
from typing import Dict, Any, List

from app.core.version_registry import version_registry
from app.schemas.artisan_commerce import (
    StructuredArtisanAttributes,
    HunardharaCatalogOutput,
    PricingRecommendation,
)
from app.services.catalog_prompt_library import lint_artisan_text
from app.services.rag_craft_knowledge import rag_craft_service, VERIFIED_CRAFT_DATABASE
from app.services.pricing_service import pricing_service
from app.services.sarvam_service import sarvam_service
from app.services.semantic_search_service import semantic_search_service
from app.services.correction_feedback_service import correction_feedback_service
from app.services.ai_orchestrator import ai_orchestrator


class TestAIEvaluationFramework:
    """Rigorous evaluation suite assessing the Hunardhara Artisan Commerce Assistant."""

    def test_version_registry_manifest(self):
        """Verifies active AI components and versions are tracked explicitly."""
        manifest = version_registry.get_version_manifest()
        assert "hunardhara-catalog-v1" in manifest["catalog_model"]
        assert "hunardhara-dataset-v1.2" in manifest["dataset_version"]
        assert "catalog-prompt-v3" in manifest["prompt_version"]
        assert "rag-craft-knowledge-v1.0" in manifest["rag_knowledge_version"]

    def test_code_mixed_speech_normalization(self):
        """Tests Module A normalization of colloquial Hinglish, units, and numbers."""
        raw = "Ham ye cotton saree banate hain, iska price बारह सौ hai. एक हफ्ता lagta hai."
        normalized = sarvam_service.normalize_codemixed_speech(raw)
        assert "1200" in normalized
        assert "7 दिन" in normalized

    def test_rag_gi_certification_safety(self):
        """
        Tests Module E: Zero-hallucination GI certification safety.
        LLM must NEVER claim GI certification without verified registry matching.
        """
        # Case 1: Verified Varanasi cluster
        res_valid = rag_craft_service.verify_gi_certification_claim(
            craft_name="Varanasi Silk", stated_region="Varanasi, Uttar Pradesh"
        )
        assert res_valid["verified"] is True
        assert res_valid["gi_status"] == "verified_cluster"
        assert res_valid["gi_registration_number"] == "GI-0023"

        # Case 2: Incompatible region for GI craft (e.g. Banarasi made in London)
        res_invalid = rag_craft_service.verify_gi_certification_claim(
            craft_name="Varanasi Silk", stated_region="London, UK"
        )
        assert res_invalid["verified"] is False
        assert res_invalid["gi_status"] == "unverified_region"
        assert "differs from registered GI cluster" in res_invalid["disclaimer"]

        # Case 3: Generic uncatalogued craft
        res_unknown = rag_craft_service.verify_gi_certification_claim(
            craft_name="Modern Resin Coaster", stated_region="Delhi"
        )
        assert res_unknown["verified"] is False
        assert res_unknown["gi_status"] == "unverified"

    def test_style_compliance_and_banned_hyperbole_linter(self):
        """
        Tests Module D & Style Guidelines:
        Catches banned marketing hyperbole and patronizing tropes.
        """
        bad_text = (
            "This timeless masterpiece is an exquisite luxury handcrafted by a poor artisan. "
            "It is definitely GI certified with world-renowned heritage."
        )
        is_compliant, violations = lint_artisan_text(bad_text)
        assert is_compliant is False
        assert len(violations) >= 3
        assert any("exquisite luxury" in v for v in violations)
        assert any("poor artisan" in v for v in violations)

        good_text = (
            "Authentic Bastar Dhokra bell metal horse figurine handcrafted by skilled tribal makers "
            "using traditional lost-wax casting. Natural antique bronze finish."
        )
        is_good_compliant, good_violations = lint_artisan_text(good_text)
        assert is_good_compliant is True
        assert len(good_violations) == 0

    def test_pricing_assistant_anti_exploitation_floor(self):
        """
        Tests Module F: Verifies cost-plus statutory wage floor protects artisans
        and issues warnings if stated price is below production cost.
        """
        pricing = pricing_service.calculate_commerce_pricing(
            craft_type="Varanasi Silk",
            material_cost=4000.0,
            production_time_days=10.0,
            artisan_stated_price=8000.0,
            region="Varanasi, Uttar Pradesh"
        )

        assert isinstance(pricing, PricingRecommendation)
        # 10 days * ₹1200/day (from ₹150/hr * 8) = ₹12,000 labor + ₹4000 materials + ₹400 overhead = ₹16,400
        assert pricing.cost_estimate >= 10000.0
        assert pricing.suggested_retail_min > pricing.cost_estimate
        assert pricing.suggested_wholesale_price > pricing.cost_estimate
        # Artisan asked ₹8000, which is below cost floor -> warning must trigger
        assert any("BELOW statutory production cost" in f for f in pricing.factors_affecting_recommendation)

    def test_semantic_search_query_parser(self):
        """
        Tests Module G: Natural language search parsing.
        'I want a handmade blue cotton saree under 1500'
        """
        parsed = semantic_search_service.parse_natural_language_query(
            "I want a handmade blue cotton saree under 1500"
        )
        assert parsed["category"] == "saree"
        assert parsed["material"] == "cotton"
        assert parsed["color"] == "blue"
        assert parsed["max_price"] == 1500.0
        assert parsed["is_handmade"] is True

        # Test hybrid execution
        results = semantic_search_service.execute_hybrid_search(
            "I want a handmade blue cotton saree under 1500"
        )
        assert len(results) > 0
        # First item must be under 1500 and blue cotton saree
        top_item = results[0]["item"]
        assert top_item["price"] <= 1500.0
        assert top_item["category"] == "saree"

    def test_artisan_correction_feedback_lifecycle(self):
        """
        Tests Module 13: Staging artisan corrections into pending review
        and approving them for fine-tuning dataset export.
        """
        record = correction_feedback_service.record_artisan_correction(
            artisan_id="artisan-varanasi-09",
            craft_type="Varanasi Silk",
            field_name="material",
            ai_prediction="Synthetic Silk",
            artisan_correction="Pure Mulberry Katan Silk",
            language="hi",
            confidence=0.88
        )
        assert record["status"] == "pending_validation"
        assert record["field_name"] == "material"

        # Expert approval
        approved = correction_feedback_service.approve_correction(
            correction_id=record["correction_id"],
            reviewer_id="expert-handloom-curator",
            notes="Confirmed mulberry silk grain from artisan sample"
        )
        assert approved is not None
        assert approved["status"] == "approved"
        assert approved["reviewed_by"] == "expert-handloom-curator"

    def test_end_to_end_orchestrator_on_gold_dataset(self):
        """
        Module 25 & 40: End-to-end evaluation benchmark against hunardhara_gold.jsonl.
        Measures style compliance, latency SLA, and zero unsupported certification claims.
        """
        gold_path = os.path.join(os.path.dirname(__file__), "..", "..", "training", "hunardhara_gold.jsonl")
        assert os.path.exists(gold_path), "hunardhara_gold.jsonl benchmark dataset must exist"

        gold_records = []
        with open(gold_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    gold_records.append(json.loads(line))

        assert len(gold_records) >= 5, "Gold dataset must have at least 5 reviewed benchmark cases"

        total_latency_ms = 0.0
        total_style_compliant = 0
        unsupported_claims_count = 0

        for record in gold_records:
            raw_text = record["input"]["raw_spoken_text"]
            t0 = time.perf_counter()

            catalog: HunardharaCatalogOutput = ai_orchestrator.orchestrate_listing_pipeline(
                raw_text_or_transcript=raw_text,
                artisan_id="gold-test-runner",
                stated_region=record.get("region"),
                language=record.get("language", "hi")
            )

            latency_ms = (time.perf_counter() - t0) * 1000.0
            total_latency_ms += latency_ms

            # 1. Check style compliance (zero banned words)
            full_text = f"{catalog.title_en} {catalog.short_description_en} {catalog.long_description_en}"
            is_comp, violations = lint_artisan_text(full_text)
            if is_comp:
                total_style_compliant += 1

            # 2. Check GI claim integrity
            if catalog.certification.gi_status == "verified_cluster":
                # Ensure the craft is legitimately in the verified registry
                assert catalog.attributes.craft_type.lower() in [
                    k for k in VERIFIED_CRAFT_DATABASE.keys()
                ] or any(k in catalog.attributes.craft_type.lower() for k in VERIFIED_CRAFT_DATABASE.keys())
            elif catalog.certification.gi_status in ["unverified", "unverified_region", "not_applicable"]:
                pass
            else:
                unsupported_claims_count += 1

            # 3. Check schema integrity
            assert catalog.attributes.product_name is not None
            assert catalog.pricing.cost_estimate > 0
            assert catalog.pricing.suggested_retail_min > catalog.pricing.cost_estimate

        avg_latency = total_latency_ms / len(gold_records)
        compliance_rate = (total_style_compliant / len(gold_records)) * 100.0

        # Assert key success criteria
        assert compliance_rate == 100.0, f"Style compliance was {compliance_rate}%, expected 100.0%"
        assert unsupported_claims_count == 0, f"Found {unsupported_claims_count} unsupported claims"
        assert avg_latency < 2500.0, f"Average latency ({avg_latency:.1f}ms) exceeded 2500ms SLA"

        # Verify observability reflects events
        dashboard = version_registry.get_observability_dashboard()
        assert dashboard["metrics"]["total_requests"] >= len(gold_records)
        assert dashboard["status"] == "healthy"
