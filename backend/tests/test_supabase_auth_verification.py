import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.security import (
    _auth_configured,
    _require_auth_configuration,
    decode_access_token,
    create_access_token,
    _TOKEN_CACHE,
)


class TestSupabaseAuthVerification:
    """Validates resilient Supabase authentication without requiring manual secret configuration."""

    def test_auth_configured_true_with_supabase_url_and_anon_key(self, monkeypatch):
        """Authentication must be recognized as configured when Supabase URL and Anon Key are set."""
        monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", None)
        monkeypatch.setattr(settings, "SUPABASE_URL", "https://gqtcpbllllaewzwqcyun.supabase.co")
        monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", "test-anon-key")

        assert _auth_configured() is True
        # Should not raise 503
        _require_auth_configuration()

    def test_auth_configured_false_when_all_unset(self, monkeypatch):
        """Raises 503 only when both Supabase URL/key and secret are missing."""
        monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", None)
        monkeypatch.setattr(settings, "SUPABASE_URL", "")
        monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", "")
        monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)

        assert _auth_configured() is False
        with pytest.raises(Exception) as exc:
            _require_auth_configuration()
        assert "AUTH_CONFIGURATION_ERROR" in str(exc.value)

    def test_decode_access_token_symmetric_success(self, monkeypatch):
        """Decodes standard tokens using configured secret."""
        secret = "unit-test-secret-key-that-is-at-least-32-chars!!"
        monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", secret)

        token = create_access_token(subject="user-12345", extra_claims={"email": "artisan@hunardhara.in"})
        payload = decode_access_token(token)

        assert payload is not None
        assert payload.get("sub") == "user-12345"
        assert payload.get("email") == "artisan@hunardhara.in"

    def test_decode_access_token_in_memory_cache(self, monkeypatch):
        """Verifies that token payloads are cached in memory for sub-millisecond lookups."""
        secret = "unit-test-secret-key-that-is-at-least-32-chars!!"
        monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", secret)

        token = create_access_token(subject="user-cache-test", extra_claims={"email": "cache@hunardhara.in"})
        payload1 = decode_access_token(token)
        assert payload1 is not None

        # Verify it is in _TOKEN_CACHE
        import hashlib
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        assert token_hash in _TOKEN_CACHE

        # Second lookup hits cache
        payload2 = decode_access_token(token)
        assert payload2 == payload1

    def test_decode_access_token_via_supabase_api_fallback(self, monkeypatch):
        """Validates token via Supabase Auth API mock when JWT secret is not configured."""
        monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", None)
        monkeypatch.setattr(settings, "SUPABASE_URL", "https://gqtcpbllllaewzwqcyun.supabase.co")
        monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", "test-anon-key")

        mock_user_resp = {
            "id": "supabase-user-uuid-999",
            "email": "rural.artisan@gov.in",
            "aud": "authenticated",
            "app_metadata": {"role": "customer"},
            "user_metadata": {"full_name": "Radha Devi"}
        }

        with patch("app.core.security._verify_with_supabase_api", return_value={
            "sub": mock_user_resp["id"],
            "email": mock_user_resp["email"],
            "app_metadata": mock_user_resp["app_metadata"],
            "user_metadata": mock_user_resp["user_metadata"],
            "aud": "authenticated",
            "iss": "https://gqtcpbllllaewzwqcyun.supabase.co/auth/v1",
            "exp": 9999999999
        }):
            payload = decode_access_token("mock-supabase-remote-token")
            assert payload is not None
            assert payload["sub"] == "supabase-user-uuid-999"
            assert payload["email"] == "rural.artisan@gov.in"

    def test_artisan_apply_succeeds_without_jwt_secret_configured(self, monkeypatch):
        """Simulates an artisan submitting an application using Supabase auth with NO SUPABASE_JWT_SECRET set."""
        client = TestClient(app)

        monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", None)
        monkeypatch.setattr(settings, "SUPABASE_URL", "https://gqtcpbllllaewzwqcyun.supabase.co")
        monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", "test-anon-key")

        mock_payload = {
            "sub": "artisan-applicant-uuid-001",
            "email": "applicant@hunardhara.in",
            "app_metadata": {"role": "customer"},
            "aud": "authenticated",
            "iss": "https://gqtcpbllllaewzwqcyun.supabase.co/auth/v1",
            "exp": 9999999999
        }

        with patch("app.core.security.decode_access_token", return_value=mock_payload):
            response = client.post(
                "/api/v1/artisan/apply",
                headers={"Authorization": "Bearer valid-supabase-token-xyz"},
                json={
                    "craft_category": "Varanasi Silk",
                    "experience_years": 8,
                    "state": "Uttar Pradesh",
                    "district": "Varanasi",
                    "full_name": "Shri Ram Das",
                    "phone": "9876543210",
                    "craft_description": "Handloom brocade silk weaving in Varanasi cluster."
                }
            )

            # Must NOT be 503 AUTH_CONFIGURATION_ERROR
            assert response.status_code == 201, f"Expected 201 Created but got {response.status_code}: {response.text}"
            data = response.json()
            assert data["user_id"] == "artisan-applicant-uuid-001"
            assert data["status"] == "pending"
            assert data["craft_category"] == "Varanasi Silk"
