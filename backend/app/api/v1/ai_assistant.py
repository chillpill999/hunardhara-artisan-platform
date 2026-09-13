"""
Hunardhara AI Gateway & Commerce Assistant Endpoints
FastAPI Router exposing the multi-module AI Commerce Assistant, RAG lookup,
semantic search, feedback loop, and observability telemetry.
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from app.services.ai_orchestrator import ai_orchestrator
from app.schemas.artisan_commerce import HunardharaCatalogOutput
from app.services.sarvam_service import sarvam_service
from app.services.semantic_search_service import semantic_search_service
from app.services.correction_feedback_service import correction_feedback_service
from app.core.version_registry import version_registry

router = APIRouter(prefix="/ai/assistant", tags=["Hunardhara AI Commerce Assistant"])


class OrchestrateRequest(BaseModel):
    raw_input: str = Field(..., description="Artisan voice transcript or text description", example="यह बस्तर का पारंपरिक ढोकरा पीतल का घोड़ा है जो चार दिन में लॉस्ट वैक्स तकनीक से बना है।")
    image_base64: Optional[str] = Field(None, description="Optional raw or base64 craft photo")
    artisan_id: Optional[str] = Field("artisan-default", description="Authenticated artisan identifier")
    region: Optional[str] = Field(None, description="Craft cluster district or state")
    language: str = Field("hi", description="Artisan language preference")


class VoiceUnderstandRequest(BaseModel):
    text: str = Field(..., description="Colloquial spoken text to normalize")
    language_code: str = Field("hi-IN", description="Language code")


class FeedbackRequest(BaseModel):
    artisan_id: str = Field(..., description="Artisan reporting the correction")
    craft_type: str = Field(..., description="Craft category")
    field_name: str = Field(..., description="Attribute field modified (e.g. 'material', 'production_time_days')")
    ai_prediction: Any = Field(..., description="Original value predicted by AI")
    artisan_correction: Any = Field(..., description="Corrected value provided by artisan")
    language: str = Field("hi", description="Language used")
    confidence: float = Field(0.85, description="Model confidence score")


class SearchQueryRequest(BaseModel):
    query: str = Field(..., description="Natural language search query", example="I want a handmade blue cotton saree under 1500")


@router.post("/orchestrate", response_model=HunardharaCatalogOutput)
def orchestrate_artisan_listing(req: OrchestrateRequest):
    """
    Primary AI Gateway Endpoint:
    Transforms rough artisan spoken/text input + photo into a truthful, dignified, market-ready listing.
    """
    try:
        return ai_orchestrator.orchestrate_listing_pipeline(
            raw_text_or_transcript=req.raw_input,
            image_base64=req.image_base64,
            artisan_id=req.artisan_id,
            stated_region=req.region,
            language=req.language
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI orchestration failed: {str(e)}")


@router.post("/voice-understand")
def understand_and_normalize_voice(req: VoiceUnderstandRequest):
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
def submit_artisan_correction(req: FeedbackRequest):
    """
    Module 13: Submits an artisan correction to the pending human-in-the-loop review queue.
    Prevents model hallucination and creates curated data for future fine-tuning.
    """
    record = correction_feedback_service.record_artisan_correction(
        artisan_id=req.artisan_id,
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
def list_pending_feedback():
    """Returns all pending corrections requiring expert curation."""
    items = correction_feedback_service.list_pending_corrections()
    return {"status": "success", "count": len(items), "pending_corrections": items}


@router.post("/feedback/{correction_id}/approve")
def approve_artisan_feedback(correction_id: str, reviewer: str = "admin-curator"):
    """Validates an artisan correction and marks it as approved training data."""
    approved = correction_feedback_service.approve_correction(correction_id, reviewer_id=reviewer)
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
def get_ai_observability_dashboard():
    """
    Module 38: Returns real-time AI metrics, latency, acceptance rate, and version tracking.
    """
    return version_registry.get_observability_dashboard()
