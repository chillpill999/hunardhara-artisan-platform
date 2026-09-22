import os
import io
import time
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.core.storage_security import (
    generate_file_token,
    verify_file_token,
    generate_secure_filename,
    resolve_safe_storage_path,
    delete_stored_file,
    delete_user_stored_files,
    validate_uploaded_file,
)
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.craft_cluster import CraftCluster


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


def make_token(user_id: str, role: str = "artisan") -> str:
    return create_access_token(user_id, extra_claims={"app_metadata": {"role": role}})


def auth_header(user_id: str, role: str = "artisan"):
    return {"Authorization": f"Bearer {make_token(user_id, role)}"}


# 1x1 valid PNG binary fixture
VALID_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)

# 1x1 valid JPEG binary fixture
VALID_JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
    b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4"
    b"\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00"
    b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x80\xff\xd9"
)

# Valid WAV audio binary fixture
VALID_WAV_BYTES = (
    b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
    b"\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
)


class TestStorageSecurityCore:
    """Core file validation, filename generation, and path traversal defenses."""

    def test_magic_byte_validation_valid_image(self):
        """TC-STORAGE-01: Valid image magic bytes pass verification."""
        ext = validate_uploaded_file(VALID_PNG_BYTES, "test.png", expected_type="image")
        assert ext == ".png"

        ext_jpg = validate_uploaded_file(VALID_JPEG_BYTES, "test.jpg", expected_type="image")
        assert ext_jpg == ".jpg"

    def test_magic_byte_validation_valid_audio(self):
        """TC-STORAGE-02: Valid audio magic bytes pass verification."""
        ext = validate_uploaded_file(VALID_WAV_BYTES, "voice.wav", expected_type="audio")
        assert ext == ".wav"

    def test_magic_byte_validation_rejects_disguised_file(self):
        """TC-STORAGE-03: PHP script disguised as JPEG is rejected by magic byte check."""
        fake_jpg = b"<?php echo 'malicious payload'; ?>"
        with pytest.raises(Exception) as exc_info:
            validate_uploaded_file(fake_jpg, "malicious.jpg", expected_type="image")
        assert "INVALID_FILE_SIGNATURE" in str(exc_info.value)

    def test_disallowed_script_extensions_rejected(self):
        """TC-STORAGE-04: Script and executable extensions are blocked."""
        disallowed = ["test.exe", "test.sh", "test.py", "test.svg", "test.html", "test.php", "test.js"]
        for fn in disallowed:
            with pytest.raises(Exception) as exc:
                validate_uploaded_file(VALID_PNG_BYTES, fn, expected_type="image")
            assert ("DISALLOWED_FILE_TYPE" in str(exc.value) or "UNSUPPORTED_IMAGE_FORMAT" in str(exc.value))

    def test_double_extension_evasion_blocked(self):
        """TC-STORAGE-05: Double extension attacks (e.g. test.php.jpg) are blocked."""
        with pytest.raises(Exception) as exc:
            validate_uploaded_file(VALID_PNG_BYTES, "exploit.php.png", expected_type="image")
        assert "DISALLOWED_FILE_TYPE" in str(exc.value)

    def test_oversized_payload_rejected(self):
        """TC-STORAGE-06: Payloads exceeding max size limit raise HTTP 413."""
        huge_data = b"0" * (16 * 1024 * 1024)  # 16 MB
        with pytest.raises(Exception) as exc:
            validate_uploaded_file(huge_data, "large.png", expected_type="image", max_size_mb=15)
        assert exc.value.status_code == 413

    def test_empty_or_tiny_file_rejected(self):
        """TC-STORAGE-07: Zero-length or sub-header binary data is rejected."""
        with pytest.raises(Exception) as exc:
            validate_uploaded_file(b"tiny", "tiny.png", expected_type="image")
        assert exc.value.status_code == 400

    def test_path_traversal_in_filename_rejected(self):
        """TC-STORAGE-08: Path traversal attempts in filename are rejected."""
        traversal_names = ["../../etc/passwd.jpg", "..\\windows\\system32.png", "/var/log/secret.jpg"]
        for fn in traversal_names:
            with pytest.raises(Exception) as exc:
                validate_uploaded_file(VALID_PNG_BYTES, fn, expected_type="image")
            assert "PATH_TRAVERSAL_DETECTED" in str(exc.value)

    def test_resolve_safe_storage_path_prevents_escape(self):
        """TC-STORAGE-09: resolve_safe_storage_path rejects paths attempting directory breakout."""
        with pytest.raises(Exception):
            resolve_safe_storage_path("uploads", "../../../config.py")

        with pytest.raises(Exception):
            resolve_safe_storage_path("invalid_cat", "test.jpg")

    def test_generate_secure_filename_discards_client_filename(self):
        """TC-STORAGE-10: Server generates unguessable filename discarding client input."""
        fname = generate_secure_filename("artisan-user-123", ".png", prefix="prod")
        assert "artisan-user-123" not in fname  # Hashed
        assert fname.startswith("prod_")
        assert fname.endswith(".png")
        assert len(fname) > 20


class TestStorageEndpoints:
    """HTTP API storage endpoints tests (Upload, Download, Ownership, Signed URLs)."""

    def test_anonymous_upload_rejected(self, client):
        """TC-STORAGE-11: Uploading without authentication returns HTTP 401."""
        res = client.post(
            "/api/v1/storage/upload",
            files={"file": ("photo.png", VALID_PNG_BYTES, "image/png")},
            data={"category": "uploads"}
        )
        assert res.status_code == 401

    def test_authenticated_artisan_upload_success(self, client):
        """TC-STORAGE-12: Authenticated artisan uploads valid image and gets secure URL + signed token."""
        user_id = "artisan-storage-01"
        res = client.post(
            "/api/v1/storage/upload",
            files={"file": ("my_craft.png", VALID_PNG_BYTES, "image/png")},
            data={"category": "uploads"},
            headers=auth_header(user_id, "artisan")
        )
        assert res.status_code == 200
        data = res.json()
        assert "storage_path" in data
        assert "signed_url" in data
        assert "token" in data
        assert "my_craft.png" not in data["filename"]  # Client name discarded

        # Cleanup uploaded file
        delete_stored_file(data["storage_path"])

    def test_anonymous_download_without_token_rejected(self, client):
        """TC-STORAGE-13: Downloading stored file without auth or token returns HTTP 401."""
        res = client.get("/api/v1/storage/files/uploads/test_file.png")
        assert res.status_code == 401

    def test_cross_artisan_access_forbidden(self, client):
        """TC-STORAGE-14: Artisan B cannot access Artisan A's private stored file."""
        # 1. Artisan A uploads
        artisan_a = "artisan-alice"
        upload_res = client.post(
            "/api/v1/storage/upload",
            files={"file": ("alice_doc.png", VALID_PNG_BYTES, "image/png")},
            data={"category": "uploads"},
            headers=auth_header(artisan_a, "artisan")
        )
        assert upload_res.status_code == 200
        filename = upload_res.json()["filename"]

        try:
            # 2. Artisan B attempts to download Artisan A's file
            artisan_b = "artisan-bob"
            get_res = client.get(
                f"/api/v1/storage/files/uploads/{filename}",
                headers=auth_header(artisan_b, "artisan")
            )
            assert get_res.status_code == 403
            assert "FORBIDDEN_OWNERSHIP" in get_res.json()["detail"]

            # 3. Artisan A downloads own file successfully
            owner_res = client.get(
                f"/api/v1/storage/files/uploads/{filename}",
                headers=auth_header(artisan_a, "artisan")
            )
            assert owner_res.status_code == 200
            assert owner_res.content == VALID_PNG_BYTES
            assert owner_res.headers.get("X-Content-Type-Options") == "nosniff"

            # 4. Admin downloads Artisan A's file successfully
            admin_res = client.get(
                f"/api/v1/storage/files/uploads/{filename}",
                headers=auth_header("admin-001", "admin")
            )
            assert admin_res.status_code == 200
        finally:
            delete_stored_file(f"/api/v1/storage/files/uploads/{filename}")

    def test_signed_token_access_without_bearer_auth(self, client):
        """TC-STORAGE-15: Downloading with a valid HMAC signed token succeeds without Bearer header."""
        user_id = "artisan-signed-01"
        upload_res = client.post(
            "/api/v1/storage/upload",
            files={"file": ("sample.png", VALID_PNG_BYTES, "image/png")},
            data={"category": "uploads"},
            headers=auth_header(user_id, "artisan")
        )
        assert upload_res.status_code == 200
        filename = upload_res.json()["filename"]
        token = upload_res.json()["token"]

        try:
            # Download with valid signed token
            token_res = client.get(f"/api/v1/storage/files/uploads/{filename}?token={token}")
            assert token_res.status_code == 200
            assert token_res.content == VALID_PNG_BYTES

            # Download with tampered token is rejected
            tampered_token = token[:-5] + "XXXXX"
            tampered_res = client.get(f"/api/v1/storage/files/uploads/{filename}?token={tampered_token}")
            assert tampered_res.status_code == 403
        finally:
            delete_stored_file(f"/api/v1/storage/files/uploads/{filename}")

    def test_file_deletion_enforces_ownership(self, client):
        """TC-STORAGE-16: Only owner or admin can DELETE a stored file."""
        artisan_a = "artisan-owner"
        upload_res = client.post(
            "/api/v1/storage/upload",
            files={"file": ("to_delete.png", VALID_PNG_BYTES, "image/png")},
            data={"category": "uploads"},
            headers=auth_header(artisan_a, "artisan")
        )
        assert upload_res.status_code == 200
        filename = upload_res.json()["filename"]

        # Artisan B attempts deletion -> 403
        del_b = client.delete(
            f"/api/v1/storage/files/uploads/{filename}",
            headers=auth_header("artisan-attacker", "artisan")
        )
        assert del_b.status_code == 403

        # Artisan A deletes own file -> 200
        del_a = client.delete(
            f"/api/v1/storage/files/uploads/{filename}",
            headers=auth_header(artisan_a, "artisan")
        )
        assert del_a.status_code == 200
        assert del_a.json()["status"] == "deleted"

        # Verify file is gone
        get_res = client.get(
            f"/api/v1/storage/files/uploads/{filename}",
            headers=auth_header(artisan_a, "artisan")
        )
        assert get_res.status_code == 404


class TestStaticRouteSecurity:
    """Verification that public /static cannot be abused to access private uploads or run scripts."""

    def test_static_blocks_private_directories(self, client):
        """TC-STORAGE-17: /static/profiles, /static/uploads, /static/audio are blocked."""
        private_static_paths = [
            "/static/profiles/secret.jpg",
            "/static/uploads/document.png",
            "/static/audio/private_recording.wav",
            "/static/internal/keys.txt"
        ]
        for p in private_static_paths:
            res = client.get(p)
            assert res.status_code in (403, 404)

    def test_static_blocks_executable_and_script_files(self, client):
        """TC-STORAGE-18: /static blocks .php, .py, .sh, .exe, .svg files."""
        disallowed_paths = [
            "/static/test.php",
            "/static/script.py",
            "/static/exploit.sh",
            "/static/binary.exe",
            "/static/xss.svg"
        ]
        for p in disallowed_paths:
            res = client.get(p)
            assert res.status_code in (403, 404)


class TestDataErasureAndUnlinking:
    """Verifies that deleting products and DPDP right-to-be-forgotten purges stored files."""

    def test_product_deletion_unlinks_product_files(self, client, db):
        """TC-STORAGE-19: DELETE /products/{id} deletes linked storage files from disk."""
        # 1. Create artisan
        artisan = db.query(Artisan).filter(Artisan.is_active == True).first()
        if not artisan:
            artisan = Artisan(
                id="art-del-prod-01",
                full_name="Product Deletion Artisan",
                phone_number="9876543210",
                masked_aadhaar="XXXXXXXX1234",
                aadhaar_hash="dummy_hash_1234",
                cluster_id="cluster-channapatna-01",
                district="Ramanagara",
                state="Karnataka",
                latitude=12.65,
                longitude=77.20,
                primary_craft="Woodcraft"
            )
            db.add(artisan)
            db.commit()

        # 2. Upload image
        upload_res = client.post(
            "/api/v1/storage/upload",
            files={"file": ("product.jpg", VALID_JPEG_BYTES, "image/jpeg")},
            data={"category": "uploads"},
            headers=auth_header(artisan.id, "artisan")
        )
        assert upload_res.status_code == 200
        image_url = upload_res.json()["storage_path"]
        filename = upload_res.json()["filename"]
        disk_path = resolve_safe_storage_path("uploads", filename)
        assert os.path.exists(disk_path)

        # 3. Create product referencing image
        prod = Product(
            id="prod-del-test-01",
            artisan_id=artisan.id,
            cluster_id=artisan.cluster_id,
            title="Test Deletion Item",
            craft_type="Woodcraft",
            technique="Carving",
            floor_price=400.0,
            recommended_retail_price=600.0,
            wholesale_b2b_price=500.0,
            listing_price=500.0,
            stock_quantity=10,
            studio_image_url=image_url
        )
        db.add(prod)
        db.commit()

        # 4. Delete product
        del_res = client.delete(
            f"/api/v1/products/{prod.id}",
            headers=auth_header(artisan.id, "artisan")
        )
        assert del_res.status_code == 200

        # 5. Verify file was unlinked from disk
        assert not os.path.exists(disk_path)

    def test_dpdp_right_to_be_forgotten_purges_user_files(self, client, db):
        """TC-STORAGE-20: DPDP data erasure unlinks profile, product, and all user storage files."""
        artisan_id = "art-dpdp-erasure-99"
        artisan = Artisan(
            id=artisan_id,
            full_name="Erasure Subject",
            phone_number="9111222333",
            masked_aadhaar="XXXXXXXX9999",
            aadhaar_hash="dummy_hash_9999",
            cluster_id="cluster-varanasi-01",
            district="Varanasi",
            state="Uttar Pradesh",
            latitude=25.31,
            longitude=82.97,
            primary_craft="Silk Weaving"
        )
        db.add(artisan)
        db.commit()

        # Upload profile photo to storage
        upload_res = client.post(
            "/api/v1/storage/upload",
            files={"file": ("avatar.png", VALID_PNG_BYTES, "image/png")},
            data={"category": "profiles"},
            headers=auth_header(artisan_id, "artisan")
        )
        assert upload_res.status_code == 200
        profile_fn = upload_res.json()["filename"]
        profile_path = resolve_safe_storage_path("profiles", profile_fn)
        assert os.path.exists(profile_path)

        artisan.profile_photo_url = upload_res.json()["storage_path"]
        db.commit()

        # Trigger DPDP forget
        forget_res = client.post(
            "/api/v1/compliance/forget",
            json={"artisan_id": artisan_id, "confirmation": True},
            headers=auth_header(artisan_id, "artisan")
        )
        assert forget_res.status_code == 200

        # Verify disk file is unlinked
        assert not os.path.exists(profile_path)

    def test_dpdp_right_to_be_forgotten_purges_studio_files(self, client, db):
        """TC-STORAGE-21: DPDP sovereign erasure removes studio output and preview files containing owner hash."""
        import hashlib
        artisan_id = "art-dpdp-studio-user-77"
        owner_hash = hashlib.sha256(artisan_id.encode("utf-8")).hexdigest()[:8]

        artisan = Artisan(
            id=artisan_id,
            full_name="Studio Erasure Artisan",
            phone_number="9111222444",
            masked_aadhaar="XXXXXXXX7777",
            aadhaar_hash="dummy_hash_7777",
            cluster_id="cluster-varanasi-01",
            district="Varanasi",
            state="Uttar Pradesh",
            latitude=25.31,
            longitude=82.97,
            primary_craft="Silk Weaving"
        )
        db.add(artisan)
        db.commit()

        # Create dummy studio files in static/studio/
        studio_dir = os.path.join(settings.STATIC_DIR, "studio")
        os.makedirs(studio_dir, exist_ok=True)
        img_fn = f"studio_{owner_hash}_test1234.jpg"
        prev_fn = f"studio_{owner_hash}_test1234_preview.jpg"
        img_path = os.path.join(studio_dir, img_fn)
        prev_path = os.path.join(studio_dir, prev_fn)

        with open(img_path, "wb") as f:
            f.write(VALID_JPEG_BYTES)
        with open(prev_path, "wb") as f:
            f.write(VALID_JPEG_BYTES)

        assert os.path.exists(img_path)
        assert os.path.exists(prev_path)

        # Trigger DPDP forget
        forget_res = client.post(
            "/api/v1/compliance/forget",
            json={"artisan_id": artisan_id, "confirmation": True},
            headers=auth_header(artisan_id, "artisan")
        )
        assert forget_res.status_code == 200

        # Both studio files must be completely erased
        assert not os.path.exists(img_path)
        assert not os.path.exists(prev_path)

    def test_create_product_rejects_foreign_storage_file(self, client, db):
        """TC-STORAGE-22: Product creation rejects attaching media URLs belonging to another artisan."""
        import hashlib
        victim_id = "art-victim-01"
        attacker_id = "art-attacker-02"
        victim_hash = hashlib.sha256(victim_id.encode("utf-8")).hexdigest()[:8]

        # Ensure cluster exists in DB
        cluster = db.query(CraftCluster).filter(CraftCluster.id == "cluster-varanasi-01").first()
        if not cluster:
            cluster = CraftCluster(
                id="cluster-varanasi-01",
                name="Varanasi Silk Weaving Cluster",
                craft_name="Silk Weaving",
                state="Uttar Pradesh",
                district="Varanasi",
                latitude=25.31,
                longitude=82.97,
                statutory_hourly_wage=80.0,
                statutory_daily_wage=640.0,
                gi_tag_status="Registered (GI-28)"
            )
            db.add(cluster)
            db.commit()

        # Onboard attacker
        attacker = Artisan(
            id=attacker_id,
            full_name="Attacker Artisan",
            phone_number="9111333555",
            masked_aadhaar="XXXXXXXX8888",
            aadhaar_hash="dummy_hash_8888",
            cluster_id="cluster-varanasi-01",
            district="Varanasi",
            state="Uttar Pradesh",
            latitude=25.31,
            longitude=82.97,
            primary_craft="Silk Weaving"
        )
        db.add(attacker)
        db.commit()

        # Foreign URL referencing victim's private file
        foreign_url = f"/storage/files/uploads/prod_{victim_hash}_private_craft.png"

        product_payload = {
            "artisan_id": attacker_id,
            "title": "Malicious Hijack Product",
            "craft_type": "Silk Weaving",
            "cluster_id": "cluster-varanasi-01",
            "technique": "Pit Loom",
            "materials": ["Silk"],
            "dimensions": {"length": 100.0, "width": 100.0, "height": 1.0, "unit": "cm"},
            "cost_materials": 500.0,
            "labor_hours": 10.0,
            "listing_price": 2500.0,
            "stock_quantity": 5,
            "raw_photo_url": foreign_url
        }

        res = client.post(
            "/api/v1/products",
            json=product_payload,
            headers=auth_header(attacker_id, "artisan")
        )
        assert res.status_code == 403
        assert "FORBIDDEN_FILE_ACCESS" in res.json()["detail"]

    def test_delete_stored_file_rejects_unauthorized_owner(self):
        """TC-STORAGE-23: delete_stored_file rejects unlinking when owner_id mismatches file hash."""
        import hashlib
        owner_id = "legit-owner-999"
        owner_hash = hashlib.sha256(owner_id.encode("utf-8")).hexdigest()[:8]
        uploads_dir = os.path.join(settings.STORAGE_DIR, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        fname = f"prod_{owner_hash}_important.png"
        filepath = os.path.join(uploads_dir, fname)

        with open(filepath, "wb") as f:
            f.write(VALID_PNG_BYTES)

        assert os.path.exists(filepath)

        # Attacker tries to delete legitimate owner's file
        deleted = delete_stored_file(f"/storage/files/uploads/{fname}", owner_id="malicious-user-000")
        assert deleted is False
        assert os.path.exists(filepath)  # Must remain untouched

        # Legit owner successfully deletes
        deleted_legit = delete_stored_file(f"/storage/files/uploads/{fname}", owner_id=owner_id)
        assert deleted_legit is True
        assert not os.path.exists(filepath)

    def test_delete_stored_file_protects_static_benchmarks(self):
        """TC-STORAGE-24: delete_stored_file refuses to delete static assets outside studio directory."""
        benchmarks_dir = os.path.join(settings.STATIC_DIR, "benchmarks")
        os.makedirs(benchmarks_dir, exist_ok=True)
        bench_file = os.path.join(benchmarks_dir, "test_benchmark_guard.txt")

        with open(bench_file, "w", encoding="utf-8") as f:
            f.write("System Benchmark Asset")

        assert os.path.exists(bench_file)

        # Attempt to delete static benchmark
        res = delete_stored_file("/static/benchmarks/test_benchmark_guard.txt", owner_id="anyone")
        assert res is False
        assert os.path.exists(bench_file)

        # Clean up test benchmark file
        os.remove(bench_file)

