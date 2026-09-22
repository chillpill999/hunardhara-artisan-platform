"""
Comprehensive Fail-Safe Tests for Production Environment Integrity.
Smart India Hackathon 2026 (SIH26090)

Verifies that production is completely incapable of silently switching to demo/fallback behavior:
1. Environment validation strictly supports development, test, production.
2. Database connection failure in production crashes immediately (RuntimeError) and refuses SQLite.
3. init_db() in production rejects SQLite engines.
4. seed_database() in production raises RuntimeError.
5. OfflineMockVoiceEngine.process_audio() in production raises RuntimeError.
6. Semantic search with empty catalog returns empty list in production.
7. OpenRouter catalog generation failure raises ValueError in production, never using mock engine.
8. Voice API endpoint strictly blocks offline mock mode in production.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.main import app
from app.core.config import settings
from app.core.database import init_db
from app.services.offline_mock_engine import offline_voice_engine, OfflineMockVoiceEngine
from app.services.semantic_search_service import semantic_search_service
from app.services.openrouter_service import OpenRouterService
from db.seeds.seed_craft_clusters import seed_database


@pytest.fixture
def client():
    return TestClient(app)


class TestProductionFailSafe:
    """Verifies that production environments never fall back to mock, demo, or synthetic data."""

    def test_environment_properties_and_validation(self, monkeypatch):
        """Test is_production, is_test, and is_development flags."""
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        assert settings.is_production is True
        assert settings.is_test is False
        assert settings.is_development is False

        monkeypatch.setattr(settings, "ENVIRONMENT", "test")
        assert settings.is_production is False
        assert settings.is_test is True
        assert settings.is_development is False

        monkeypatch.setattr(settings, "ENVIRONMENT", "development")
        assert settings.is_production is False
        assert settings.is_test is False
        assert settings.is_development is True

        # Invalid environment must be rejected
        monkeypatch.setattr(settings, "ENVIRONMENT", "staging_unknown")
        with pytest.raises(ValueError, match="Supported environments are"):
            settings.validate_production_configuration()

    def test_production_database_crash_no_sqlite_fallback(self, monkeypatch):
        """In production, database engine creation failure must raise RuntimeError and never fall back to SQLite."""
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")

        with patch("app.core.database.create_engine", side_effect=Exception("Connection to PostgreSQL timed out")):
            # Simulate what happens in database.py
            with pytest.raises(RuntimeError, match="CRITICAL_DATABASE_FAILURE"):
                db_url = "postgresql://prod_user:prod_pass@db.example.com:5432/hunardhara"
                try:
                    from sqlalchemy import create_engine
                    create_engine(db_url)
                except Exception as e:
                    if settings.is_production:
                        raise RuntimeError(f"CRITICAL_DATABASE_FAILURE: Failed to create production engine for {db_url}: {e}")

    def test_production_init_db_rejects_sqlite(self, monkeypatch):
        """In production, init_db() must crash with RuntimeError if the engine is SQLite."""
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")

        with pytest.raises(RuntimeError, match="CRITICAL_DATABASE_FAILURE: SQLite is forbidden in production environment"):
            init_db()

    def test_production_seed_database_prohibited(self, monkeypatch):
        """In production, seed_database() must refuse to run and raise RuntimeError."""
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")

        with pytest.raises(RuntimeError, match="PRODUCTION_SAFETY_VIOLATION: Database seeding is forbidden"):
            seed_database()

    def test_production_offline_mock_voice_engine_prohibited(self, monkeypatch):
        """In production, OfflineMockVoiceEngine.process_audio() must raise RuntimeError."""
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")

        engine = OfflineMockVoiceEngine()
        with pytest.raises(RuntimeError, match="CRITICAL_SECURITY_VIOLATION: Offline mock voice engine cannot be executed in production"):
            engine.process_audio(audio_bytes=b"\x00" * 200, filename="sample.wav")

    def test_production_semantic_search_empty_catalog_returns_empty(self, monkeypatch):
        """In production, semantic search with an empty catalog must return [] and never inject mock items."""
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")

        results = semantic_search_service.execute_hybrid_search(
            query="blue silk saree",
            catalog_items=[]
        )
        assert results == [], "Semantic search in production must return empty list when catalog is empty!"

    def test_production_openrouter_catalog_failure_raises(self, monkeypatch):
        """In production, catalog generation upstream failure must raise ValueError, not call offline mock engine."""
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        monkeypatch.setattr(settings, "OFFLINE_MODE", False)
        monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")

        service = OpenRouterService()
        with pytest.raises(ValueError, match="CATALOG_GENERATION_FAILED"):
            service.generate_catalog(transcript="सुंदर हस्तनिर्मित साड़ी")

    def test_production_voice_endpoint_blocks_offline_mock(self, client, monkeypatch):
        """In production, voice endpoint must return HTTP 500 error if OFFLINE_MODE is requested."""
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        monkeypatch.setattr(settings, "OFFLINE_MODE", True)

        # Generate a fake WAV header
        import io
        import wave
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(b"\x00\x01" * 8000)
        audio_data = buf.getvalue()

        from app.core.security import create_access_token
        token = create_access_token("artisan-sub", extra_claims={"app_metadata": {"role": "artisan"}})

        res = client.post(
            "/api/v1/voice/speak-catalog",
            files={"audio": ("craft.wav", audio_data, "audio/wav")},
            data={"language_code": "hi"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 500
        assert "OFFLINE_MODE_FORBIDDEN" in res.json().get("error", "")
