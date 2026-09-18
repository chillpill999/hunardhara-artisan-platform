"""
Hunardhara AI Gateway & Commerce Assistant Endpoints
FastAPI Router exposing the multi-module AI Commerce Assistant, RAG lookup,
semantic search, feedback loop, and observability telemetry.
"""

from typing import Dict, Any, Optional, Literal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from app.services.ai_orchestrator import ai_orchestrator
from app.schemas.artisan_commerce import HunardharaCatalogOutput
from app.services.sarvam_service import sarvam_service
from app.services.semantic_search_service import semantic_search_service
from app.services.correction_feedback_service import correction_feedback_service
from app.core.version_registry import version_registry
from app.core.security import CurrentUser, require_admin, require_artisan, RateLimiter

router = APIRouter(prefix="/ai/assistant", tags=["Hunardhara AI Commerce Assistant"])


class OrchestrateRequest(BaseModel):
    raw_input: str = Field(..., description="Artisan voice transcript or text description", example="यह बस्तर का पारंपरिक ढोकरा पीतल का घोड़ा है जो चार दिन में लॉस्ट वैक्स तकनीक से बना है।")
    image_base64: Optional[str] = Field(None, description="Optional raw or base64 craft photo")
    region: Optional[str] = Field(None, description="Craft cluster district or state")
    language: str = Field("hi", description="Artisan language preference")


class VoiceUnderstandRequest(BaseModel):
    text: str = Field(..., description="Colloquial spoken text to normalize")
    language_code: str = Field("hi-IN", description="Language code")


class FeedbackRequest(BaseModel):
    craft_type: str = Field(..., description="Craft category")
    field_name: str = Field(..., description="Attribute field modified (e.g. 'material', 'production_time_days')")
    ai_prediction: Any = Field(..., description="Original value predicted by AI")
    artisan_correction: Any = Field(..., description="Corrected value provided by artisan")
    language: str = Field("hi", description="Language used")
    confidence: float = Field(0.85, description="Model confidence score")


class SearchQueryRequest(BaseModel):
    query: str = Field(..., description="Natural language search query", example="I want a handmade blue cotton saree under 1500")


@router.post(
    "/orchestrate",
    response_model=HunardharaCatalogOutput,
    dependencies=[Depends(RateLimiter(max_requests=10, window_seconds=60, prefix="ai_orchestrate"))]
)
def orchestrate_artisan_listing(
    req: OrchestrateRequest,
    current_user: CurrentUser = Depends(require_artisan),
):
    """
    Primary AI Gateway Endpoint:
    Transforms rough artisan spoken/text input + photo into a truthful, dignified, market-ready listing.
    """
    try:
        return ai_orchestrator.orchestrate_listing_pipeline(
            raw_text_or_transcript=req.raw_input,
            image_base64=req.image_base64,
            artisan_id=current_user.id,
            stated_region=req.region,
            language=req.language
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI orchestration failed: {str(e)}")


@router.post("/voice-understand")
def understand_and_normalize_voice(
    req: VoiceUnderstandRequest,
    current_user: CurrentUser = Depends(require_artisan),
):
    """
    Module A: Normalizes code-mixed Indian speech, traditional units, and colloquial numbers.
    """
    normalized = sarvam_service.normalize_codemixed_speech(req.text)
    return {
        "status": "success",
        "original_text": req.text,
        "normalized_text": normalized
    }


@router.post("/feedback")
def submit_artisan_correction(
    req: FeedbackRequest,
    current_user: CurrentUser = Depends(require_artisan),
):
    """
    Module 13: Submits an artisan correction to the pending human-in-the-loop review queue.
    Prevents model hallucination and creates curated data for future fine-tuning.
    """
    record = correction_feedback_service.record_artisan_correction(
        artisan_id=current_user.id,
        craft_type=req.craft_type,
        field_name=req.field_name,
        ai_prediction=req.ai_prediction,
        artisan_correction=req.artisan_correction,
        language=req.language,
        confidence=req.confidence
    )
    return {
        "status": "success",
        "message": "Artisan correction safely staged in pending validation queue.",
        "record": record
    }


@router.get("/feedback/pending")
def list_pending_feedback(current_user: CurrentUser = Depends(require_admin)):
    """Returns all pending corrections requiring expert curation."""
    items = correction_feedback_service.list_pending_corrections()
    return {"status": "success", "count": len(items), "pending_corrections": items}


@router.post("/feedback/{correction_id}/approve")
def approve_artisan_feedback(
    correction_id: str,
    current_user: CurrentUser = Depends(require_admin),
):
    """Validates an artisan correction and marks it as approved training data."""
    approved = correction_feedback_service.approve_correction(correction_id, reviewer_id=current_user.id)
    if not approved:
        raise HTTPException(status_code=404, detail="Correction ID not found")
    return {"status": "success", "approved_sample": approved}


@router.post("/search")
def natural_language_search(req: SearchQueryRequest):
    """
    Module G: Parses natural buyer queries and executes hybrid structured + semantic search.
    """
    results = semantic_search_service.execute_hybrid_search(req.query)
    parsed_filters = semantic_search_service.parse_natural_language_query(req.query)
    return {
        "status": "success",
        "query": req.query,
        "extracted_filters": parsed_filters,
        "results": results
    }


@router.get("/observability")
def get_ai_observability_dashboard(current_user: CurrentUser = Depends(require_admin)):
    """
    Module 38: Returns real-time AI metrics, latency, acceptance rate, and version tracking.
    """
    return version_registry.get_observability_dashboard()


class ReviewOutcomeRequest(BaseModel):
    review_type: Literal["CORRECT", "WRONG"] = Field(..., description="Artisan review outcome", example="CORRECT")
    craft_type: str = Field(..., description="Craft category", example="Bastar Dhokra")
    input_data: Dict[str, Any] = Field(..., description="Input photo/voice context")
    ai_product_card: Dict[str, Any] = Field(..., description="Original AI product card")
    corrections: Optional[Dict[str, Any]] = Field(None, description="Field corrections if WRONG")
    language: str = Field("hi", description="Artisan language code")


@router.post("/review-outcome")
def process_artisan_review_outcome(
    req: ReviewOutcomeRequest,
    current_user: CurrentUser = Depends(require_artisan),
):
    """
    Dual-path Learning Loop Endpoint:
    Captures both 'Correct' (positive ground truth) and 'Wrong' (feedback data delta)
    reviews to feed the Hunardhara dataset pipeline.
    """
    entry = correction_feedback_service.record_artisan_review_outcome(
        review_type=req.review_type,
        artisan_id=current_user.id,
        craft_type=req.craft_type,
        input_data=req.input_data,
        ai_product_card=req.ai_product_card,
        corrections=req.corrections,
        language=req.language
    )
    return {
        "status": "success",
        "message": f"Artisan review [{req.review_type.upper()}] successfully recorded into Hunardhara dataset pipeline.",
        "record": entry
    }


@router.get("/learning-loop/status")
def get_learning_loop_status(current_user: CurrentUser = Depends(require_admin)):
    """
    Returns the real-time stage status of the entire artisan learning loop:
    Input -> AI Processing -> Artisan Review (Correct / Wrong) -> Dataset -> Human Validation -> Fine-tuning.
    """
    return {
        "status": "success",
        "pipeline": correction_feedback_service.get_dataset_pipeline_status()
    }


@router.post("/dataset/export-finetuning")
def export_dataset_for_finetuning(current_user: CurrentUser = Depends(require_admin)):
    """
    Compiles validated dataset samples into QLoRA/Alpaca format ready for train_colab.py.
    """
    result = correction_feedback_service.export_finetuning_dataset()
    return {
        "status": "success",
        "export_details": result
    }
