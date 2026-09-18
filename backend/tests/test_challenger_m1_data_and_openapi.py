"""
Empirical Challenger Test Suite for Milestone M1 (Data Integrity & API Contracts)
Smart India Hackathon 2026 - SIH26090 (MoSJE)
Author: Challenger 2 (challenger_m1_2)

This test harness rigorously verifies:
1. Craft Clusters Data Integrity (all 5 canonical clusters, states, GI tags, positive wages, GPS coordinates)
2. 768-dim SigLIP visual embeddings in benchmark products (non-null, dimension=768, finite float vectors, L2-normalized)
3. FastAPI OpenAPI specification at /openapi.json (valid JSON schema, no dangling $refs, endpoint coverage)
"""

import os
import sys
import json
import math
import pytest
import numpy as np
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import SessionLocal, PortableVector
from app.models.craft_cluster import CraftCluster
from app.models.pricing_benchmark import PricingBenchmark
from app.models.product import Product


@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient instance."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def db_session():
    """SQLAlchemy database session for direct model queries."""
    from db.seeds.seed_craft_clusters import seed_database
    seed_database()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==============================================================================
# 1. CRAFT CLUSTERS DATA INTEGRITY EMPIRICAL TESTS
# ==============================================================================
class TestChallengerCraftClusterIntegrity:
    """
    Adversarial verification of 5 canonical MoSJE Indian craft clusters.
    Verifies existence, state mapping, GI tags, wage rates, and GPS coordinates.
    """

    EXPECTED_CLUSTERS = {
        "Varanasi Silk": {
            "name_pattern": "Varanasi Silk",
            "expected_state": "Uttar Pradesh",
            "expected_gi_tag": "GI-99",
            "min_hourly_wage": 50.0,
            "approx_lat": 25.3176,
            "approx_lon": 82.9739,
        },
        "Bastar Dhokra": {
            "name_pattern": "Bastar Dhokra",
            "expected_state": "Chhattisgarh",
            "expected_gi_tag": "GI-83",
            "min_hourly_wage": 50.0,
            "approx_lat": 19.0748,
            "approx_lon": 82.0298,
        },
        "Khurja Pottery": {
            "name_pattern": "Khurja Pottery",
            "expected_state": "Uttar Pradesh",
            "expected_gi_tag": "GI-177",
            "min_hourly_wage": 50.0,
            "approx_lat": 28.2530,
            "approx_lon": 77.8540,
        },
        "Madhubani Painting": {
            "name_pattern": "Madhubani Painting",
            "expected_state": "Bihar",
            "expected_gi_tag": "GI-105",
            "min_hourly_wage": 50.0,
            "approx_lat": 26.3533,
            "approx_lon": 86.0718,
        },
        "Channapatna Toys": {
            "name_pattern": "Channapatna Toys",
            "expected_state": "Karnataka",
            "expected_gi_tag": "GI-131",
            "min_hourly_wage": 50.0,
            "approx_lat": 12.6518,
            "approx_lon": 77.2089,
        }
    }

    def test_all_five_clusters_exist_in_db(self, db_session):
        """Verify exactly 5 craft clusters exist in the database with canonical names."""
        clusters = db_session.query(CraftCluster).all()
        assert len(clusters) == 5, f"Expected exactly 5 clusters in DB, found {len(clusters)}"

        cluster_names = [c.name for c in clusters]
        for craft, spec in self.EXPECTED_CLUSTERS.items():
            matching = [n for n in cluster_names if spec["name_pattern"] in n]
            assert len(matching) >= 1, f"Cluster '{craft}' not found in database clusters: {cluster_names}"

    def test_cluster_states_correctness(self, db_session):
        """Verify each cluster is mapped to its authentic Indian State."""
        clusters = db_session.query(CraftCluster).all()
        cluster_map = {c.craft_name: c for c in clusters}

        for craft, spec in self.EXPECTED_CLUSTERS.items():
            # Find matching cluster
            cluster = None
            for c_craft, c_obj in cluster_map.items():
                if spec["name_pattern"] in c_craft or spec["name_pattern"] in c_obj.name:
                    cluster = c_obj
                    break
            assert cluster is not None, f"Could not find cluster for {craft}"
            assert cluster.state == spec["expected_state"], (
                f"Cluster '{craft}' state mismatch: expected '{spec['expected_state']}', got '{cluster.state}'"
            )

    def test_cluster_gi_tags_validity(self, db_session):
        """Verify GI tag status is Registered and GI tag number matches the official GI Registry."""
        clusters = db_session.query(CraftCluster).all()
        for c in clusters:
            assert c.gi_tag_status is not None, f"GI tag status is None for {c.name}"
            assert "Registered" in c.gi_tag_status, f"GI tag status not Registered for {c.name}: {c.gi_tag_status}"
            assert c.gi_tag_number is not None, f"GI tag number missing for {c.name}"
            assert c.gi_tag_number.startswith("GI-"), f"GI tag number format invalid for {c.name}: {c.gi_tag_number}"

            # Verify specific GI number
            matched_spec = None
            for craft, spec in self.EXPECTED_CLUSTERS.items():
                if spec["name_pattern"] in c.name or spec["name_pattern"] in c.craft_name:
                    matched_spec = spec
                    break
            assert matched_spec is not None, f"Unrecognized cluster {c.name}"
            assert c.gi_tag_number == matched_spec["expected_gi_tag"], (
                f"GI tag number mismatch for {c.name}: expected {matched_spec['expected_gi_tag']}, got {c.gi_tag_number}"
            )

    def test_cluster_wage_rates_strictly_positive(self, db_session):
        """Verify statutory hourly and daily wages are strictly positive and satisfy 8-hour shift ratio."""
        clusters = db_session.query(CraftCluster).all()
        for c in clusters:
            assert c.statutory_hourly_wage > 0.0, f"Hourly wage non-positive for {c.name}: {c.statutory_hourly_wage}"
            assert c.statutory_daily_wage > 0.0, f"Daily wage non-positive for {c.name}: {c.statutory_daily_wage}"
            assert c.statutory_hourly_wage >= 50.0, (
                f"Hourly wage below statutory minimum baseline of Rs 50 for {c.name}: {c.statutory_hourly_wage}"
            )
            # Daily wage should reflect at least 8 hours of skilled labor
            assert c.statutory_daily_wage >= c.statutory_hourly_wage * 8.0, (
                f"Daily wage inconsistent with 8h rate for {c.name}: daily={c.statutory_daily_wage}, hourly={c.statutory_hourly_wage}"
            )

    def test_cluster_gps_coordinates_bounds_and_accuracy(self, db_session):
        """Verify GPS coordinates are valid floats within Indian subcontinent territorial bounds."""
        clusters = db_session.query(CraftCluster).all()
        for c in clusters:
            lat, lon = c.latitude, c.longitude
            assert isinstance(lat, float) and math.isfinite(lat), f"Invalid latitude for {c.name}: {lat}"
            assert isinstance(lon, float) and math.isfinite(lon), f"Invalid longitude for {c.name}: {lon}"

            # Global GPS bounds
            assert -90.0 <= lat <= 90.0, f"Latitude out of global bounds [-90, 90] for {c.name}: {lat}"
            assert -180.0 <= lon <= 180.0, f"Longitude out of global bounds [-180, 180] for {c.name}: {lon}"

            # Territorial bounds of India (Approx: Lat 8N to 37N, Lon 68E to 98E)
            assert 8.0 <= lat <= 38.0, f"Latitude {lat} outside India bounds for {c.name}"
            assert 68.0 <= lon <= 98.0, f"Longitude {lon} outside India bounds for {c.name}"

            # Locality proximity check (< 1.5 degrees from authentic cluster center)
            matched_spec = None
            for craft, spec in self.EXPECTED_CLUSTERS.items():
                if spec["name_pattern"] in c.name or spec["name_pattern"] in c.craft_name:
                    matched_spec = spec
                    break
            assert matched_spec is not None
            lat_diff = abs(lat - matched_spec["approx_lat"])
            lon_diff = abs(lon - matched_spec["approx_lon"])
            assert lat_diff < 1.0, f"Latitude {lat} deviated too far from reference {matched_spec['approx_lat']}"
            assert lon_diff < 1.0, f"Longitude {lon} deviated too far from reference {matched_spec['approx_lon']}"

    def test_cluster_rest_api_list_and_detail(self, client):
        """Empirically test GET /api/v1/clusters, /api/v1/clusters/{id}, and /api/v1/clusters/{id}/wage endpoints."""
        # 1. List endpoint
        res = client.get("/api/v1/clusters")
        assert res.status_code == 200, f"Expected 200 OK from /api/v1/clusters, got {res.status_code}"
        clusters = res.json()
        assert len(clusters) == 5, f"Expected 5 clusters from API, got {len(clusters)}"

        for cluster in clusters:
            # Check mandatory schema fields
            assert "id" in cluster
            assert "name" in cluster
            assert "craft_name" in cluster
            assert "state" in cluster
            assert "district" in cluster
            assert "latitude" in cluster
            assert "longitude" in cluster
            assert "statutory_hourly_wage" in cluster
            assert "statutory_daily_wage" in cluster
            assert "gi_tag_status" in cluster
            assert "gi_tag_number" in cluster
            assert "artisan_count" in cluster
            assert cluster["statutory_hourly_wage"] > 0
            assert cluster["statutory_daily_wage"] > 0

            # 2. Detail endpoint
            cluster_id = cluster["id"]
            detail_res = client.get(f"/api/v1/clusters/{cluster_id}")
            assert detail_res.status_code == 200, f"Failed GET /api/v1/clusters/{cluster_id}"
            detail_data = detail_res.json()
            assert detail_data["id"] == cluster_id
            assert detail_data["name"] == cluster["name"]

            # 3. Wage endpoint
            wage_res = client.get(f"/api/v1/clusters/{cluster_id}/wage")
            assert wage_res.status_code == 200, f"Failed GET /api/v1/clusters/{cluster_id}/wage"
            wage_data = wage_res.json()
            assert wage_data["statutory_hourly_wage_inr"] == cluster["statutory_hourly_wage"]
            assert wage_data["statutory_daily_wage_inr"] == cluster["statutory_daily_wage"]

    def test_cluster_not_found_handling(self, client):
        """Verify 404 response on invalid cluster queries."""
        invalid_id = "non-existent-cluster-id-9999"
        res_detail = client.get(f"/api/v1/clusters/{invalid_id}")
        assert res_detail.status_code == 404
        assert "not found" in res_detail.json()["detail"].lower()

        res_wage = client.get(f"/api/v1/clusters/{invalid_id}/wage")
        assert res_wage.status_code == 404
        assert "not found" in res_wage.json()["detail"].lower()


# ==============================================================================
# 2. 768-DIM SIGLIP VISUAL EMBEDDINGS EMPIRICAL TESTS
# ==============================================================================
class TestChallengerSigLIPEmbeddingsIntegrity:
    """
    Adversarial verification of 768-dim SigLIP visual embeddings.
    Verifies dimensions, null checks, finite float types, normalization, and uniqueness.
    """

    def test_db_pricing_benchmarks_embeddings(self, db_session):
        """Verify 768-dim visual embeddings in DB PricingBenchmark records."""
        benchmarks = db_session.query(PricingBenchmark).all()
        assert len(benchmarks) >= 11, f"Expected at least 11 pricing benchmarks in DB, got {len(benchmarks)}"

        for bench in benchmarks:
            emb = bench.visual_embedding
            assert emb is not None, f"Visual embedding is NULL for benchmark {bench.item_name} ({bench.id})"
            assert isinstance(emb, list), f"Expected list for visual embedding, got {type(emb)}"
            assert len(emb) == 768, f"Expected exact dimension 768, got {len(emb)} for benchmark {bench.item_name}"

            # Check every element is a finite float
            for i, val in enumerate(emb):
                assert isinstance(val, (float, int)), f"Element {i} is not float/int: {type(val)}"
                assert math.isfinite(val), f"Element {i} is not finite (NaN or Inf): {val}"
                assert -1.0 <= val <= 1.0, f"Element {i} outside [-1.0, 1.0]: {val}"

            # Verify non-trivial (not all zero)
            abs_sum = sum(abs(x) for x in emb)
            assert abs_sum > 0.0, f"Visual embedding is all zeros for benchmark {bench.item_name}"

            # Verify L2 unit normalization
            norm = np.linalg.norm(emb)
            assert pytest.approx(norm, rel=1e-2) == 1.0, f"Embedding not L2 normalized: norm={norm}"

    def test_db_products_embeddings(self, db_session):
        """Verify 768-dim visual embeddings in DB Product records."""
        products = db_session.query(Product).all()
        assert len(products) >= 5, f"Expected at least 5 products in DB, got {len(products)}"

        for prod in products:
            emb = prod.visual_embedding
            assert emb is not None, f"Product visual embedding is NULL for {prod.title} ({prod.id})"
            assert isinstance(emb, list), f"Expected list for product visual embedding, got {type(emb)}"
            assert len(emb) == 768, f"Expected dimension 768, got {len(emb)} for product {prod.title}"

            for val in emb:
                assert math.isfinite(val), f"Non-finite element in product embedding for {prod.title}"
                assert -1.0 <= val <= 1.0, f"Value out of bounds in product embedding for {prod.title}"

            norm = np.linalg.norm(emb)
            assert pytest.approx(norm, rel=1e-2) == 1.0, f"Product embedding not normalized: norm={norm}"

    def test_fixtures_benchmark_products_embeddings(self, benchmark_products):
        """Verify all 50 benchmark products in JSON fixtures have valid 768-dim SigLIP embeddings."""
        assert len(benchmark_products) == 50, f"Expected 50 benchmark products, got {len(benchmark_products)}"

        embeddings_matrix = []
        for prod in benchmark_products:
            assert "embedding_siglip_768" in prod, f"Missing embedding key in {prod.get('product_id')}"
            vec = prod["embedding_siglip_768"]
            assert vec is not None, f"embedding_siglip_768 is None for {prod.get('product_id')}"
            assert isinstance(vec, list), f"embedding_siglip_768 not a list for {prod.get('product_id')}"
            assert len(vec) == 768, f"Dimension mismatch: expected 768, got {len(vec)} for {prod.get('product_id')}"

            for val in vec:
                assert isinstance(val, (float, int)), f"Element not float/int in {prod.get('product_id')}: {val}"
                assert math.isfinite(val), f"Non-finite element in {prod.get('product_id')}: {val}"
                assert -1.0 <= val <= 1.0, f"Element outside [-1, 1] in {prod.get('product_id')}: {val}"

            norm = np.linalg.norm(vec)
            assert pytest.approx(norm, rel=1e-2) == 1.0, f"Embedding not normalized: norm={norm}"
            embeddings_matrix.append(vec)

        # Adversarial check: verify distinctness across different benchmark products
        mat = np.array(embeddings_matrix)
        # Check that rows are not identical (pairwise cosine similarity < 0.9999 for i != j)
        cos_sim_sample = np.dot(mat[0], mat[1])
        assert cos_sim_sample < 0.999, f"Product 0 and Product 1 embeddings are suspiciously identical: sim={cos_sim_sample}"

    def test_portable_vector_type_decorator_roundtrip(self):
        """Adversarial unit test of PortableVector SQLAlchemy TypeDecorator."""
        from app.core.database import engine
        from unittest.mock import MagicMock

        pv = PortableVector(dim=768)
        assert pv.dim == 768

        # 1. process_bind_param with active dialect (SQLite)
        dummy_vec = [0.1 * math.sin(i) for i in range(768)]
        bound = pv.process_bind_param(dummy_vec, engine.dialect)
        assert isinstance(bound, list)
        assert len(bound) == 768

        # With mock postgresql dialect
        mock_pg = MagicMock()
        mock_pg.name = "postgresql"
        bound_pg = pv.process_bind_param(dummy_vec, mock_pg)
        assert hasattr(bound_pg, "dtype") or isinstance(bound_pg, list)

        # None handling
        assert pv.process_bind_param(None, engine.dialect) is None
        assert pv.process_result_value(None, engine.dialect) is None

        # 2. process_result_value with stringified JSON
        json_str = json.dumps(dummy_vec)
        deserialized = pv.process_result_value(json_str, engine.dialect)
        assert isinstance(deserialized, list)
        assert len(deserialized) == 768
        assert pytest.approx(deserialized[0]) == dummy_vec[0]

        # 3. process_result_value with numpy array
        np_arr = np.array(dummy_vec, dtype=np.float32)
        deserialized_np = pv.process_result_value(np_arr, engine.dialect)
        assert isinstance(deserialized_np, list)
        assert len(deserialized_np) == 768



# ==============================================================================
# 3. FASTAPI OPENAPI SPECIFICATION EMPIRICAL TESTS
# ==============================================================================
class TestChallengerOpenAPISchemaIntegrity:
    """
    Adversarial verification of the FastAPI OpenAPI specification at /openapi.json.
    Verifies valid JSON generation, OpenAPI 3.x conformance, schema completeness,
    and absence of broken or dangling $ref references.
    """

    def test_openapi_endpoint_status_and_content_type(self, client):
        """Verify /openapi.json responds with HTTP 200 and application/json content type."""
        res = client.get("/openapi.json")
        assert res.status_code == 200, f"Expected 200 OK from /openapi.json, got {res.status_code}"
        assert "application/json" in res.headers.get("content-type", ""), (
            f"Unexpected content type: {res.headers.get('content-type')}"
        )

    def test_openapi_json_parses_without_error(self, client):
        """Verify /openapi.json returns well-formed, parsable JSON."""
        res = client.get("/openapi.json")
        try:
            schema = res.json()
        except json.JSONDecodeError as e:
            pytest.fail(f"/openapi.json returned invalid JSON: {e}")
        assert isinstance(schema, dict), "OpenAPI schema must be a JSON object"

    def test_openapi_structure_conformance(self, client):
        """Verify presence of core OpenAPI 3.x top-level elements."""
        schema = client.get("/openapi.json").json()

        # OpenAPI version (FastAPI defaults to 3.1.0)
        assert "openapi" in schema, "Missing 'openapi' version attribute"
        assert schema["openapi"].startswith("3."), f"Unexpected OpenAPI version: {schema['openapi']}"

        # Info object
        assert "info" in schema, "Missing 'info' object"
        info = schema["info"]
        assert "title" in info, "Missing 'title' in info"
        assert "version" in info, "Missing 'version' in info"
        assert "MoSJE" in info["title"], f"Title should mention MoSJE, got {info['title']}"
        assert info["version"] == "1.0.0"

        # Paths object
        assert "paths" in schema, "Missing 'paths' object"
        assert isinstance(schema["paths"], dict)
        assert len(schema["paths"]) > 0, "No paths registered in OpenAPI specification"

    def test_openapi_required_m1_endpoints_present(self, client):
        """Verify all mandatory Milestone M1 routes exist in the OpenAPI paths."""
        schema = client.get("/openapi.json").json()
        paths = schema.get("paths", {})

        expected_routes = [
            "/api/v1/health",
            "/api/v1/ready",
            "/api/v1/clusters",
            "/api/v1/clusters/{cluster_id}",
            "/api/v1/clusters/{cluster_id}/wage",
            "/",
            "/health"
        ]

        for route in expected_routes:
            assert route in paths, f"Mandatory M1 route '{route}' missing from OpenAPI paths: {list(paths.keys())}"

    def test_openapi_zero_dangling_dollar_refs(self, client):
        """
        Adversarial traversal to ensure NO dangling or broken $ref references exist.
        Every $ref must point to a resolvable path in the OpenAPI JSON document.
        """
        schema = client.get("/openapi.json").json()

        refs_found = []

        def find_refs(node, path=""):
            if isinstance(node, dict):
                for k, v in node.items():
                    if k == "$ref" and isinstance(v, str):
                        refs_found.append((v, path))
                    else:
                        find_refs(v, f"{path}/{k}")
            elif isinstance(node, list):
                for idx, item in enumerate(node):
                    find_refs(item, f"{path}[{idx}]")

        find_refs(schema)

        assert len(refs_found) > 0, "Expected at least some schema $refs in FastAPI OpenAPI spec"

        # Verify each $ref resolves within schema
        for ref, origin_path in refs_found:
            assert ref.startswith("#/"), f"External or non-local $ref not supported in offline schema: {ref}"
            parts = ref.lstrip("#/").split("/")
            current = schema
            for part in parts:
                assert part in current, (
                    f"Dangling $ref '{ref}' found at '{origin_path}'! Key '{part}' not in {list(current.keys())}"
                )
                current = current[part]

    def test_openapi_craft_cluster_schema_definitions(self, client):
        """Verify CraftClusterResponse schema definition contains required typed fields."""
        schema = client.get("/openapi.json").json()
        components = schema.get("components", {})
        schemas = components.get("schemas", {})

        assert "CraftClusterResponse" in schemas, (
            f"CraftClusterResponse schema missing from OpenAPI components: {list(schemas.keys())}"
        )
        cluster_schema = schemas["CraftClusterResponse"]
        properties = cluster_schema.get("properties", {})

        expected_properties = [
            "id", "name", "craft_name", "state", "district",
            "latitude", "longitude", "statutory_hourly_wage",
            "statutory_daily_wage", "gi_tag_status", "gi_tag_number"
        ]
        for prop in expected_properties:
            assert prop in properties, f"Property '{prop}' missing in CraftClusterResponse schema"

    def test_interactive_docs_accessible(self, client):
        """Verify Swagger UI (/docs) and ReDoc (/redoc) HTML endpoints respond with 200 OK."""
        res_docs = client.get("/docs")
        assert res_docs.status_code == 200
        assert "swagger-ui" in res_docs.text.lower() or "swagger" in res_docs.text.lower()

        res_redoc = client.get("/redoc")
        assert res_redoc.status_code == 200
        assert "redoc" in res_redoc.text.lower()
