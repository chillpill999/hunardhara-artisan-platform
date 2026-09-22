import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.pricing_service import pricing_service
from app.services.embedding_service import embedding_service


@pytest.fixture
def client():
    return TestClient(app)


class TestSmartPricingAssistant:
    """R3: Smart Pricing Assistant Test Suite."""

    def test_cost_plus_floor_calculation(self):
        """TC-PRICE-01: Floor Price = Material Cost + (Labor Hours * Statutory Wage) + 10% Overhead."""
        floor = pricing_service.calculate_floor(
            raw_material_cost=400.0,
            labor_hours=8.0,
            wage_rate=120.0,
            consumables_rate=0.10
        )
        assert floor == 1400.0

    def test_zero_material_upcycled_craft_allowance(self):
        """TC-PRICE-02: Zero raw material cost enforces minimum fixed allowance of 50.0 INR."""
        floor = pricing_service.calculate_floor(
            raw_material_cost=0.0,
            labor_hours=12.0,
            wage_rate=150.0
        )
        assert floor == 1850.0

    def test_three_tier_strict_inequality(self):
        """TC-PRICE-03: Floor Price < Wholesale B2B Price < Recommended D2C Retail Price."""
        tiers = pricing_service.calculate_tiers(floor_price=1460.0, benchmark_median=2200.0)
        assert tiers["floor_price"] == 1460.0
        assert tiers["floor_price"] < tiers["wholesale_price"]
        assert tiers["wholesale_price"] < tiers["retail_price"]

    def test_cold_start_empty_vector_db_fallback(self):
        """TC-PRICE-04: Cold start fallback applies standard multipliers (1.25x / 1.60x)."""
        tiers = pricing_service.calculate_tiers(floor_price=1500.0, benchmark_median=None)
        assert tiers["floor_price"] == 1500.0
        assert tiers["wholesale_price"] == 1875.0
        assert tiers["retail_price"] == 2400.0
        assert tiers["floor_price"] < tiers["wholesale_price"] < tiers["retail_price"]

    def test_bilingual_rationale_content(self):
        """TC-PRICE-05: Rationale explains MoSJE wage protection, materials, and benchmarks."""
        res = pricing_service.estimate_pricing(
            craft_type="Bastar Dhokra",
            materials_cost=350.0,
            labor_hours=24.0
        )
        en = res.rationale_english
        hi = res.rationale_hindi

        assert "MoSJE" in en
        assert "labor hours" in en
        assert "raw material cost" in en
        assert "benchmark" in en
        assert len(en) >= 50
        assert len(hi) >= 50

    def test_pricing_endpoint_estimate(self, client):
        """TC-PRICE-06: Verifies POST /api/v1/pricing/estimate endpoint."""
        res = client.post(
            "/api/v1/pricing/estimate",
            json={
                "craft_type": "Bastar Dhokra",
                "materials_cost": 400.0,
                "labor_hours": 8.0,
                "cluster_id": "cluster-bastar-dhokra-01"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["pricing_tiers"]["floor_price"] == 1400.0
        assert data["pricing_tiers"]["floor_price"] < data["pricing_tiers"]["wholesale_b2b"] < data["pricing_tiers"]["recommended_retail_d2c"]
        assert data["cost_breakdown"]["hourly_wage_applied"] == 120.0
        assert data["market_benchmark"] is not None

    def test_pricing_endpoint_flat_contract_fields(self, client):
        """TC-PRICE-07: Verifies top-level flat fields for PROJECT.md specification contract."""
        res = client.post(
            "/api/v1/pricing/estimate",
            json={
                "craft_type": "Varanasi Silk",
                "raw_material_cost": 3000.0,
                "labor_hours": 112.0
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert "floor_price" in data
        assert "recommended_retail_price" in data
        assert "wholesale_b2b_price" in data
        assert "rationale" in data
        assert "en" in data["rationale"] and "hi" in data["rationale"]

    def test_multimodal_four_signals_valuation(self, client):
        """TC-PRICE-08: Verifies 4 SIH signals (materials, image, description NLP, market trends)."""
        res = client.post(
            "/api/v1/pricing/estimate",
            json={
                "craft_type": "Varanasi Silk",
                "materials_cost": 2500.0,
                "labor_hours": 32.0,
                "product_description": "Pure katan silk saree handwoven with authentic kadwa booti and gold zari on traditional pit loom.",
                "artisan_stated_price": 9500.0
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        
        # Verify dynamic valuation factors are returned
        factors = data.get("dynamic_factors")
        assert factors is not None
        assert factors["statutory_cost_floor"] > 0
        assert factors["heritage_technique_score"] > 0.0
        assert factors["heritage_narrative_premium"] > 0.0
        assert factors["market_demand_index"] >= 1.0
        assert "kadwa" in str(factors["factors_applied"]).lower() or "booti" in str(factors["factors_applied"]).lower() or "zari" in str(factors["factors_applied"]).lower() or "silk" in str(factors["factors_applied"]).lower() or "gi" in str(factors["factors_applied"]).lower() or "heritage" in str(factors["factors_applied"]).lower()
        
        # Strict inequality
        assert data["pricing_tiers"]["floor_price"] < data["pricing_tiers"]["wholesale_b2b"] < data["pricing_tiers"]["recommended_retail_d2c"]

    def test_market_trends_endpoints(self, client):
        """TC-PRICE-09: Verifies GET /pricing/market-trends and /pricing/market-trends/{craft_type}."""
        # Test all trends
        res = client.get("/api/v1/pricing/market-trends")
        assert res.status_code == 200
        trends = res.json()
        assert isinstance(trends, list)
        assert len(trends) >= 5
        craft_names = [t["craft_type"].lower() for t in trends]
        assert any("varanasi" in c for c in craft_names)
        assert any("bastar" in c for c in craft_names)

        # Test single craft trend
        res_single = client.get("/api/v1/pricing/market-trends/Varanasi Silk")
        assert res_single.status_code == 200
        trend_single = res_single.json()
        assert trend_single["craft_type"] == "Varanasi Silk"
        assert trend_single["demand_index"] >= 1.30
        assert "ONDC" in str(trend_single["data_sources"])

    def test_pricing_with_base64_image(self, client):
        """TC-PRICE-10: Verifies visual feature extraction from base64 uploaded image."""
        import io
        import base64
        from PIL import Image

        # Create a small test image with colors
        img = Image.new("RGB", (64, 64), color=(180, 100, 50))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        b64_str = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

        res = client.post(
            "/api/v1/pricing/estimate",
            json={
                "craft_type": "Bastar Dhokra",
                "materials_cost": 500.0,
                "labor_hours": 16.0,
                "product_image_base64": b64_str,
                "product_description": "Handcrafted tribal bell metal bell using ancient cire perdue lost wax technique."
            }
        )
        assert res.status_code == 200
        data = res.json()
        factors = data["dynamic_factors"]
        assert factors["craftsmanship_quality_score"] >= 0.65
        assert data["pricing_tiers"]["floor_price"] < data["pricing_tiers"]["wholesale_b2b"] < data["pricing_tiers"]["recommended_retail_d2c"]

    def test_statutory_cost_floor_safety_invariant(self):
        """TC-PRICE-11: Floor is strictly unbreakable lower bound even under lowest market inputs."""
        # Extreme low-ball benchmark
        tiers = pricing_service.calculate_tiers(floor_price=2000.0, benchmark_median=500.0, market_multiplier=0.90)
        assert tiers["floor_price"] == 2000.0
        assert tiers["wholesale_price"] > tiers["floor_price"]
        assert tiers["retail_price"] > tiers["wholesale_price"]



