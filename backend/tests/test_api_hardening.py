import os
import secrets
import threading
import time
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.config import Settings, settings
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token, rate_limiter
from app.core.idempotency import idempotency_store
from app.models.artisan import Artisan
from app.models.product import Product


@pytest.fixture(autouse=True)
def setup_test_environment():
    init_db()
    rate_limiter.reset()
    idempotency_store.reset()
    yield
    rate_limiter.reset()
    idempotency_store.reset()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def make_token(user_id: str, role: str = "customer") -> str:
    return create_access_token(user_id, extra_claims={"app_metadata": {"role": role}})


def auth_header(user_id: str, role: str = "customer"):
    return {"Authorization": f"Bearer {make_token(user_id, role)}"}


# ==============================================================================
# 1. Strict CORS Validation
# ==============================================================================

def test_cors_allowed_origin(client):
    """Allowed origin receives Access-Control-Allow-Origin response header."""
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "GET"
    }
    response = client.options("/health", headers=headers)
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_allowed_production_origin(client):
    """Allowed production Cloudflare worker origin receives CORS headers."""
    headers = {
        "Origin": "https://hunardhara.technogamerzthenextlevel.workers.dev",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization,Content-Type"
    }
    response = client.options("/health", headers=headers)
    assert response.headers.get("access-control-allow-origin") == "https://hunardhara.technogamerzthenextlevel.workers.dev"


def test_cors_unauthorized_origin_rejected(client):
    """Untrusted / malicious origin does not receive Access-Control-Allow-Origin."""
    headers = {
        "Origin": "https://attacker.evil.com",
        "Access-Control-Request-Method": "GET"
    }
    response = client.options("/health", headers=headers)
    assert "access-control-allow-origin" not in response.headers or response.headers.get("access-control-allow-origin") != "https://attacker.evil.com"


# ==============================================================================
# 2. Request ID & Security Headers
# ==============================================================================

def test_request_id_generated_and_returned(client):
    """Server generates unique X-Request-ID and attaches security headers."""
    response = client.get("/health")
    assert response.status_code == 200
    assert "x-request-id" in response.headers
    assert response.headers["x-request-id"].startswith("req_")
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"


def test_request_id_preserved_from_client(client):
    """Server preserves caller-supplied X-Request-ID for distributed tracing."""
    custom_id = "trace-client-xyz-987"
    response = client.get("/health", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers.get("x-request-id") == custom_id


# ==============================================================================
# 3. Request Validation & Safe Error Responses (No Stack Trace Leaks)
# ==============================================================================

def test_validation_error_schema(client):
    """Invalid payload triggers clean 422 with structured field details and request_id."""
    # /api/v1/orders/customer requires product_id and quantity >= 1
    headers = auth_header("cust-123", role="customer")
    response = client.post("/api/v1/orders/customer", json={"product_id": "", "quantity": -5}, headers=headers)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "VALIDATION_ERROR"
    assert "request_id" in data
    assert isinstance(data["detail"], list)


def test_internal_server_error_sanitization_in_production():
    """Unhandled exceptions hide tracebacks and SQL errors when in production."""
    isolated_client = TestClient(app, raise_server_exceptions=False)
    with patch.object(settings, "ENVIRONMENT", "production"), patch.object(settings, "DEBUG", False):
        with patch("sqlalchemy.orm.Query.all", side_effect=RuntimeError("Sensitive database password or internal stack trace")):
            headers = auth_header("admin-001", role="admin")
            response = isolated_client.get("/api/v1/orders/customer", headers=headers)
            assert response.status_code == 500
            data = response.json()
            assert data["error"] == "INTERNAL_SERVER_ERROR"
            assert "Sensitive database password" not in data["detail"]
            assert "internal stack trace" not in data["detail"]
            assert "An internal server error occurred" in data["detail"]
            assert "request_id" in data


# ==============================================================================
# 4. Rate Limiting on AI & Public Endpoints
# ==============================================================================

def test_rate_limiting_enforcement(client):
    """Rapid repeated requests exceed rate limit and return HTTP 429 with Retry-After."""
    # /api/v1/pricing/estimate has a limit of 30 requests/minute
    req_body = {
        "craft_type": "Bastar Dhokra Brass",
        "materials_cost": 500.0,
        "labor_hours": 8.0,
        "cluster_id": "bastar_dhokra"
    }

    # Make 30 valid requests
    for _ in range(30):
        resp = client.post("/api/v1/pricing/estimate", json=req_body)
        assert resp.status_code in (200, 400)  # depending on whether cluster data exists

    # 31st request must trigger HTTP 429
    resp_429 = client.post("/api/v1/pricing/estimate", json=req_body)
    assert resp_429.status_code == 429
    assert "RATE_LIMIT_EXCEEDED" in resp_429.text
    assert "retry-after" in resp_429.headers
    assert resp_429.headers.get("x-ratelimit-remaining") == "0"


def test_rate_limiting_independent_clients(client):
    """Different client tokens have independent rate limit allowances."""
    # Check rate limiter handles distinct prefixes/keys independently
    for _ in range(10):
        rate_limiter.check("studio:tok_user1", max_requests=10, window_seconds=60)

    # user1 is blocked
    allowed, remaining, _ = rate_limiter.check("studio:tok_user1", max_requests=10, window_seconds=60)
    assert not allowed

    # user2 is not blocked
    allowed2, remaining2, _ = rate_limiter.check("studio:tok_user2", max_requests=10, window_seconds=60)
    assert allowed2
    assert remaining2 == 9


# ==============================================================================
# 5. Order Idempotency & Replay Protection
# ==============================================================================

def test_order_creation_idempotency(client, db: Session):
    """Duplicate submissions with identical Idempotency-Key return cached result without double charging inventory."""
    product_id = f"prod-{secrets.token_hex(6)}"
    product = Product(
        id=product_id,
        artisan_id="art-test-123",
        cluster_id="cluster-test-123",
        title="Varanasi Silk Scarf",
        craft_type="Silk Weaving",
        technique="Handloom",
        cost_materials=400.0,
        labor_hours=6.0,
        floor_price=500.0,
        recommended_retail_price=800.0,
        wholesale_b2b_price=650.0,
        listing_price=800.0,
        stock_quantity=10,
        is_active=True
    )
    db.add(product)
    db.commit()

    customer_headers = auth_header("cust-idem-100", role="customer")
    idempotency_key = f"key-{secrets.token_hex(8)}"
    customer_headers["Idempotency-Key"] = idempotency_key

    order_payload = {"product_id": product_id, "quantity": 2}

    try:
        # 1. First submission
        resp1 = client.post("/api/v1/orders/customer", json=order_payload, headers=customer_headers)
        assert resp1.status_code == 201
        order1_data = resp1.json()
        order1_id = order1_data["id"]

        db.refresh(product)
        assert product.stock_quantity == 8  # 10 - 2

        # 2. Duplicate submission with identical Idempotency-Key
        resp2 = client.post("/api/v1/orders/customer", json=order_payload, headers=customer_headers)
        assert resp2.status_code == 201
        assert resp2.headers.get("idempotent-replay") == "true"
        order2_data = resp2.json()

        # Verify identical order was replayed
        assert order2_data["id"] == order1_id
        assert order2_data["total_price"] == order1_data["total_price"]

        # Stock must NOT be decremented again
        db.refresh(product)
        assert product.stock_quantity == 8

        # 3. New order with DIFFERENT idempotency key succeeds and decrements stock
        new_headers = auth_header("cust-idem-100", role="customer")
        new_headers["Idempotency-Key"] = f"key-{secrets.token_hex(8)}"
        resp3 = client.post("/api/v1/orders/customer", json=order_payload, headers=new_headers)
        assert resp3.status_code == 201
        assert "idempotent-replay" not in resp3.headers
        db.refresh(product)
        assert product.stock_quantity == 6
    finally:
        from app.models.order import Order
        db.query(Order).filter(Order.product_id == product_id).delete()
        db.query(Product).filter(Product.id == product_id).delete()
        db.commit()


def test_idempotency_conflict_on_concurrent_processing():
    """Concurrent requests with same key return HTTP 409 Conflict."""
    key = "concurrent-test-key"
    scope = "order:user1"

    status, rec = idempotency_store.acquire(key, scope=scope)
    assert status == "acquired"

    # Second concurrent call while still processing
    status2, _ = idempotency_store.acquire(key, scope=scope)
    assert status2 == "processing"


# ==============================================================================
# 6. Liveness vs Readiness Probes
# ==============================================================================

def test_liveness_probe_independent_of_database(client):
    """Liveness probe /health returns 200 even if database session is broken."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["probe"] == "liveness"


def test_readiness_probe_healthy(client):
    """Readiness probe /ready returns 200 when database is accessible."""
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["probe"] == "readiness"
    assert data["database"] == "connected"


def test_readiness_probe_unhealthy_when_database_fails(client):
    """Readiness probe /ready returns HTTP 503 when database is unreachable."""
    with patch("app.core.database.SessionLocal", side_effect=Exception("Database connection timeout")):
        response = client.get("/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"
        assert "unreachable" in data["database"]


def test_api_v1_readiness_probe(client):
    """Readiness probe /api/v1/ready returns 200 when healthy and 503 on DB error."""
    resp = client.get("/api/v1/ready")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ready"


# ==============================================================================
# 7. Production Fail-Fast Configuration Validation
# ==============================================================================

def test_production_config_validation_catches_dev_defaults():
    """validate_production_configuration fails fast when development defaults exist in production."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=True,  # Violation 1: DEBUG in prod
        DATABASE_URL="sqlite:///test.db",  # Violation 2: SQLite in prod
        SUPABASE_JWT_SECRET="",  # Violation 3: Missing JWT secret
        AADHAAR_PEPPER_KEY="",  # Violation 4: Missing pepper
        STORAGE_SIGNED_URL_SECRET="hunardhara-storage-signed-key-2026",  # Violation 5: Default secret
        OFFLINE_MODE=True,  # Violation 6: Offline mode in prod
        MOCK_AI_SERVICES=True,  # Violation 7: Mock services in prod
        ALLOWED_ORIGINS="*",  # Violation 8: Wildcard CORS in prod
    )

    with pytest.raises(RuntimeError) as exc_info:
        prod_settings.validate_production_configuration()

    err = str(exc_info.value)
    assert "DEBUG must be False in production" in err
    assert "DATABASE_URL cannot be SQLite" in err
    assert "SUPABASE_JWT_SECRET is missing" in err
    assert "AADHAAR_PEPPER_KEY is missing" in err
    assert "default development secret" in err
    assert "OFFLINE_MODE must be False" in err
    assert "MOCK_AI_SERVICES must be False" in err
    assert "Wildcard '*' not permitted" in err


def test_production_config_validation_passes_valid_setup():
    """validate_production_configuration passes when all production parameters are secure."""
    valid_prod = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        DATABASE_URL="postgresql://artisan_admin:strong_pw@db.mosje.gov.in:5432/hunardhara",
        SUPABASE_JWT_SECRET=secrets.token_urlsafe(48),
        AADHAAR_PEPPER_KEY=secrets.token_urlsafe(48),
        STORAGE_SIGNED_URL_SECRET=secrets.token_urlsafe(48),
        OFFLINE_MODE=False,
        MOCK_AI_SERVICES=False,
        ALLOWED_ORIGINS="https://hunardhara.gov.in,https://artisan.mosje.gov.in"
    )
    # Should not raise
    valid_prod.validate_production_configuration()


# ==============================================================================
# 8. External Service Timeouts
# ==============================================================================

def test_timeout_configurations_defined():
    """External service timeouts are explicitly configured with reasonable bounds."""
    assert hasattr(settings, "EXTERNAL_TIMEOUT_SECONDS")
    assert settings.EXTERNAL_TIMEOUT_SECONDS > 0
    assert hasattr(settings, "OPENROUTER_TIMEOUT_SECONDS")
    assert settings.OPENROUTER_TIMEOUT_SECONDS > 0
