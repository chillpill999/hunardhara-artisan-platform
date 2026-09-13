"""
Hunardhara Artisan Feedback & Continuous Improvement Engine
Captures artisan corrections to AI predictions, stages them in a pending queue,
and enables expert validation prior to dataset inclusion and model fine-tuning.
"""

import os
import json
import uuid
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.core.version_registry import version_registry

logger = logging.getLogger("artisan_platform.correction_feedback")


class CorrectionFeedbackService:
    """Manages the lifecycle of artisan corrections to AI output."""

    FEEDBACK_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "training", "feedback")

    def __init__(self):
        os.makedirs(self.FEEDBACK_DIR, exist_ok=True)
        self.pending_file = os.path.join(self.FEEDBACK_DIR, "pending_corrections.jsonl")
        self.approved_file = os.path.join(self.FEEDBACK_DIR, "approved_training_samples.jsonl")
        self._in_memory_pending: List[Dict[str, Any]] = []

    def record_artisan_correction(
        self,
        artisan_id: str,
        craft_type: str,
        field_name: str,
        ai_prediction: Any,
        artisan_correction: Any,
        language: str = "hi",
        confidence: float = 0.85,
        user_role: str = "artisan"
    ) -> Dict[str, Any]:
        """
        Module 13: Stages an artisan correction for validation.
        Does NOT automatically train on every correction to avoid data poisoning.
        """
        correction_entry = {
            "correction_id": f"corr_{uuid.uuid4().hex[:10]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "artisan_id": artisan_id,
            "craft_type": craft_type,
            "field_name": field_name,
            "ai_prediction": ai_prediction,
            "artisan_correction": artisan_correction,
            "language": language,
            "model_confidence": round(confidence, 3),
            "user_role": user_role,
            "status": "pending_validation",
            "active_model": version_registry.CATALOG_MODEL_VERSION,
            "prompt_version": version_registry.PROMPT_VERSION,
        }

        # Log event into version registry observability
        version_registry.record_feedback_event(accepted_without_edit=False)

        self._in_memory_pending.append(correction_entry)

        # Append to persistent pending ledger
        try:
            with open(self.pending_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(correction_entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.warning(f"Could not persist feedback to file: {e}")

        logger.info(f"Recorded artisan correction [{field_name}]: '{ai_prediction}' -> '{artisan_correction}'")
        return correction_entry

    def list_pending_corrections(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns pending artisan corrections requiring expert verification."""
        return self._in_memory_pending[-limit:]

    def approve_correction(
        self,
        correction_id: str,
        reviewer_id: str = "expert-curator-01",
        notes: str = "Verified authentic artisan craft term"
    ) -> Optional[Dict[str, Any]]:
        """
        Expert validation step before moving to approved training dataset.
        """
        for item in self._in_memory_pending:
            if item["correction_id"] == correction_id:
                item["status"] = "approved"
                item["reviewed_by"] = reviewer_id
                item["review_timestamp"] = datetime.now(timezone.utc).isoformat()
                item["notes"] = notes

                # Save to approved training set
                try:
                    with open(self.approved_file, "a", encoding="utf-8") as f:
                        f.write(json.dumps(item, ensure_ascii=False) + "\n")
                except Exception as e:
                    logger.warning(f"Could not persist approved sample: {e}")

                logger.info(f"Approved correction {correction_id} for dataset inclusion.")
                return item

        return None


correction_feedback_service = CorrectionFeedbackService()
