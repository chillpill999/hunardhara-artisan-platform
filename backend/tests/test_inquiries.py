import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.inquiry import ArtisanInquiry
from app.models.artisan import Artisan
from app.models.craft_cluster import CraftCluster


@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def test_artisan_token(db):
    artisan_id = "art-inq-test-001"
    cluster = db.query(CraftCluster).first()
    cluster_id = cluster.id if cluster else "cluster-varanasi-silk"

    if not db.query(Artisan).filter(Artisan.id == artisan_id).first():
        db.add(Artisan(
            id=artisan_id,
            full_name="Varanasi Master Weaver",
            phone_number="+919876543299",
            masked_aadhaar="XXXXXXXX9999",
            aadhaar_hash="sha256-inq-test-aadhaar",
            social_category="OBC",
            cluster_id=cluster_id,
            state="Uttar Pradesh",
            district="Varanasi",
            latitude=25.3176,
            longitude=82.9739,
            primary_craft="Varanasi Silk",
            is_active=True
        ))
        db.commit()

    token = create_access_token(
        artisan_id,
        extra_claims={
            "app_metadata": {"role": "artisan"},
            "email": "weaver@varanasi.gov.in"
        }
    )
    return token, artisan_id


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_inquiry_lifecycle_full(client, test_artisan_token, db):
    token, artisan_id = test_artisan_token
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Customer creates an inquiry
    inquiry_payload = {
        "product_id": "prod-silk-saree-01",
        "product_title": "Pure Katan Silk Brocade Saree",
        "product_image": "https://example.com/saree.jpg",
        "artisan_id": artisan_id,
        "artisan_name": "Varanasi Master Weaver",
        "customer_name": "Pooja Verma",
        "customer_phone": "+919811223344",
        "customer_email": "pooja@example.com",
        "inquiry_type": "customization",
        "message": "Can this be woven in royal emerald green with silver zari?",
        "quantity": 2
    }

    create_res = client.post("/api/v1/inquiries", json=inquiry_payload)
    assert create_res.status_code == 201
    inquiry_data = create_res.json()
    inquiry_id = inquiry_data["id"]
    assert inquiry_data["status"] == "new"
    assert inquiry_data["customer_name"] == "Pooja Verma"
    assert inquiry_data["artisan_id"] == artisan_id

    # 2. Artisan fetches their inquiries
    list_res = client.get("/api/v1/inquiries/artisan", headers=headers)
    assert list_res.status_code == 200
    inquiries_list = list_res.json()
    assert any(i["id"] == inquiry_id for i in inquiries_list)

    # 3. Artisan updates inquiry status
    update_res = client.patch(
        f"/api/v1/inquiries/{inquiry_id}/status",
        headers=headers,
        json={"status": "replied"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "replied"

    # 4. Artisan deletes inquiry
    del_res = client.delete(f"/api/v1/inquiries/{inquiry_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 5. Verify deleted from database
    db_check = db.query(ArtisanInquiry).filter(ArtisanInquiry.id == inquiry_id).first()
    assert db_check is None
