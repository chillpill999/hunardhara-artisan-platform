import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.system_setting import SystemSetting
from app.models.admin_audit_log import AdminAuditLog
from app.models.artisan_application import ArtisanApplication
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.craft_cluster import CraftCluster
from app.services.supabase_admin import supabase_admin


@pytest.fixture(autouse=True)
def clean_system_settings():
    """Initializes DB and cleans system settings and audit logs for isolated test runs."""
    init_db()
    db = SessionLocal()
    try:
        db.query(SystemSetting).filter(
            SystemSetting.key.in_([
                "super_admin_bootstrapped",
                "super_admin_user_id",
                "super_admin_email",
                "super_admin_bootstrapped_at"
            ])
        ).delete(synchronize_session=False)
        db.query(AdminAuditLog).delete(synchronize_session=False)
        db.query(ArtisanApplication).delete(synchronize_session=False)
        db.commit()

        # Seed test craft cluster if missing
        if not db.query(CraftCluster).filter(CraftCluster.id == "cluster-bastar-dhokra-01").first():
            db.add(CraftCluster(
                id="cluster-bastar-dhokra-01",
                name="Bastar Dhokra Cluster",
                craft_name="Bastar Dhokra",
                state="Chhattisgarh",
                district="Bastar",
                latitude=19.07,
                longitude=82.03,
                statutory_hourly_wage=120.0,
                statutory_daily_wage=960.0,
                gi_tag_status="Registered (GI-83)"
            ))
            db.commit()

        # Ensure test artisans exist
        if not db.query(Artisan).filter(Artisan.id == "art-boot-01").first():
            db.add(Artisan(
                id="art-boot-01",
                full_name="Artisan Boot 1",
                phone_number="+919876500001",
                masked_aadhaar="XXXXXXXX9001",
                aadhaar_hash="hash-boot-01",
                social_category="General",
                cluster_id="cluster-bastar-dhokra-01",
                state="Chhattisgarh",
                district="Bastar",
                latitude=19.07,
                longitude=82.03,
                primary_craft="Bastar Dhokra",
                is_active=True
            ))
            db.commit()

        if not db.query(Artisan).filter(Artisan.id == "art-boot-02").first():
            db.add(Artisan(
                id="art-boot-02",
                full_name="Artisan Boot 2",
                phone_number="+919876500002",
                masked_aadhaar="XXXXXXXX9002",
                aadhaar_hash="hash-boot-02",
                social_category="General",
                cluster_id="cluster-bastar-dhokra-01",
                state="Chhattisgarh",
                district="Bastar",
                latitude=19.07,
                longitude=82.03,
                primary_craft="Bastar Dhokra",
                is_active=True
            ))
            db.commit()

    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def tokens():
    return {
        "customer": create_access_token("cust-boot-10", extra_claims={"app_metadata": {"role": "customer"}, "email": "customer@test.gov.in"}),
        "customer2": create_access_token("cust-boot-20", extra_claims={"app_metadata": {"role": "customer"}, "email": "customer2@test.gov.in"}),
        "artisan1": create_access_token("art-boot-01", extra_claims={"app_metadata": {"role": "artisan"}, "email": "artisan1@test.gov.in"}),
        "artisan2": create_access_token("art-boot-02", extra_claims={"app_metadata": {"role": "artisan"}, "email": "artisan2@test.gov.in"}),
        "admin": create_access_token("admin-001", extra_claims={"app_metadata": {"role": "admin"}, "email": "admin@test.gov.in"}),
        "super_admin": create_access_token("sa-aryan", extra_claims={"app_metadata": {"role": "super_admin"}, "email": "aryanrockstar2007@gmail.com"}),
    }


class TestSuperAdminBootstrap:
    """Complete test suite for the First-Time Super Admin Bootstrap & Role Upgrade Loop."""

    def test_01_bootstrap_status_initially_unbootstrapped(self, client):
        """Diagnostic endpoint reports bootstrapped=False before initialization."""
        res = client.get("/api/v1/admin/bootstrap-status")
        assert res.status_code == 200
        data = res.json()
        assert data["bootstrapped"] is False
        assert data["super_admin_email"] is None

    def test_02_bootstrap_rejects_unauthorized_email(self, client):
        """Only the designated initial administrative email is accepted."""
        res = client.post(
            "/api/v1/admin/bootstrap-super-admin",
            json={"email": "attacker@evil.org"}
        )
        assert res.status_code == 403
        assert "BOOTSTRAP_UNAUTHORIZED" in res.json()["detail"]

    def test_03_bootstrap_succeeds_for_initial_super_admin(self, client):
        """Designated account aryanrockstar2007@gmail.com is provisioned with super_admin role."""
        res = client.post(
            "/api/v1/admin/bootstrap-super-admin",
            json={"email": "aryanrockstar2007@gmail.com"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["bootstrapped"] is True
        assert data["role"] == "super_admin"
        assert data["email"] == "aryanrockstar2007@gmail.com"

        # Verify persistent system settings
        db = SessionLocal()
        try:
            bootstrapped_setting = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_bootstrapped").first()
            assert bootstrapped_setting is not None
            assert bootstrapped_setting.value == "true"

            email_setting = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_email").first()
            assert email_setting is not None
            assert email_setting.value == "aryanrockstar2007@gmail.com"

            # Verify audit trail
            audit = db.query(AdminAuditLog).filter(AdminAuditLog.action == "BOOTSTRAP_SUPER_ADMIN").first()
            assert audit is not None
            assert audit.actor_email == "aryanrockstar2007@gmail.com"
        finally:
            db.close()

    def test_04_bootstrap_is_idempotent_and_rejects_subsequent_calls(self, client):
        """Once bootstrapped, subsequent calls are rejected with HTTP 409 Conflict."""
        # First call provisions
        res1 = client.post(
            "/api/v1/admin/bootstrap-super-admin",
            json={"email": "aryanrockstar2007@gmail.com"}
        )
        assert res1.status_code == 200

        # Second call returns 409
        res2 = client.post(
            "/api/v1/admin/bootstrap-super-admin",
            json={"email": "aryanrockstar2007@gmail.com"}
        )
        assert res2.status_code == 409
        assert "SUPER_ADMIN_ALREADY_EXISTS" in res2.json()["detail"]

    def test_05_bootstrap_status_reports_bootstrapped_after_init(self, client):
        """Diagnostic endpoint reports bootstrapped=True and email after provisioning."""
        client.post(
            "/api/v1/admin/bootstrap-super-admin",
            json={"email": "aryanrockstar2007@gmail.com"}
        )
        res = client.get("/api/v1/admin/bootstrap-status")
        assert res.status_code == 200
        data = res.json()
        assert data["bootstrapped"] is True
        assert data["super_admin_email"] == "aryanrockstar2007@gmail.com"

    def test_06_admin_list_requires_super_admin(self, client, tokens):
        """GET /api/v1/admin/admins requires super_admin role; admin, artisan, customer are forbidden."""
        headers_cust = {"Authorization": f"Bearer {tokens['customer']}"}
        headers_art = {"Authorization": f"Bearer {tokens['artisan1']}"}
        headers_adm = {"Authorization": f"Bearer {tokens['admin']}"}
        headers_sa = {"Authorization": f"Bearer {tokens['super_admin']}"}

        # Customer forbidden
        res = client.get("/api/v1/admin/admins", headers=headers_cust)
        assert res.status_code == 403

        # Artisan forbidden
        res = client.get("/api/v1/admin/admins", headers=headers_art)
        assert res.status_code == 403

        # Admin forbidden (only super_admin can manage administrators)
        res = client.get("/api/v1/admin/admins", headers=headers_adm)
        assert res.status_code == 403

        # Super Admin allowed
        res = client.get("/api/v1/admin/admins", headers=headers_sa)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_07_super_admin_can_grant_and_revoke_admin_role(self, client, tokens):
        """Super admin grants 'admin' role to a user and revokes it; logs audit entries."""
        headers_sa = {"Authorization": f"Bearer {tokens['super_admin']}"}
        target_user = "user-to-promote-01"

        # Grant admin
        res_grant = client.post(f"/api/v1/admin/admins/{target_user}/grant", headers=headers_sa)
        assert res_grant.status_code == 200
        assert res_grant.json()["new_role"] == "admin"

        # Check audit log
        db = SessionLocal()
        try:
            grant_audit = db.query(AdminAuditLog).filter(
                AdminAuditLog.action == "GRANT_ADMIN_ROLE",
                AdminAuditLog.target_user_id == target_user
            ).first()
            assert grant_audit is not None
        finally:
            db.close()

        # Revoke admin
        res_revoke = client.post(f"/api/v1/admin/admins/{target_user}/revoke", headers=headers_sa)
        assert res_revoke.status_code == 200
        assert res_revoke.json()["new_role"] == "customer"

        # Check revocation audit log
        db = SessionLocal()
        try:
            revoke_audit = db.query(AdminAuditLog).filter(
                AdminAuditLog.action == "REVOKE_ADMIN_ROLE",
                AdminAuditLog.target_user_id == target_user
            ).first()
            assert revoke_audit is not None
        finally:
            db.close()

    def test_08_super_admin_cannot_revoke_self(self, client, tokens):
        """Self-revocation guard: Super admin cannot demote themselves to prevent administrative lockouts."""
        headers_sa = {"Authorization": f"Bearer {tokens['super_admin']}"}
        res = client.post("/api/v1/admin/admins/sa-aryan/revoke", headers=headers_sa)
        assert res.status_code == 400
        assert "CANNOT_REVOKE_SELF" in res.json()["detail"]

    def test_09_audit_logs_rbac_enforcement(self, client, tokens):
        """GET /api/v1/admin/audit-logs is restricted to admin and super_admin."""
        # Anonymous forbidden
        res = client.get("/api/v1/admin/audit-logs")
        assert res.status_code == 401

        # Customer forbidden
        res = client.get("/api/v1/admin/audit-logs", headers={"Authorization": f"Bearer {tokens['customer']}"})
        assert res.status_code == 403

        # Artisan forbidden
        res = client.get("/api/v1/admin/audit-logs", headers={"Authorization": f"Bearer {tokens['artisan1']}"})
        assert res.status_code == 403

        # Admin allowed
        res = client.get("/api/v1/admin/audit-logs", headers={"Authorization": f"Bearer {tokens['admin']}"})
        assert res.status_code == 200
        assert isinstance(res.json(), list)

        # Super Admin allowed
        res = client.get("/api/v1/admin/audit-logs", headers={"Authorization": f"Bearer {tokens['super_admin']}"})
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_10_artisan_application_submission_and_review(self, client, tokens):
        """Customer submits application, views history; admin reviews and approves."""
        headers_cust = {"Authorization": f"Bearer {tokens['customer']}"}
        headers_sa = {"Authorization": f"Bearer {tokens['super_admin']}"}

        # 1. Customer submits
        res_sub = client.post(
            "/api/v1/artisan/apply",
            json={
                "craft_category": "Varanasi Silk Brocade",
                "experience_years": 8,
                "state": "Uttar Pradesh",
                "district": "Varanasi"
            },
            headers=headers_cust
        )
        assert res_sub.status_code in [200, 201]
        app_id = res_sub.json()["id"]
        assert res_sub.json()["status"] == "pending"

        # 2. Customer views own application
        res_my = client.get("/api/v1/artisan/application/my", headers=headers_cust)
        assert res_my.status_code == 200
        my_apps = res_my.json()
        assert len(my_apps) >= 1
        assert any(a["id"] == app_id for a in my_apps)

        # 3. Another customer cannot see customer1's application in their personal history
        headers_cust2 = {"Authorization": f"Bearer {tokens['customer2']}"}
        res_cust2 = client.get("/api/v1/artisan/application/my", headers=headers_cust2)
        assert res_cust2.status_code == 200
        assert not any(a["id"] == app_id for a in res_cust2.json())

        # 4. Super Admin and Admin can list applications
        res_admin_list = client.get("/api/v1/admin/applications", headers=headers_sa)
        assert res_admin_list.status_code == 200
        all_apps = res_admin_list.json()
        assert any(a["id"] == app_id for a in all_apps)

        # 5. Regular Admin CANNOT approve or reject (Super Admin Only requirement)
        headers_adm = {"Authorization": f"Bearer {tokens['admin']}"}
        res_adm_approve = client.post(f"/api/v1/admin/applications/{app_id}/approve", headers=headers_adm)
        assert res_adm_approve.status_code == 403
        assert "Super Administrator privileges required" in res_adm_approve.json()["detail"]

        res_adm_reject = client.post(f"/api/v1/admin/applications/{app_id}/reject", headers=headers_adm)
        assert res_adm_reject.status_code == 403
        assert "Super Administrator privileges required" in res_adm_reject.json()["detail"]

        # Customer CANNOT approve
        res_cust_approve = client.post(f"/api/v1/admin/applications/{app_id}/approve", headers=headers_cust)
        assert res_cust_approve.status_code == 403

        # 6. Super Admin approves application (Authorized)
        res_approve = client.post(f"/api/v1/admin/applications/{app_id}/approve", headers=headers_sa)
        assert res_approve.status_code == 200
        assert res_approve.json()["status"] == "approved"

        # 6. Verify Artisan record is created
        db = SessionLocal()
        try:
            art = db.query(Artisan).filter(Artisan.id == "cust-boot-10").first()
            assert art is not None
            assert art.primary_craft == "Varanasi Silk Brocade"

            # Verify audit log recorded
            audit = db.query(AdminAuditLog).filter(
                AdminAuditLog.action == "APPROVE_ARTISAN_APPLICATION",
                AdminAuditLog.target_user_id == "cust-boot-10"
            ).first()
            assert audit is not None
        finally:
            db.close()

    def test_11_artisan_product_ownership_enforcement(self, client, tokens):
        """Artisan A cannot update or delete Artisan B's products. Admins have oversight."""
        db = SessionLocal()
        try:
            # Create a product owned by artisan1
            prod1 = Product(
                id="prod-boot-001",
                artisan_id="art-boot-01",
                cluster_id="cluster-bastar-dhokra-01",
                title="Dhokra Bell",
                craft_type="Bastar Dhokra",
                technique="Lost Wax Casting",
                listing_price=1200.0,
                cost_materials=400.0,
                labor_hours=4.0,
                hourly_wage_rate=120.0,
                floor_price=920.0,
                recommended_retail_price=1400.0,
                wholesale_b2b_price=1100.0,
                stock_quantity=5,
                is_active=True
            )
            db.merge(prod1)
            db.commit()
        finally:
            db.close()

        headers_art1 = {"Authorization": f"Bearer {tokens['artisan1']}"}
        headers_art2 = {"Authorization": f"Bearer {tokens['artisan2']}"}
        headers_admin = {"Authorization": f"Bearer {tokens['admin']}"}
        headers_sa = {"Authorization": f"Bearer {tokens['super_admin']}"}

        # 1. Artisan B attempts to update Artisan A's product -> 403 Forbidden
        res_upd_b = client.put(
            "/api/v1/products/prod-boot-001",
            json={"listing_price": 1500.0},
            headers=headers_art2
        )
        assert res_upd_b.status_code == 403
        assert "FORBIDDEN_OWNERSHIP" in res_upd_b.json()["detail"]

        # 2. Artisan B attempts to delete Artisan A's product -> 403 Forbidden
        res_del_b = client.delete(
            "/api/v1/products/prod-boot-001",
            headers=headers_art2
        )
        assert res_del_b.status_code == 403
        assert "FORBIDDEN_OWNERSHIP" in res_del_b.json()["detail"]

        # 3. Artisan A (owner) CAN update their own product
        res_upd_a = client.put(
            "/api/v1/products/prod-boot-001",
            json={"listing_price": 1400.0},
            headers=headers_art1
        )
        assert res_upd_a.status_code == 200
        assert res_upd_a.json()["listing_price"] == 1400.0

        # 4. Super Admin CAN delete the product
        res_del_sa = client.delete(
            "/api/v1/products/prod-boot-001",
            headers=headers_sa
        )
        assert res_del_sa.status_code == 200
        assert res_del_sa.json()["status"] == "deleted"

    def test_12_application_lifecycle_and_rejection_validation(self, client, tokens):
        """Tests that repeated approval fails, rejection requires reason, and fields persist."""
        headers_cust = {"Authorization": f"Bearer {tokens['customer2']}"}
        headers_sa = {"Authorization": f"Bearer {tokens['super_admin']}"}

        # 1. Customer submits full application details
        res_sub = client.post(
            "/api/v1/artisan/apply",
            json={
                "full_name": "Ramesh Kumar Sharma",
                "phone": "+919876543210",
                "craft_category": "Khurja Pottery",
                "experience_years": 12,
                "state": "Uttar Pradesh",
                "district": "Bulandshahr",
                "workshop_info": "Family kiln workshop since 1985",
                "craft_description": "Hand-glazed ceramic tea kettles and tableware using lead-free local clay.",
                "sample_images": ["https://example.com/craft1.jpg"],
                "document_references": ["DOC-KHURJA-2026"]
            },
            headers=headers_cust
        )
        assert res_sub.status_code == 201
        app_data = res_sub.json()
        app_id = app_data["id"]
        assert app_data["full_name"] == "Ramesh Kumar Sharma"
        assert app_data["phone"] == "+919876543210"
        assert app_data["craft_category"] == "Khurja Pottery"
        assert app_data["workshop_info"] == "Family kiln workshop since 1985"
        assert app_data["status"] == "pending"

        # 2. Reject without valid reason fails (422)
        res_rej_fail = client.post(
            f"/api/v1/admin/applications/{app_id}/reject",
            json={"reason": "  "},
            headers=headers_sa
        )
        assert res_rej_fail.status_code in [400, 422]

        # 3. Super Admin rejects with valid reason
        res_rej = client.post(
            f"/api/v1/admin/applications/{app_id}/reject",
            json={"reason": "Sample images require clearer craft workshop documentation."},
            headers=headers_sa
        )
        assert res_rej.status_code == 200
        rejected_data = res_rej.json()
        assert rejected_data["status"] == "rejected"
        assert rejected_data["rejection_reason"] == "Sample images require clearer craft workshop documentation."
        assert rejected_data["reviewed_by"] == "sa-aryan"
        assert rejected_data["reviewed_at"] is not None

        # 4. Repeated rejection on already rejected application fails (400)
        res_rej_repeat = client.post(
            f"/api/v1/admin/applications/{app_id}/reject",
            json={"reason": "Duplicate attempt"},
            headers=headers_sa
        )
        assert res_rej_repeat.status_code == 400
        assert "Only pending applications can be rejected" in res_rej_repeat.json()["detail"]

        # 5. Attempting to approve an already rejected application fails (400)
        res_app_fail = client.post(
            f"/api/v1/admin/applications/{app_id}/approve",
            headers=headers_sa
        )
        assert res_app_fail.status_code == 400
        assert "Only pending applications can be approved" in res_app_fail.json()["detail"]
