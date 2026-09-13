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
            if item.get("correction_id") == correction_id or item.get("review_id") == correction_id:
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

    def record_artisan_review_outcome(
        self,
        review_type: str,  # "CORRECT" or "WRONG"
        artisan_id: str,
        craft_type: str,
        input_data: Dict[str, Any],
        ai_product_card: Dict[str, Any],
        corrections: Optional[Dict[str, Any]] = None,
        language: str = "hi"
    ) -> Dict[str, Any]:
        """
        Implements the exact dual-path learning loop:
        Both 'Correct' and 'Wrong' artisan reviews feed the Hunardhara dataset pipeline!
        """
        review_id = f"rev_{uuid.uuid4().hex[:10]}"
        timestamp = datetime.now(timezone.utc).isoformat()

        if review_type.upper() == "CORRECT":
            # Path 1: Correct -> Positive Ground Truth Pair
            entry = {
                "review_id": review_id,
                "review_outcome": "CORRECT",
                "timestamp": timestamp,
                "artisan_id": artisan_id,
                "craft_type": craft_type,
                "input": input_data,
                "ai_product_card": ai_product_card,
                "verified_truth": ai_product_card,
                "validation_status": "artisan_verified_positive",
                "language": language,
                "model_version": version_registry.CATALOG_MODEL_VERSION
            }
            version_registry.record_feedback_event(accepted_without_edit=True)
            correct_file = os.path.join(self.FEEDBACK_DIR, "verified_correct_samples.jsonl")
            try:
                with open(correct_file, "a", encoding="utf-8") as f:
                    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            except Exception as e:
                logger.warning(f"Could not persist correct sample: {e}")

            logger.info(f"Recorded POSITIVE artisan review for {craft_type}")
            return entry

        else:
            # Path 2: Wrong -> Feedback Data Delta
            entry = {
                "review_id": review_id,
                "correction_id": review_id,
                "review_outcome": "WRONG",
                "timestamp": timestamp,
                "artisan_id": artisan_id,
                "craft_type": craft_type,
                "input": input_data,
                "original_ai_card": ai_product_card,
                "artisan_corrections": corrections or {},
                "validation_status": "pending_human_validation",
                "language": language,
                "model_version": version_registry.CATALOG_MODEL_VERSION
            }
            version_registry.record_feedback_event(accepted_without_edit=False)
            self._in_memory_pending.append(entry)
            try:
                with open(self.pending_file, "a", encoding="utf-8") as f:
                    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            except Exception as e:
                logger.warning(f"Could not persist correction sample: {e}")

            logger.info(f"Recorded CORRECTION feedback data for {craft_type}")
            return entry

    def export_finetuning_dataset(self) -> Dict[str, Any]:
        """
        Compiles the full Hunardhara Dataset (both verified correct listings
        and expert-validated corrections) into Alpaca / Unsloth ChatML format.
        """
        finetuning_file = os.path.join(self.FEEDBACK_DIR, "hunardhara_finetuning_dataset.jsonl")
        samples = []

        # 1. Load approved corrections
        if os.path.exists(self.approved_file):
            try:
                with open(self.approved_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            samples.append(json.loads(line))
            except Exception as e:
                logger.warning(f"Error reading approved file: {e}")

        # 2. Load verified correct samples
        correct_file = os.path.join(self.FEEDBACK_DIR, "verified_correct_samples.jsonl")
        if os.path.exists(correct_file):
            try:
                with open(correct_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            samples.append(json.loads(line))
            except Exception as e:
                logger.warning(f"Error reading correct file: {e}")

        # Write compiled dataset
        try:
            with open(finetuning_file, "w", encoding="utf-8") as f:
                for s in samples:
                    f.write(json.dumps(s, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.warning(f"Error compiling finetuning dataset: {e}")

        return {
            "status": "ready_for_finetuning",
            "total_curated_samples": len(samples),
            "export_filepath": finetuning_file,
            "target_model_recommendation": "Unsloth Llama-3.1-8B-Instruct (QLoRA) or Qwen-2.5-7B",
            "training_script": "training/train_colab.py"
        }

    def get_dataset_pipeline_status(self) -> Dict[str, Any]:
        """Returns the live count and status of the learning loop stages."""
        correct_count = 0
        correct_file = os.path.join(self.FEEDBACK_DIR, "verified_correct_samples.jsonl")
        if os.path.exists(correct_file):
            with open(correct_file, "r", encoding="utf-8") as f:
                correct_count = sum(1 for line in f if line.strip())

        pending_count = len(self._in_memory_pending)
        approved_count = 0
        if os.path.exists(self.approved_file):
            with open(self.approved_file, "r", encoding="utf-8") as f:
                approved_count = sum(1 for line in f if line.strip())

        return {
            "stage_1_artisan_input": "Photo + Voice Active",
            "stage_2_ai_processing": "Sarvam + Vision + LLM Orchestrated",
            "stage_3_artisan_review": {
                "correct_verified_samples": correct_count,
                "wrong_feedback_pending": pending_count,
                "expert_validated_samples": approved_count
            },
            "stage_4_hunardhara_dataset_total": correct_count + approved_count,
            "stage_5_finetuning_readiness": "Ready" if (correct_count + approved_count) >= 5 else "Collecting samples",
            "stage_6_better_ai_version": version_registry.CATALOG_MODEL_VERSION
        }


correction_feedback_service = CorrectionFeedbackService()
