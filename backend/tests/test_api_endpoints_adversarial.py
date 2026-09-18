"""
Adversarial Stress Test Suite for API Endpoints (M1 Scope).
Smart India Hackathon 2026 (SIH26090 - MoSJE)

Stress-tests:
1. Unknown / non-existent cluster IDs (404)
2. SQL injection payloads in URL path parameters (safe 404, no 500 error)
3. Extremely long URL parameters (safe 404, no buffer overflow)
4. Malformed wage queries (404)
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import init_db


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


@pytest.fixture
def client():
    return TestClient(app)


class TestAPIEndpointsAdversarial:
    def test_non_existent_cluster_returns_404(self, client):
        r = client.get("/api/v1/clusters/non-existent-cluster-999")
        assert r.status_code == 404
        assert "not found" in r.json()["detail"].lower()

    @pytest.mark.parametrize("sqli_payload", [
        "' OR '1'='1",
        "cluster-bastar-dhokra' OR 1=1 --",
        "cluster-varanasi-silk; DROP TABLE craft_clusters; --",
        "../../etc/passwd",
        "<script>alert(1)</script>",
    ])
    def test_sqli_payload_in_cluster_path_handled_safely(self, client, sqli_payload):
        r = client.get(f"/api/v1/clusters/{sqli_payload}")
        assert r.status_code == 404

    def test_extremely_long_cluster_id_handled_safely(self, client):
        long_id = "cluster-" + ("A" * 500)
        r = client.get(f"/api/v1/clusters/{long_id}")
        assert r.status_code == 404

    def test_non_existent_cluster_wage_returns_404(self, client):
        r = client.get("/api/v1/clusters/non-existent-cluster-999/wage")
        assert r.status_code == 404
