"""
Test Suite: Geographical Indication (GI) Separation & Truthful Verification Integrity
Validates that craft-category GI registration is never conflated with individual artisan authorization
or individual product provenance certification.
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.product import Product
from app.models.craft_cluster import CraftCluster
from app.models.artisan import Artisan
from app.services.rag_craft_knowledge import rag_craft_service


@pytest.fixture(autouse=True)
def initialize_test_db():
    init_db()


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


def auth_header(subject: str, role: str = "artisan", email: str = None, **claims):
    payload = {"app_metadata": {"role": role}, "email": email or f"{subject}@hunardhara.gov.in", **claims}
    return {"Authorization": f"Bearer {create_access_token(subject, extra_claims=payload)}"}


@pytest.fixture
def gi_test_environment(db):
    """Sets up a registered GI craft cluster (Varanasi Silk) and a non-GI craft cluster (Modern Macrame)."""
    # 1. Registered GI Cluster
    gi_cluster_id = f"cl-gi-{uuid.uuid4().hex[:6]}"
    gi_cluster = CraftCluster(
        id=gi_cluster_id,
        name=f"Varanasi Handloom Cluster {gi_cluster_id}",
        craft_name="Varanasi Silk",
        state="Uttar Pradesh",
        district="Varanasi",
        latitude=25.3176,
        longitude=82.9739,
        statutory_hourly_wage=75.0,
        statutory_daily_wage=600.0,
        gi_tag_status="Registered (GI-83)",
        gi_tag_number="GI-83",
    )
    db.merge(gi_cluster)

    # 2. Non-GI Cluster
    nongi_cluster_id = f"cl-nongi-{uuid.uuid4().hex[:6]}"
    nongi_cluster = CraftCluster(
        id=nongi_cluster_id,
        name=f"Urban Macrame Studio {nongi_cluster_id}",
        craft_name="Contemporary Macrame",
        state="Delhi",
        district="New Delhi",
        latitude=28.6139,
        longitude=77.2090,
        statutory_hourly_wage=60.0,
        statutory_daily_wage=480.0,
        gi_tag_status="Not Applicable",
        gi_tag_number=None,
    )
    db.merge(nongi_cluster)

    # 3. Active Artisan in Varanasi
    artisan_id = f"art-gi-{uuid.uuid4().hex[:6]}"
    artisan = Artisan(
        id=artisan_id,
        full_name="Nooruddin Ansari",
        phone_number=f"+91{uuid.uuid4().int % 9000000000 + 1000000000}",
        masked_aadhaar="XXXXXXXX9988",
        aadhaar_hash=uuid.uuid4().hex,
        social_category="OBC",
        state="Uttar Pradesh",
        district="Varanasi",
        latitude=25.3176,
        longitude=82.9739,
        primary_craft="Varanasi Silk",
        cluster_id=gi_cluster_id,
        is_active=True,
    )
    db.merge(artisan)
    db.commit()

    return {
        "gi_cluster": gi_cluster,
        "nongi_cluster": nongi_cluster,
        "artisan": artisan,
    }


class TestGICertificationIntegrity:
    """Rigorous verification suite for GI separation and certification safety."""

    def test_craft_registered_does_not_conflate_with_product_certified(self, client, gi_test_environment):
        """
        Rule 1: A product created in a GI-registered craft cluster (Varanasi Silk)
        inherits craft registration metadata, but MUST NOT be marked as an individual
        certified product without artisan authorization and provenance verification.
        """
        artisan = gi_test_environment["artisan"]
        cluster = gi_test_environment["gi_cluster"]

        payload = {
            "title": "Authentic Handwoven Banarasi Katan Silk Dupatta",
            "craft_type": "Varanasi Silk",
            "artisan_id": artisan.id,
            "cluster_id": cluster.id,
            "materials": ["Katan Silk", "Pure Zari"],
            "technique": "Handloom Jacquard Weaving",
            "cost_materials": 1500.0,
            "labor_hours": 16.0,
            "hourly_wage_rate": 75.0,
            "listing_price": 4500.0,
            "stock_quantity": 3,
        }

        resp = client.post("/api/v1/products", json=payload, headers=auth_header(artisan.id, role="artisan"))
        assert resp.status_code == 201, resp.text
        data = resp.json()

        # Craft level is registered
        assert data["gi_craft_registered"] is True
        assert data["gi_registration_reference"] == "GI-83"
        assert "Varanasi" in data["gi_registered_region"]

        # Artisan authorization is unverified by default
        assert data["gi_artisan_authorization_status"] == "NOT_PROVIDED"
        assert data["gi_authorization_document_reference"] is None

        # Product provenance is unverified by default
        assert data["gi_product_provenance_status"] == "UNVERIFIED"

        # Crucial: Product is NOT certified!
        assert data["is_gi_certified_product"] is False

    def test_region_and_craft_matching_alone_never_certifies_product(self, client, gi_test_environment):
        """
        Rule 2: Artisan in Varanasi crafting Varanasi Silk does NOT automatically get certified.
        Matching region + craft name is proof of craft tradition consistency, NOT product certification.
        """
        artisan = gi_test_environment["artisan"]
        cluster = gi_test_environment["gi_cluster"]

        # Region matches cluster state/district exactly
        assert artisan.state == cluster.state
        assert artisan.district == cluster.district

        payload = {
            "title": "Traditional Varanasi Silk Brocade Saree",
            "craft_type": "Varanasi Silk",
            "artisan_id": artisan.id,
            "cluster_id": cluster.id,
            "materials": ["Silk"],
            "technique": "Pit Loom Weaving",
            "cost_materials": 2000.0,
            "labor_hours": 24.0,
            "listing_price": 6000.0,
            "stock_quantity": 2,
        }

        resp = client.post("/api/v1/products", json=payload, headers=auth_header(artisan.id, role="artisan"))
        assert resp.status_code == 201
        data = resp.json()

        assert data["gi_craft_registered"] is True
        assert data["gi_artisan_authorization_status"] == "NOT_PROVIDED"
        assert data["gi_product_provenance_status"] == "UNVERIFIED"
        assert data["is_gi_certified_product"] is False

    def test_client_side_certification_inflation_attempt_rejected(self, client, gi_test_environment):
        """
        Rule 3 & 4: Client attempting to pass gi_certified=true or gi_artisan_authorization_status="AUTHORIZED"
        without valid admin verification must be overridden.
        """
        artisan = gi_test_environment["artisan"]
        cluster = gi_test_environment["gi_cluster"]

        payload = {
            "title": "Silk Dupatta Claiming Pre-Certification",
            "craft_type": "Varanasi Silk",
            "artisan_id": artisan.id,
            "cluster_id": cluster.id,
            "materials": ["Silk"],
            "technique": "Weaving",
            "cost_materials": 1000.0,
            "labor_hours": 8.0,
            "listing_price": 2500.0,
            "stock_quantity": 2,
            # Malicious/fabricated client claims:
            "gi_certified": True,
            "gi_artisan_authorization_status": "AUTHORIZED",
            "gi_product_provenance_status": "VERIFIED",
        }

        resp = client.post("/api/v1/products", json=payload, headers=auth_header(artisan.id, role="artisan"))
        assert resp.status_code == 201
        data = resp.json()

        # Server overrides client claims:
        assert data["gi_artisan_authorization_status"] == "NOT_PROVIDED"
        assert data["gi_product_provenance_status"] == "UNVERIFIED"
        assert data["is_gi_certified_product"] is False

    def test_artisan_document_submission_transitions_to_pending_review(self, client, gi_test_environment):
        """
        Rule 5: When an artisan submits a GI authorization document reference,
        the status transitions to PENDING_REVIEW, not immediately AUTHORIZED.
        """
        artisan = gi_test_environment["artisan"]
        cluster = gi_test_environment["gi_cluster"]

        payload = {
            "title": "Silk Dupatta with Submitted GI User Card",
            "craft_type": "Varanasi Silk",
            "artisan_id": artisan.id,
            "cluster_id": cluster.id,
            "materials": ["Silk"],
            "technique": "Weaving",
            "cost_materials": 1000.0,
            "labor_hours": 8.0,
            "listing_price": 2500.0,
            "stock_quantity": 2,
            "gi_authorization_document_reference": "GI-AUTH-UP-VAR-2026-9921",
        }

        resp = client.post("/api/v1/products", json=payload, headers=auth_header(artisan.id, role="artisan"))
        assert resp.status_code == 201
        data = resp.json()

        assert data["gi_artisan_authorization_status"] == "PENDING_REVIEW"
        assert data["gi_authorization_document_reference"] == "GI-AUTH-UP-VAR-2026-9921"
        assert data["gi_product_provenance_status"] == "UNVERIFIED"
        # Crucial: Still NOT certified until review concludes!
        assert data["is_gi_certified_product"] is False

    def test_full_gi_certification_achieved_only_with_complete_three_pillar_verification(self, client, gi_test_environment):
        """
        Rule 6: Full product GI certification (is_gi_certified_product == True) occurs
        STRICTLY ONLY when:
        1. gi_craft_registered == True
        2. gi_artisan_authorization_status == "AUTHORIZED"
        3. gi_product_provenance_status == "VERIFIED"
        """
        artisan = gi_test_environment["artisan"]
        cluster = gi_test_environment["gi_cluster"]

        # Step 1: Artisan creates product with document reference
        create_payload = {
            "title": "Master Weaver Certified Banarasi Saree",
            "craft_type": "Varanasi Silk",
            "artisan_id": artisan.id,
            "cluster_id": cluster.id,
            "materials": ["Silk", "Gold Zari"],
            "technique": "Kadwa Weaving",
            "cost_materials": 3000.0,
            "labor_hours": 32.0,
            "listing_price": 9500.0,
            "stock_quantity": 1,
            "gi_authorization_document_reference": "GI-AUTH-UP-VAR-2026-8812",
        }

        resp = client.post("/api/v1/products", json=create_payload, headers=auth_header(artisan.id, role="artisan"))
        assert resp.status_code == 201
        product_id = resp.json()["id"]

        # Step 2: Non-admin artisan attempts to self-certify -> HTTP 403 Forbidden
        hack_resp = client.put(
            f"/api/v1/products/{product_id}",
            json={"gi_artisan_authorization_status": "AUTHORIZED"},
            headers=auth_header(artisan.id, role="artisan")
        )
        assert hack_resp.status_code == 403
        assert "FORBIDDEN_GI_VERIFICATION" in hack_resp.text

        # Step 3: Platform Admin audits document and marks artisan as AUTHORIZED
        admin_auth_resp = client.put(
            f"/api/v1/products/{product_id}",
            json={
                "gi_artisan_authorization_status": "AUTHORIZED",
                "gi_verification_source": "MoSJE National Handicrafts Board Audit",
            },
            headers=auth_header("admin-001", role="admin")
        )
        assert admin_auth_resp.status_code == 200
        admin_data = admin_auth_resp.json()
        assert admin_data["gi_artisan_authorization_status"] == "AUTHORIZED"
        # Provenance is still UNVERIFIED, so still not a certified product!
        assert admin_data["is_gi_certified_product"] is False

        # Step 4: Platform Admin verifies physical provenance of this batch
        admin_prov_resp = client.put(
            f"/api/v1/products/{product_id}",
            json={"gi_product_provenance_status": "VERIFIED"},
            headers=auth_header("admin-001", role="admin")
        )
        assert admin_prov_resp.status_code == 200
        final_data = admin_prov_resp.json()
        assert final_data["gi_craft_registered"] is True
        assert final_data["gi_artisan_authorization_status"] == "AUTHORIZED"
        assert final_data["gi_product_provenance_status"] == "VERIFIED"
        # NOW AND ONLY NOW: Fully GI Certified!
        assert final_data["is_gi_certified_product"] is True

    def test_non_gi_craft_never_marks_craft_registered(self, client, gi_test_environment):
        """
        Rule 7: Modern/uncatalogued craft (Modern Macrame) has gi_craft_registered=False.
        """
        artisan = gi_test_environment["artisan"]
        nongi_cluster = gi_test_environment["nongi_cluster"]

        payload = {
            "title": "Modern Cotton Macrame Wall Hanging",
            "craft_type": "Contemporary Macrame",
            "artisan_id": artisan.id,
            "cluster_id": nongi_cluster.id,
            "materials": ["Cotton Cord", "Wood Rod"],
            "technique": "Knotting",
            "cost_materials": 300.0,
            "labor_hours": 6.0,
            "listing_price": 950.0,
            "stock_quantity": 5,
        }

        resp = client.post("/api/v1/products", json=payload, headers=auth_header(artisan.id, role="artisan"))
        assert resp.status_code == 201
        data = resp.json()

        assert data["gi_craft_registered"] is False
        assert data["gi_registration_reference"] is None
        assert data["gi_artisan_authorization_status"] == "NOT_PROVIDED"
        assert data["is_gi_certified_product"] is False

    def test_rag_knowledge_service_separates_craft_from_artisan_and_product(self):
        """
        Rule 8: RAG service must state that craft tradition matches GI registration,
        but explicitly disclaim that artisan authorization and product provenance are unverified.
        """
        # Varanasi Silk: Craft registered, matching region
        res = rag_craft_service.verify_gi_certification_claim("Varanasi Silk", stated_region="Varanasi, Uttar Pradesh")
        assert res["gi_craft_registered"] is True
        assert res["craft_style_consistent"] is True
        assert res["gi_registration_number"] == "GI-0023"
        assert res["artisan_authorization_status"] == "UNVERIFIED"
        assert res["product_provenance_status"] == "UNVERIFIED"
        assert res["product_certified"] is False
        assert res["is_certified_product"] is False
        assert "Individual artisan authorization card and product provenance remain unverified" in res["disclaimer"]

        # Varanasi Silk made in Bangalore: Craft registered, region mismatched
        res_mismatch = rag_craft_service.verify_gi_certification_claim("Varanasi Silk", stated_region="Bangalore, Karnataka")
        assert res_mismatch["gi_craft_registered"] is True
        assert res_mismatch["craft_style_consistent"] is False
        assert res_mismatch["gi_status"] == "unverified_region"
        assert res_mismatch["product_certified"] is False
        assert res_mismatch["is_certified_product"] is False
