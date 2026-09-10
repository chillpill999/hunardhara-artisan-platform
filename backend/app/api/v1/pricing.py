import logging
from fastapi import APIRouter, HTTPException
from app.schemas.pricing import PricingEstimateRequest, PricingEstimateResponse
from app.services.pricing_service import pricing_service

logger = logging.getLogger("artisan_platform.api.pricing")
router = APIRouter(prefix="/pricing", tags=["Smart Pricing Assistant"])


@router.post("/estimate", response_model=PricingEstimateResponse, summary="Fair Valuation & Anti-Exploitation Floor")
def estimate_fair_pricing(req: PricingEstimateRequest):
    try:
        materials_cost = req.get_materials_cost()
        return pricing_service.estimate_pricing(
            craft_type=req.craft_type,
            materials_cost=materials_cost,
            labor_hours=req.labor_hours,
            cluster_id=req.cluster_id,
            craft_cluster=req.craft_cluster,
            product_image_url=req.product_image_url or req.image_url
        )
    except Exception as e:
        logger.error(f"Pricing estimation error: {e}")
        raise HTTPException(status_code=400, detail=f"PRICING_ESTIMATION_ERROR: {str(e)}")

