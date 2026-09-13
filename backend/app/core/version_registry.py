"""
Hunardhara AI Version Registry & Telemetry Tracking
Tracks model identifiers, prompt versions, dataset revisions, and privacy-safe observability.
"""

import time
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger("artisan_platform.ai_version_registry")


class AIVersionRegistry:
    """Central registry tracking active AI component versions and operational telemetry."""

    # Active Production Versions
    CATALOG_MODEL_VERSION = "hunardhara-catalog-v1 (OpenRouter Gemma 4 31B Multimodal)"
    VISION_MODEL_VERSION = "hunardhara-vision-v1 (Gemma 4 31B / Qwen2.5-VL / Cloudflare Llama 3.2)"
    VOICE_MODEL_VERSION = "hunardhara-voice-v1 (Sarvam Saaras Indic ASR + Bulbul TTS)"
    PRICING_MODEL_VERSION = "hunardhara-pricing-v1 (Cost-Plus Statutory Wage Baseline)"
    DATASET_VERSION = "hunardhara-dataset-v1.2 (hunardhara_gold benchmark)"
    PROMPT_VERSION = "catalog-prompt-v3 (Dignified Artisan Commerce Style)"
    RAG_KB_VERSION = "rag-craft-knowledge-v1.0 (Ministry of Textiles & GI Registry)"

    def __init__(self):
        self._telemetry_records: List[Dict[str, Any]] = []
        self._metrics = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_tokens_used": 0,
            "total_latency_ms": 0.0,
            "hallucination_flags_caught": 0,
            "artisan_corrections_received": 0,
            "catalog_acceptances": 0,
        }

    def get_version_manifest(self) -> Dict[str, str]:
        """Returns the active AI component version manifest."""
        return {
            "catalog_model": self.CATALOG_MODEL_VERSION,
            "vision_model": self.VISION_MODEL_VERSION,
            "voice_model": self.VOICE_MODEL_VERSION,
            "pricing_model": self.PRICING_MODEL_VERSION,
            "dataset_version": self.DATASET_VERSION,
            "prompt_version": self.PROMPT_VERSION,
            "rag_knowledge_version": self.RAG_KB_VERSION,
        }

    def log_inference_event(
        self,
        request_type: str,
        model_name: str,
        latency_ms: float,
        success: bool,
        tokens_used: int = 0,
        confidence_avg: float = 0.9,
        flags: Optional[List[str]] = None,
        error_msg: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Safely records an AI telemetry event without logging PII (no phone, email, or IDs).
        """
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_type": request_type,
            "model": model_name,
            "latency_ms": round(latency_ms, 2),
            "success": success,
            "tokens_used": tokens_used,
            "confidence_avg": round(confidence_avg, 3),
            "flags": flags or [],
            "error": error_msg[:100] if error_msg else None,
            "prompt_version": self.PROMPT_VERSION,
        }

        # Update running aggregates
        self._metrics["total_requests"] += 1
        if success:
            self._metrics["successful_requests"] += 1
        else:
            self._metrics["failed_requests"] += 1

        self._metrics["total_tokens_used"] += tokens_used
        self._metrics["total_latency_ms"] += latency_ms

        if flags and any("unverified" in f.lower() or "hallucination" in f.lower() for f in flags):
            self._metrics["hallucination_flags_caught"] += 1

        # Keep rolling window of last 200 events in memory
        self._telemetry_records.append(event)
        if len(self._telemetry_records) > 200:
            self._telemetry_records.pop(0)

        logger.info(
            f"AI Telemetry: [{request_type}] {model_name} | {latency_ms:.1f}ms | "
            f"Success={success} | Tokens={tokens_used} | Flags={len(flags or [])}"
        )
        return event

    def record_feedback_event(self, accepted_without_edit: bool):
        """Records whether the artisan accepted the catalog draft without major edit."""
        if accepted_without_edit:
            self._metrics["catalog_acceptances"] += 1
        else:
            self._metrics["artisan_corrections_received"] += 1

    def get_observability_dashboard(self) -> Dict[str, Any]:
        """Calculates operational health and accuracy metrics."""
        total = self._metrics["total_requests"]
        avg_latency = (
            round(self._metrics["total_latency_ms"] / total, 2) if total > 0 else 0.0
        )
        success_rate = (
            round((self._metrics["successful_requests"] / total) * 100.0, 2)
            if total > 0
            else 100.0
        )
        total_feedback = (
            self._metrics["catalog_acceptances"] + self._metrics["artisan_corrections_received"]
        )
        acceptance_rate = (
            round((self._metrics["catalog_acceptances"] / total_feedback) * 100.0, 2)
            if total_feedback > 0
            else 100.0
        )

        return {
            "status": "healthy",
            "active_versions": self.get_version_manifest(),
            "metrics": {
                "total_requests": total,
                "success_rate_pct": success_rate,
                "average_latency_ms": avg_latency,
                "total_tokens_consumed": self._metrics["total_tokens_used"],
                "estimated_cost_usd": round(self._metrics["total_tokens_used"] * 0.0000002, 4),
                "hallucination_flags_prevented": self._metrics["hallucination_flags_caught"],
                "catalog_acceptance_rate_pct": acceptance_rate,
                "artisan_corrections_logged": self._metrics["artisan_corrections_received"],
            },
            "recent_events": self._telemetry_records[-10:],
        }


# Singleton registry instance
version_registry = AIVersionRegistry()
