"""
Pytest Test Harness & Reusable Fixtures for SIH26090 (MoSJE).
Provides test client, fixture loaders, mock configurations, and algorithmic references.
"""

import os
import sys
import json
import pytest
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
if str(TESTS_DIR.parent) not in sys.path:
    sys.path.insert(0, str(TESTS_DIR.parent))

# Ensure offline-first mock mode by default
os.environ.setdefault("BHASHINI_API_KEY", "")
os.environ.setdefault("OPENAI_API_KEY", "")
os.environ.setdefault("INTEGRITY_MODE", "demo")
os.environ.setdefault("OFFLINE_MODE", "true")
os.environ.setdefault("MOCK_AI_SERVICES", "true")
os.environ.setdefault("AADHAAR_PEPPER_KEY", "mosje_sovereign_aadhaar_pepper_secret_2026")

TESTS_DIR = Path(__file__).resolve().parent
FIXTURES_DIR = TESTS_DIR / "fixtures"
IMAGES_DIR = FIXTURES_DIR / "images"
AUDIO_DIR = FIXTURES_DIR / "audio"
SEEDS_DIR = FIXTURES_DIR / "seed_data"


@pytest.fixture(scope="session")
def fixture_paths():
    """Provides dictionary of absolute paths to all fixture folders."""
    return {
        "root": str(FIXTURES_DIR),
        "images": str(IMAGES_DIR),
        "audio": str(AUDIO_DIR),
        "seeds": str(SEEDS_DIR),
    }


@pytest.fixture(scope="session")
def craft_clusters():
    """Load canonical 5 Indian craft clusters seed data."""
    clusters_file = SEEDS_DIR / "craft_clusters.json"
    if not clusters_file.exists():
        clusters_file = FIXTURES_DIR / "seeds" / "craft_clusters.json"
    with open(clusters_file, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def benchmark_products():
    """Load 50 benchmark products with 768-d SigLIP vectors."""
    bench_file = SEEDS_DIR / "benchmark_products.json"
    if not bench_file.exists():
        bench_file = FIXTURES_DIR / "seeds" / "benchmark_products.json"
    with open(bench_file, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def artisan_profiles():
    """Load artisan profiles seed data."""
    artisan_file = SEEDS_DIR / "artisan_profiles.json"
    if not artisan_file.exists():
        artisan_file = FIXTURES_DIR / "seeds" / "artisan_profiles.json"
    with open(artisan_file, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def mock_rfqs():
    """Load canonical B2B RFQs seed data."""
    rfq_file = SEEDS_DIR / "mock_rfq_orders.json"
    if not rfq_file.exists():
        rfq_file = FIXTURES_DIR / "seeds" / "mock_rfq_orders.json"
    with open(rfq_file, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def sample_varanasi_image_path():
    return str(IMAGES_DIR / "cluttered_varanasi_silk.jpg")


@pytest.fixture
def sample_dhokra_image_path():
    return str(IMAGES_DIR / "cluttered_bastar_dhokra.jpg")


@pytest.fixture
def sample_khurja_image_path():
    return str(IMAGES_DIR / "cluttered_khurja_pottery.jpg")


@pytest.fixture
def sample_madhubani_image_path():
    return str(IMAGES_DIR / "cluttered_madhubani_art.jpg")


@pytest.fixture
def sample_channapatna_image_path():
    return str(IMAGES_DIR / "cluttered_channapatna_toy.jpg")


@pytest.fixture
def sample_gps_exif_image_path():
    return str(IMAGES_DIR / "edge_with_gps_exif.jpg")


@pytest.fixture
def sample_dhokra_audio_path():
    return str(AUDIO_DIR / "hindi_dhokra_horse.wav")


@pytest.fixture
def sample_khurja_opus_path():
    return str(AUDIO_DIR / "hindi_khurja_pottery.opus")


@pytest.fixture
def sample_silence_audio_path():
    return str(AUDIO_DIR / "edge_pure_silence_5s.wav")


@pytest.fixture
def sample_noisy_audio_path():
    return str(AUDIO_DIR / "edge_noisy_market_snr3db.wav")


@pytest.fixture
def sample_corrupt_opus_path():
    return str(AUDIO_DIR / "edge_corrupt_header.opus")


# Reference Algorithm Helpers for Direct Deterministic Assertions
class SovereignPricingModel:
    """Authoritative algorithmic reference for anti-exploitation floor valuation."""
    @staticmethod
    def calculate_floor(raw_material_cost: float, labor_hours: float, wage_rate: float, consumables_rate: float = 0.10) -> float:
        consumables = raw_material_cost * consumables_rate
        return round(raw_material_cost + (labor_hours * wage_rate) + consumables, 2)

    @staticmethod
    def calculate_tiers(floor_price: float, benchmark_median: float = None):
        if benchmark_median and benchmark_median > floor_price:
            wholesale = round(max(floor_price * 1.20, benchmark_median * 0.85), 2)
            retail = round(max(floor_price * 1.55, benchmark_median * 1.15), 2)
        else:
            wholesale = round(floor_price * 1.25, 2)
            retail = round(floor_price * 1.60, 2)
        return {
            "floor_price": floor_price,
            "wholesale_price": wholesale,
            "retail_price": retail
        }


class B2BMatchingAlgorithm:
    """Authoritative reference for multi-factor B2B matchmaker scoring (35/30/25/10)."""
    @staticmethod
    def score_craft(artisan_craft: str, requested_craft: str) -> float:
        return 1.0 if artisan_craft.strip().lower() == requested_craft.strip().lower() else 0.0

    @staticmethod
    def score_price(artisan_wholesale: float, buyer_unit_budget: float) -> float:
        if buyer_unit_budget <= 0:
            return 0.0
        if artisan_wholesale <= buyer_unit_budget:
            # Full score if artisan price is within or equal to budget
            return 1.0
        # Linear degradation up to 30% over budget
        overage = (artisan_wholesale - buyer_unit_budget) / buyer_unit_budget
        return max(0.0, 1.0 - (overage / 0.30))

    @staticmethod
    def score_capacity(monthly_capacity: int, quantity: int, deadline_days: int) -> tuple[float, bool]:
        max_deliverable = monthly_capacity * (deadline_days / 30.0)
        feasible = max_deliverable >= quantity
        if feasible:
            score = 1.0
        else:
            score = min(0.95, max_deliverable / quantity)
        return round(score, 3), feasible

    @staticmethod
    def calculate_composite_score(craft_s: float, price_s: float, capacity_s: float, location_s: float) -> float:
        composite = (0.35 * craft_s) + (0.30 * price_s) + (0.25 * capacity_s) + (0.10 * location_s)
        return round(composite * 100.0, 2)


@pytest.fixture(scope="session")
def pricing_model():
    return SovereignPricingModel()


@pytest.fixture(scope="session")
def matching_engine():
    return B2BMatchingAlgorithm()
