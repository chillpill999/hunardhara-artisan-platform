import os
import uuid
import hashlib
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token, redact_sensitive_text
from app.core.config import settings
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.craft_cluster import CraftCluster
from app.models.order import Order
from app.models.b2b_rfq import B2BRFQ
from app.models.artisan_application import ArtisanApplication
from app.models.consent_log import ConsentLog
from app.models.deactivated_user import DeactivatedUser


@pytest.fixture(autouse=True)
def ensure_db():
    init_db()
    session = SessionLocal()
    try:
        if not session.query(CraftCluster).filter(CraftCluster.id == "cl-privacy-test").first():
            cluster = CraftCluster(
                id="cl-privacy-test",
                name="Privacy Test Cluster",
                craft_name="Bastar Dhokra",
                state="Chhattisgarh",
                district="Bastar",
                latitude=19.07,
                longitude=82.03,
                statutory_hourly_wage=120.0,
                statutory_daily_wage=960.0,
                gi_tag_status="Registered (GI-83)"
            )
            session.add(cluster)
            session.commit()
    finally:
        session.close()


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


def make_token(user_id: str, role: str = "customer", email: str = "user@hunardhara.gov.in"):
    return create_access_token(
        subject=user_id,
        extra_claims={
            "app_metadata": {"role": role},
            "email": email,
        },
    )


@pytest.fixture
def admin_token():
    return make_token("admin-001", "admin", "admin@hunardhara.gov.in")


class TestPrivacyHardeningAndDPDP:
    """Enterprise DPDP Act 2023 and PII Protection Test Suite."""

    # -------------------------------------------------------------
    # 1. Redaction Utility & Log Masking
    # -------------------------------------------------------------
    def test_redact_sensitive_text_utility(self):
        # Email redaction
        text = "Contact user at john.doe@example.com or admin@hunardhara.gov.in"
        redacted = redact_sensitive_text(text)
        assert "john.doe@example.com" not in redacted
        assert "j***e@example.com" in redacted
        assert "a***n@hunardhara.gov.in" in redacted

        # Phone redaction (Indian numbers)
        text_phone = "Artisan phone is +919876543210 or 9876543210"
        redacted_phone = redact_sensitive_text(text_phone)
        assert "9876543210" not in redacted_phone
        assert "+9198****3210" in redacted_phone or "98****3210" in redacted_phone

        # Aadhaar redaction (including 12-digit numbers)
        text_aadhaar = "Citizen Aadhaar is 1234 5678 9012"
        redacted_aadhaar = redact_sensitive_text(text_aadhaar)
        assert "1234 5678 9012" not in redacted_aadhaar
        assert "XXXXXXXX9012" in redacted_aadhaar

        # Bearer token redaction
        text_token = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0"
        redacted_token = redact_sensitive_text(text_token)
        assert "Bearer [REDACTED]" in redacted_token

    # -------------------------------------------------------------
    # 2. Deactivated User Access Denial
    # -------------------------------------------------------------
    def test_deactivated_user_blocked_with_403(self, client, db):
        deact_user_id = f"deact-user-{uuid.uuid4().hex[:8]}"
        
        # Add to deactivated registry
        deact_entry = DeactivatedUser(
            id=deact_user_id,
            reason="User requested account deletion under DPDP Act"
        )
        db.add(deact_entry)
        db.commit()

        token = make_token(deact_user_id, role="customer")
        headers = {"Authorization": f"Bearer {token}"}

        # Any protected endpoint should immediately block with HTTP 403 ACCOUNT_DEACTIVATED
        res = client.get("/api/v1/orders/customer", headers=headers)
        assert res.status_code == 403
        assert "ACCOUNT_DEACTIVATED" in res.json()["detail"]

        res2 = client.get("/api/v1/compliance/consent", headers=headers)
        assert res2.status_code == 403
        assert "ACCOUNT_DEACTIVATED" in res2.json()["detail"]

    def test_inactive_artisan_blocked_with_403(self, client, db):
        art_id = f"art-inactive-{uuid.uuid4().hex[:8]}"
        artisan = Artisan(
            id=art_id,
            full_name="Deactivated Weaver",
            phone_number=f"+91{uuid.uuid4().int % 10000000000:010d}",
            masked_aadhaar="XXXXXXXX8888",
            aadhaar_hash=hashlib.sha256(art_id.encode()).hexdigest(),
            social_category="ST",
            cluster_id="cl-privacy-test",
            state="Chhattisgarh",
            district="Bastar",
            latitude=19.07,
            longitude=82.03,
            primary_craft="Bastar Dhokra",
            is_active=False
        )
        db.add(artisan)
        db.commit()

        token = make_token(art_id, role="artisan")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/v1/orders/artisan", headers=headers)
        assert res.status_code == 403
        assert "ACCOUNT_DEACTIVATED" in res.json()["detail"]

    # -------------------------------------------------------------
    # 3. Customer Deletion Flow (Data Erasure & Anonymization)
    # -------------------------------------------------------------
    def test_customer_complete_deletion(self, client, db):
        cust_id = f"cust-del-{uuid.uuid4().hex[:8]}"
        cust_token = make_token(cust_id, role="customer", email="delete.me@patron.com")
        headers = {"Authorization": f"Bearer {cust_token}"}

        # Create dummy order for this customer
        order = Order(
            id=f"ord-{uuid.uuid4().hex[:8]}",
            order_number=f"ORD-DEL-{uuid.uuid4().hex[:6].upper()}",
            customer_id=cust_id,
            artisan_id="art-varanasi-001",
            product_id="prod-test-01",
            product_title="Silk Saree",
            quantity=1,
            total_price=1000.0,
            status="delivered",
            payment_status="paid",
            payment_id="pay_del_123"
        )
        db.add(order)

        # Create RFQ by this customer
        rfq = B2BRFQ(
            id=f"rfq-{uuid.uuid4().hex[:8]}",
            buyer_id=cust_id,
            craft_type="Bastar Dhokra",
            required_quantity=10,
            unit_budget=1200.0,
            total_budget=12000.0,
            deadline_days=30,
            buyer_name="Patron Requester",
            buyer_email="delete.me@patron.com",
            buyer_phone="+919876543210"
        )
        db.add(rfq)

        # Create Artisan Application by this customer
        app_id = f"app-{uuid.uuid4().hex[:8]}"
        app_record = ArtisanApplication(
            id=app_id,
            user_id=cust_id,
            craft_category="Weaving",
            status="pending"
        )
        db.add(app_record)
        db.commit()

        # Try to delete someone else's account (should fail 403)
        other_token = make_token("other-user-999", role="customer")
        res_fail = client.delete(f"/api/v1/compliance/customer/{cust_id}", headers={"Authorization": f"Bearer {other_token}"})
        assert res_fail.status_code == 403

        # Execute sovereign account deletion as owner
        res_del = client.delete(f"/api/v1/compliance/customer/{cust_id}", headers=headers)
        assert res_del.status_code == 200
        del_data = res_del.json()
        assert del_data["status"] in ("purged", "success")
        assert del_data["records_redacted"] >= 1

        # Verify DB state
        db.expire_all()
        # Order customer_id should now be anonymized
        db_order = db.query(Order).filter(Order.id == order.id).first()
        assert db_order.customer_id.startswith("REDACTED_") or db_order.customer_id.startswith("deleted-customer-")
        assert db_order.customer_id != cust_id

        # RFQ buyer personal info should be redacted
        db_rfq = db.query(B2BRFQ).filter(B2BRFQ.id == rfq.id).first()
        assert db_rfq.buyer_name == "REDACTED"
        assert "anonymized.invalid" in db_rfq.buyer_email
        assert db_rfq.buyer_phone is None

        # ArtisanApplication should be deleted
        db_app = db.query(ArtisanApplication).filter(ArtisanApplication.id == app_id).first()
        assert db_app is None

        # Deactivated registry must contain cust_id
        deact = db.query(DeactivatedUser).filter(DeactivatedUser.id == cust_id).first()
        assert deact is not None

        # Consent audit log must be recorded
        audit = db.query(ConsentLog).filter(ConsentLog.user_id == cust_id).first()
        assert audit is not None
        assert audit.consent_type in ("RIGHT_TO_BE_FORGOTTEN", "SOVEREIGN_CUSTOMER_ERASURE")

        # Subsequent requests with original token must be rejected 403
        res_subsequent = client.get("/api/v1/orders/customer", headers=headers)
        assert res_subsequent.status_code == 403
        assert "ACCOUNT_DEACTIVATED" in res_subsequent.json()["detail"]

    # -------------------------------------------------------------
    # 4. Artisan Deletion Flow (Data Erasure & Anonymization)
    # -------------------------------------------------------------
    def test_artisan_complete_deletion(self, client, db):
        art_id = f"art-del-{uuid.uuid4().hex[:8]}"
        artisan = Artisan(
            id=art_id,
            full_name="Artisan To Forget",
            phone_number=f"+91{uuid.uuid4().int % 10000000000:010d}",
            masked_aadhaar="XXXXXXXX7777",
            aadhaar_hash=hashlib.sha256(art_id.encode()).hexdigest(),
            social_category="SC",
            cluster_id="cl-privacy-test",
            state="Chhattisgarh",
            district="Bastar",
            village="Secret Hamlet",
            latitude=19.07,
            longitude=82.03,
            primary_craft="Bastar Dhokra",
            is_active=True
        )
        db.add(artisan)

        # Create active craft product
        prod = Product(
            id=f"prod-del-{uuid.uuid4().hex[:8]}",
            artisan_id=art_id,
            cluster_id="cl-privacy-test",
            title="Dhokra Bell",
            craft_type="Bastar Dhokra",
            technique="Lost Wax Casting",
            floor_price=500.0,
            recommended_retail_price=800.0,
            wholesale_b2b_price=650.0,
            listing_price=800.0,
            stock_quantity=5,
            is_active=True
        )
        db.add(prod)
        db.commit()

        art_token = make_token(art_id, role="artisan")
        headers = {"Authorization": f"Bearer {art_token}"}

        # Attempt deletion by another artisan (should fail 403)
        unauth_token = make_token("art-other-123", role="artisan")
        res_fail = client.post(
            "/api/v1/compliance/forget",
            json={"artisan_id": art_id, "confirmation": True},
            headers={"Authorization": f"Bearer {unauth_token}"}
        )
        assert res_fail.status_code == 403

        # Execute deletion as owner
        res_del = client.post(
            "/api/v1/compliance/forget",
            json={"artisan_id": art_id, "confirmation": True},
            headers=headers
        )
        assert res_del.status_code == 200
        del_data = res_del.json()
        assert del_data["status"] in ("success", "purged")

        # Verify DB records
        db.expire_all()
        db_art = db.query(Artisan).filter(Artisan.id == art_id).first()
        assert db_art.full_name in ("REDACTED_ARTISAN", "Deleted Artisan")
        assert "REDACTED" in db_art.phone_number or "0000" in db_art.phone_number
        assert db_art.masked_aadhaar in ("XXXXXXXX0000", "XXXXXXXXXXXX")
        assert db_art.village in ("REDACTED", "Redacted")
        assert db_art.is_active is False

        # Product must be deactivated
        db_prod = db.query(Product).filter(Product.id == prod.id).first()
        assert db_prod.is_active is False

        # DeactivatedUser record exists
        deact = db.query(DeactivatedUser).filter(DeactivatedUser.id == art_id).first()
        assert deact is not None

        # Subsequent API request blocked with 403
        res_subsequent = client.get("/api/v1/orders/artisan", headers=headers)
        assert res_subsequent.status_code == 403

    # -------------------------------------------------------------
    # 5. DPDP Section 11 Data Portability / Export
    # -------------------------------------------------------------
    def test_dpdp_data_export_ownership_enforcement(self, client, db, admin_token):
        user_id = f"user-exp-{uuid.uuid4().hex[:8]}"
        user_token = make_token(user_id, role="customer", email="export.me@test.in")

        # Unauthenticated export rejected (401)
        res_no_auth = client.get(f"/api/v1/compliance/export?user_id={user_id}")
        assert res_no_auth.status_code == 401

        # Another user attempting to export user_id rejected (403)
        other_token = make_token("user-intruder-01", role="customer")
        res_forbidden = client.get(
            f"/api/v1/compliance/export?user_id={user_id}",
            headers={"Authorization": f"Bearer {other_token}"}
        )
        assert res_forbidden.status_code == 403
        assert "FORBIDDEN_OWNERSHIP" in res_forbidden.json()["detail"]

        # Owner exporting their data succeeds
        res_owner = client.get(
            f"/api/v1/compliance/export?user_id={user_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert res_owner.status_code == 200
        data = res_owner.json()
        assert data["user_id"] == user_id
        assert "orders" in data
        assert "b2b_rfqs" in data
        assert "applications" in data
        assert "consent_records" in data

        # Admin can export data for compliance audit
        res_admin = client.get(
            f"/api/v1/compliance/export?user_id={user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_admin.status_code == 200
        assert res_admin.json()["user_id"] == user_id

    # -------------------------------------------------------------
    # 6. DPDP Section 6 Consent Revocation & Query
    # -------------------------------------------------------------
    def test_consent_revocation_lifecycle(self, client, db):
        art_id = f"art-cst-{uuid.uuid4().hex[:8]}"
        art_token = make_token(art_id, role="artisan")
        headers = {"Authorization": f"Bearer {art_token}"}

        # Record consent
        res_grant = client.post(
            "/api/v1/compliance/consent",
            json={
                "artisan_id": art_id,
                "consent_type": "MARKETING_SHOWCASE",
                "granted": True,
                "purpose": "Showcase craft on national e-commerce portal"
            },
            headers=headers
        )
        assert res_grant.status_code == 200
        consent_id = res_grant.json()["ledger_id"]

        # Unrelated user attempting to revoke consent yields 403
        other_token = make_token("art-unrelated-02", role="artisan")
        res_revoke_unauth = client.post(
            f"/api/v1/compliance/consent/{consent_id}/revoke",
            json={"reason": "Revoking someone else's consent"},
            headers={"Authorization": f"Bearer {other_token}"}
        )
        assert res_revoke_unauth.status_code == 403
        assert "FORBIDDEN_OWNERSHIP" in res_revoke_unauth.json()["detail"]

        # Owner revoking consent succeeds
        res_revoke = client.post(
            f"/api/v1/compliance/consent/{consent_id}/revoke",
            json={"reason": "Withdraw consent per DPDP Act Section 6"},
            headers=headers
        )
        assert res_revoke.status_code == 200
        revoke_data = res_revoke.json()
        assert revoke_data["status"] == "revoked"
        assert revoke_data["revoked_at"] is not None

        # Query consent logs for this artisan
        res_list = client.get(f"/api/v1/compliance/consent?artisan_id={art_id}", headers=headers)
        assert res_list.status_code == 200
        logs = res_list.json()
        matching = [l for l in logs if l["id"] == consent_id]
        assert len(matching) == 1
        assert matching[0]["granted"] is False
        assert matching[0]["revoked_at"] is not None

    # -------------------------------------------------------------
    # 7. Public vs Authenticated Artisan Profile Isolation
    # -------------------------------------------------------------
    def test_artisan_public_profile_never_exposes_pii(self, client, db, admin_token):
        art_id = f"art-prof-{uuid.uuid4().hex[:8]}"
        artisan = Artisan(
            id=art_id,
            full_name="Master Craftsman Ramesh",
            phone_number=f"+91{uuid.uuid4().int % 10000000000:010d}",
            masked_aadhaar="XXXXXXXX4567",
            aadhaar_hash=hashlib.sha256(art_id.encode()).hexdigest(),
            social_category="OBC",
            cluster_id="cl-privacy-test",
            state="Chhattisgarh",
            district="Bastar",
            village="Private Workshop Village",
            latitude=19.07123,
            longitude=82.03456,
            primary_craft="Bastar Dhokra",
            experience_years=25,
            is_active=True
        )
        db.add(artisan)
        db.commit()

        # 1. Anonymous public endpoint GET /api/v1/artisans/{id}
        res_public = client.get(f"/api/v1/artisans/{art_id}")
        assert res_public.status_code == 200
        pub_data = res_public.json()

        # Verify absolute PII omission
        assert "phone_number" not in pub_data
        assert "masked_aadhaar" not in pub_data
        assert "aadhaar_hash" not in pub_data
        assert "latitude" not in pub_data
        assert "longitude" not in pub_data
        assert "social_category" not in pub_data
        assert pub_data["full_name"] == "Master Craftsman Ramesh"
        assert pub_data["primary_craft"] == "Bastar Dhokra"

        # 2. Public directory listing GET /api/v1/artisans
        res_list = client.get("/api/v1/artisans")
        assert res_list.status_code == 200
        items = res_list.json()
        assert isinstance(items, list)
        for item in items:
            assert "phone_number" not in item
            assert "masked_aadhaar" not in item
            assert "aadhaar_hash" not in item
            assert "latitude" not in item
            assert "longitude" not in item
            assert "social_category" not in item

        # 3. Owner querying their own profile GET /api/v1/artisans/{id}
        art_token = make_token(art_id, role="artisan")
        res_owner = client.get(
            f"/api/v1/artisans/{art_id}",
            headers={"Authorization": f"Bearer {art_token}"}
        )
        assert res_owner.status_code == 200
        owner_data = res_owner.json()
        assert "phone_number" in owner_data
        assert owner_data["phone_number"] == artisan.phone_number
        assert owner_data["masked_aadhaar"] == "XXXXXXXX4567"
        assert owner_data["social_category"] == "OBC"

        # 4. Owner calling GET /api/v1/artisans/me
        res_me = client.get("/api/v1/artisans/me", headers={"Authorization": f"Bearer {art_token}"})
        assert res_me.status_code == 200
        assert res_me.json()["id"] == art_id

        # 5. Customer calling GET /api/v1/artisans/me is rejected
        cust_token = make_token("cust-unauth-me", role="customer")
        res_cust_me = client.get("/api/v1/artisans/me", headers={"Authorization": f"Bearer {cust_token}"})
        assert res_cust_me.status_code == 403

    # -------------------------------------------------------------
    # 8. Order Data Minimization (Financial Token Privacy)
    # -------------------------------------------------------------
    def test_order_payment_data_minimization(self, client, db, admin_token):
        cust_id = f"cust-ord-{uuid.uuid4().hex[:8]}"
        art_id = f"art-ord-{uuid.uuid4().hex[:8]}"

        artisan = Artisan(
            id=art_id,
            full_name="Weaver Somesh",
            phone_number=f"+91{uuid.uuid4().int % 10000000000:010d}",
            masked_aadhaar="XXXXXXXX1234",
            aadhaar_hash=hashlib.sha256(art_id.encode()).hexdigest(),
            social_category="General",
            cluster_id="cl-privacy-test",
            state="Chhattisgarh",
            district="Bastar",
            latitude=19.07,
            longitude=82.03,
            primary_craft="Bastar Dhokra",
            is_active=True
        )
        db.add(artisan)

        order_id = f"ord-min-{uuid.uuid4().hex[:8]}"
        order = Order(
            id=order_id,
            order_number=f"ORD-MIN-{uuid.uuid4().hex[:6].upper()}",
            customer_id=cust_id,
            artisan_id=art_id,
            product_id="prod-min-01",
            product_title="Dhokra Lamp",
            quantity=1,
            total_price=2500.0,
            status="paid",
            payment_status="paid",
            payment_id="pay_secret_token_razorpay_999",
            payment_provider="razorpay",
            paid_at=datetime.now(timezone.utc)
        )
        db.add(order)
        db.commit()

        cust_token = make_token(cust_id, role="customer")
        art_token = make_token(art_id, role="artisan")

        # Customer fetching order gets their own payment_id
        res_cust = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {cust_token}"})
        assert res_cust.status_code == 200
        assert res_cust.json()["payment_id"] == "pay_secret_token_razorpay_999"
        assert res_cust.json()["payment_provider"] == "razorpay"

        # Artisan fetching order gets sanitized order (payment_id stripped)
        res_art = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {art_token}"})
        assert res_art.status_code == 200
        assert res_art.json()["payment_id"] is None
        assert res_art.json()["payment_provider"] is None
        assert res_art.json()["payment_status"] == "paid"

        # Artisan listing incoming orders gets sanitized orders
        res_art_list = client.get("/api/v1/orders/artisan", headers={"Authorization": f"Bearer {art_token}"})
        assert res_art_list.status_code == 200
        for o in res_art_list.json():
            if o["id"] == order_id:
                assert o["payment_id"] is None
                assert o["payment_provider"] is None

        # Admin fetching order sees full details
        res_admin = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_admin.status_code == 200
        assert res_admin.json()["payment_id"] == "pay_secret_token_razorpay_999"

    # -------------------------------------------------------------
    # 9. Application History Isolation
    # -------------------------------------------------------------
    def test_application_history_isolation(self, client, db):
        user1_id = f"applicant-01-{uuid.uuid4().hex[:6]}"
        user2_id = f"applicant-02-{uuid.uuid4().hex[:6]}"

        app1 = ArtisanApplication(
            id=f"app-user1-{uuid.uuid4().hex[:6]}",
            user_id=user1_id,
            craft_category="Pottery",
            experience_years=4,
            status="pending"
        )
        app2 = ArtisanApplication(
            id=f"app-user2-{uuid.uuid4().hex[:6]}",
            user_id=user2_id,
            craft_category="Textiles",
            experience_years=8,
            status="approved"
        )
        db.add_all([app1, app2])
        db.commit()

        token1 = make_token(user1_id, role="customer")
        token2 = make_token(user2_id, role="customer")

        # User 1 views only their applications
        res1 = client.get("/api/v1/artisan/application/my", headers={"Authorization": f"Bearer {token1}"})
        assert res1.status_code == 200
        apps1 = res1.json()
        assert len(apps1) >= 1
        for a in apps1:
            assert a["user_id"] == user1_id
            assert a["craft_category"] == "Pottery"

        # User 2 views only their applications
        res2 = client.get("/api/v1/artisan/application/my", headers={"Authorization": f"Bearer {token2}"})
        assert res2.status_code == 200
        apps2 = res2.json()
        assert len(apps2) >= 1
        for a in apps2:
            assert a["user_id"] == user2_id
            assert a["craft_category"] == "Textiles"
