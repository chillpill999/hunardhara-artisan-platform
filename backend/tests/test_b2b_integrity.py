import uuid
import secrets
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.core.config import settings
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.craft_cluster import CraftCluster
from app.models.b2b_rfq import B2BRFQ, B2BMatchRecord
from app.services.b2b_matching_service import B2BMatchingService


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


def make_token(user_id: str, role: str = "customer", email: str = "user@crafts.in"):
    return create_access_token(
        subject=user_id,
        extra_claims={
            "app_metadata": {"role": role},
            "email": email,
        },
    )


@pytest.fixture
def buyer_token():
    return make_token("buyer-uuid-101", "customer", "procurement@stateemporium.gov.in")


@pytest.fixture
def other_buyer_token():
    return make_token("buyer-uuid-202", "customer", "other@corp.com")


@pytest.fixture
def admin_token():
    # 'admin-001' is in settings.admin_user_ids
    return make_token("admin-001", "admin", "admin@hunardhara.gov.in")


@pytest.fixture
def sample_cluster_and_artisan(db):
    """Ensure at least one valid cluster and active artisan with active product exist in DB."""
    cluster_id = f"cl-b2b-{uuid.uuid4().hex[:6]}"
    cluster = CraftCluster(
        id=cluster_id,
        name=f"B2B Test Cluster Bastar {cluster_id}",
        craft_name="Bastar Dhokra",
        state="Chhattisgarh",
        district="Bastar",
        latitude=19.0748,
        longitude=82.0298,
        statutory_hourly_wage=50.0,
        statutory_daily_wage=400.0,
        gi_tag_status="Registered (GI-99)",
    )
    db.merge(cluster)

    artisan_id = f"art-b2b-{uuid.uuid4().hex[:6]}"
    artisan = Artisan(
        id=artisan_id,
        full_name="Bastar Master Artisan",
        phone_number=f"+91{secrets.token_hex(4)}99",
        masked_aadhaar="XXXXXXXX9999",
        aadhaar_hash=f"hash-{secrets.token_hex(8)}",
        social_category="ST",
        cluster_id=cluster_id,
        state="Chhattisgarh",
        district="Bastar",
        latitude=19.0748,
        longitude=82.0298,
        primary_craft="Bastar Dhokra",
        monthly_capacity_units=50,
        experience_years=15,
        is_active=True,
    )
    db.merge(artisan)

    prod_id = f"prod-b2b-{uuid.uuid4().hex[:6]}"
    product = Product(
        id=prod_id,
        title="Active Brass Horse",
        craft_type="Bastar Dhokra",
        artisan_id=artisan_id,
        cluster_id=cluster_id,
        technique="Lost Wax",
        floor_price=800.0,
        recommended_retail_price=1600.0,
        wholesale_b2b_price=1100.0,
        listing_price=1600.0,
        stock_quantity=20,
        is_active=True
    )
    db.merge(product)
    db.commit()

    return {"cluster": cluster, "artisan": artisan, "product": product}


class TestB2BMatchingAndRFQIntegrity:
    """Comprehensive test suite for B2B matching and RFQ authorization and data integrity."""

    def test_match_endpoint_requires_authentication(self, client):
        """Anonymous callers to POST /api/v1/b2b/match must receive 401 Unauthorized."""
        res = client.post(
            "/api/v1/b2b/match",
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 50,
                "unit_budget": 1500.0,
                "deadline_days": 30
            }
        )
        assert res.status_code == 401

    def test_rfq_creation_requires_authentication(self, client):
        """Anonymous callers to POST /api/v1/b2b/rfq must receive 401 Unauthorized."""
        res = client.post(
            "/api/v1/b2b/rfq",
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 50,
                "unit_budget": 1500.0,
                "deadline_days": 30,
                "buyer_email": "anon@test.com"
            }
        )
        assert res.status_code == 401

    def test_rfq_creation_locks_buyer_identity(self, client, buyer_token):
        """Buyer identity and email are strictly derived from authenticated token, preventing forgery."""
        res = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 40,
                "unit_budget": 1200.0,
                "deadline_days": 30,
                "buyer_name": "Forged Impersonator",
                "buyer_email": "hacked.ceo@tata.com",
            }
        )
        assert res.status_code == 201
        data = res.json()
        assert data["buyer_id"] == "buyer-uuid-101"
        assert data["buyer_email"] == "procurement@stateemporium.gov.in"
        assert data["total_budget"] == 48000.0

    def test_admin_can_specify_buyer_email_override(self, client, admin_token):
        """Administrators coordinating procurement can set a representative buyer_email."""
        res = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 20,
                "unit_budget": 1000.0,
                "deadline_days": 15,
                "buyer_email": "cooperative.leader@tribal.gov.in",
                "buyer_name": "Cooperative Leader"
            }
        )
        assert res.status_code == 201
        data = res.json()
        assert data["buyer_email"] == "cooperative.leader@tribal.gov.in"

    def test_rfq_server_side_validation_bounds(self, client, buyer_token):
        """Server rejects quantity < 1, unit_budget <= 0, deadline_days < 1, and empty craft_type."""
        # Zero quantity
        r1 = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={"craft_type": "Bastar Dhokra", "quantity": 0, "unit_budget": 1200.0, "deadline_days": 30}
        )
        assert r1.status_code in (400, 422)

        # Negative unit budget
        r2 = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={"craft_type": "Bastar Dhokra", "quantity": 10, "unit_budget": -100.0, "deadline_days": 30}
        )
        assert r2.status_code in (400, 422)

        # Zero deadline days
        r3 = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={"craft_type": "Bastar Dhokra", "quantity": 10, "unit_budget": 1200.0, "deadline_days": 0}
        )
        assert r3.status_code in (400, 422)

        # Empty craft type
        r4 = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={"craft_type": "   ", "quantity": 10, "unit_budget": 1200.0, "deadline_days": 30}
        )
        assert r4.status_code in (400, 422)

    def test_invalid_requested_artisan_returns_404_no_substitution(self, client, buyer_token):
        """If a buyer requests a non-existent or inactive artisan ID, return 404 instead of substituting."""
        fake_artisan_id = "nonexistent-artisan-9999"
        res = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 10,
                "unit_budget": 1500.0,
                "deadline_days": 30,
                "requested_artisan_id": fake_artisan_id
            }
        )
        assert res.status_code == 404
        assert "ARTISAN_NOT_FOUND" in res.json()["detail"]

        # Same for /match
        res_match = client.post(
            "/api/v1/b2b/match",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 10,
                "unit_budget": 1500.0,
                "deadline_days": 30,
                "requested_artisan_id": fake_artisan_id
            }
        )
        assert res_match.status_code == 404
        assert "ARTISAN_NOT_FOUND" in res_match.json()["detail"]

    def test_inactive_products_and_artisans_excluded_from_matching(self, db, sample_cluster_and_artisan, monkeypatch):
        """Artisans with only inactive products or inactive status are excluded from candidate matches."""
        monkeypatch.setattr(settings, "OFFLINE_MODE", False)

        cluster = sample_cluster_and_artisan["cluster"]

        # Create an inactive artisan
        inactive_artisan = Artisan(
            id="test-inactive-artisan-01",
            full_name="Inactive Artisan",
            phone_number="+919000000001",
            masked_aadhaar="XXXXXXXX0001",
            aadhaar_hash="dummyhash0001",
            cluster_id=cluster.id,
            state="Chhattisgarh",
            district="Bastar",
            latitude=19.07,
            longitude=82.02,
            primary_craft="Bastar Dhokra",
            monthly_capacity_units=40,
            is_active=False
        )
        db.merge(inactive_artisan)

        # Create an active artisan but with ONLY inactive products
        artisan_with_inactive_prods = Artisan(
            id="test-artisan-inactive-prods-02",
            full_name="Artisan Inactive Prods",
            phone_number="+919000000002",
            masked_aadhaar="XXXXXXXX0002",
            aadhaar_hash="dummyhash0002",
            cluster_id=cluster.id,
            state="Chhattisgarh",
            district="Bastar",
            latitude=19.07,
            longitude=82.02,
            primary_craft="Bastar Dhokra",
            monthly_capacity_units=40,
            is_active=True
        )
        db.merge(artisan_with_inactive_prods)

        inactive_prod = Product(
            id="test-prod-inactive-01",
            artisan_id=artisan_with_inactive_prods.id,
            cluster_id=cluster.id,
            title="Expired Brass Horse",
            craft_type="Bastar Dhokra",
            technique="Lost Wax",
            floor_price=800.0,
            recommended_retail_price=1500.0,
            wholesale_b2b_price=1000.0,
            listing_price=1500.0,
            is_active=False
        )
        db.merge(inactive_prod)
        db.commit()

        service = B2BMatchingService()
        candidates = service.get_candidate_artisans(db=db)
        candidate_ids = {c["artisan_id"] for c in candidates}

        # Assert neither the inactive artisan nor the artisan with only inactive products is included
        assert inactive_artisan.id not in candidate_ids
        assert artisan_with_inactive_prods.id not in candidate_ids
        # Ensure active artisan IS included
        assert sample_cluster_and_artisan["artisan"].id in candidate_ids

    def test_no_hardcoded_location_fallbacks(self, client, buyer_token):
        """RFQs created without coordinates do NOT silently populate fake Delhi 28.6139/77.2090."""
        res = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 25,
                "unit_budget": 1400.0,
                "deadline_days": 30,
            }
        )
        assert res.status_code == 201
        data = res.json()
        assert data["delivery_latitude"] is None
        assert data["delivery_longitude"] is None

    def test_rfq_update_ownership_enforcement(self, client, db, buyer_token, other_buyer_token):
        """Only the RFQ creator (or admin) can update RFQ details or status; others receive 403."""
        # Create RFQ as buyer
        res_create = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 30,
                "unit_budget": 1200.0,
                "deadline_days": 40
            }
        )
        assert res_create.status_code == 201
        rfq_id = res_create.json()["id"]

        # Attempt edit by unauthorized other buyer -> 403
        res_unauth = client.put(
            f"/api/v1/b2b/rfq/{rfq_id}",
            headers={"Authorization": f"Bearer {other_buyer_token}"},
            json={"unit_budget": 1100.0, "status": "IN_NEGOTIATION"}
        )
        assert res_unauth.status_code == 403
        assert "FORBIDDEN_OWNERSHIP" in res_unauth.json()["detail"]

        # Authorized update by creator
        res_auth = client.put(
            f"/api/v1/b2b/rfq/{rfq_id}",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={
                "unit_budget": 1300.0,
                "required_quantity": 50,
                "status": "IN_NEGOTIATION"
            }
        )
        assert res_auth.status_code == 200
        updated = res_auth.json()
        assert updated["unit_budget"] == 1300.0
        assert updated["required_quantity"] == 50
        assert updated["total_budget"] == 65000.0  # 1300 * 50
        assert updated["status"] == "IN_NEGOTIATION"

    def test_rfq_deletion_ownership_enforcement(self, client, buyer_token, other_buyer_token):
        """Only the creating buyer or admin can delete an RFQ."""
        res_create = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 10,
                "unit_budget": 1000.0,
                "deadline_days": 20
            }
        )
        rfq_id = res_create.json()["id"]

        # Attacker cannot delete
        res_fail = client.delete(
            f"/api/v1/b2b/rfq/{rfq_id}",
            headers={"Authorization": f"Bearer {other_buyer_token}"}
        )
        assert res_fail.status_code == 403

        # Creator can delete
        res_ok = client.delete(
            f"/api/v1/b2b/rfq/{rfq_id}",
            headers={"Authorization": f"Bearer {buyer_token}"}
        )
        assert res_ok.status_code == 200
        assert res_ok.json()["status"] == "deleted"

    def test_match_status_update_ownership_enforcement(self, client, db, sample_cluster_and_artisan, buyer_token, other_buyer_token):
        """Updating match status (e.g. ACCEPTED/REJECTED) requires ownership by matched artisan or creating buyer."""
        artisan = sample_cluster_and_artisan["artisan"]

        # Create RFQ as buyer
        res_create = client.post(
            "/api/v1/b2b/rfq",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 10,
                "unit_budget": 1500.0,
                "deadline_days": 30
            }
        )
        rfq_id = res_create.json()["id"]

        # Manually create a match record
        match_rec = B2BMatchRecord(
            id="match-test-status-01",
            rfq_id=rfq_id,
            artisan_id=artisan.id,
            match_percentage=90.0,
            score_craft=95.0,
            score_price=90.0,
            score_capacity=85.0,
            score_location=90.0,
            capacity_feasible=True,
            estimated_production_days=10,
            quoted_unit_price=1200.0,
            distance_km=50.0,
            match_explanation="Test match explanation",
            status="PROPOSED"
        )
        db.merge(match_rec)
        db.commit()

        # Unrelated buyer cannot update match status
        res_unauth = client.put(
            f"/api/v1/b2b/matches/{match_rec.id}/status",
            headers={"Authorization": f"Bearer {other_buyer_token}"},
            json={"status": "ACCEPTED"}
        )
        assert res_unauth.status_code == 403
        assert "FORBIDDEN_OWNERSHIP" in res_unauth.json()["detail"]

        # Creating buyer CAN update match status
        res_buyer_update = client.put(
            f"/api/v1/b2b/matches/{match_rec.id}/status",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={"status": "ACCEPTED"}
        )
        assert res_buyer_update.status_code == 200
        assert res_buyer_update.json()["new_status"] == "ACCEPTED"

        # Matched artisan token CAN update match status
        artisan_token = make_token(artisan.id, role="artisan", email="artisan@crafts.in")
        res_artisan_update = client.put(
            f"/api/v1/b2b/matches/{match_rec.id}/status",
            headers={"Authorization": f"Bearer {artisan_token}"},
            json={"status": "REJECTED"}
        )
        assert res_artisan_update.status_code == 200
        assert res_artisan_update.json()["new_status"] == "REJECTED"

    def test_artisan_matches_endpoint_filters_by_artisan_id(self, client, db, sample_cluster_and_artisan):
        """GET /api/v1/b2b/artisan/matches returns only matches directed to the authenticated artisan."""
        artisan = sample_cluster_and_artisan["artisan"]
        artisan_token = make_token(artisan.id, role="artisan", email="artisan@crafts.in")

        res = client.get(
            "/api/v1/b2b/artisan/matches",
            headers={"Authorization": f"Bearer {artisan_token}"}
        )
        assert res.status_code == 200
        items = res.json()
        for item in items:
            assert item["artisan_id"] == artisan.id
            assert "buyer_phone" not in item
            assert "buyer_email" not in item
