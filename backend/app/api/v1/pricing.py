import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.pricing import PricingEstimateRequest, PricingEstimateResponse, MarketTrendResponse
from app.services.pricing_service import pricing_service
from app.services.market_trend_service import market_trend_service
from app.core.security import RateLimiter

logger = logging.getLogger("artisan_platform.api.pricing")
router = APIRouter(prefix="/pricing", tags=["Smart Pricing Assistant"])


@router.post(
    "/estimate",
    response_model=PricingEstimateResponse,
    summary="Fair Valuation & Anti-Exploitation Floor",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="pricing_estimate"))]
)
def estimate_fair_pricing(req: PricingEstimateRequest):
    try:
        materials_cost = req.get_materials_cost()
        return pricing_service.estimate_pricing(
            craft_type=req.craft_type,
            materials_cost=materials_cost,
            labor_hours=req.labor_hours,
            cluster_id=req.cluster_id,
            craft_cluster=req.craft_cluster,
            product_image_url=req.product_image_url or req.image_url,
            product_description=req.get_description(),
            product_image_base64=req.product_image_base64 or req.image_base64,
            artisan_stated_price=req.artisan_stated_price
        )
    except Exception as e:
        logger.error(f"Pricing estimation error: {e}")
        raise HTTPException(status_code=400, detail=f"PRICING_ESTIMATION_ERROR: {str(e)}")


@router.get(
    "/market-trends",
    response_model=List[MarketTrendResponse],
    summary="Get all craft cluster market intelligence and demand indices",
    dependencies=[Depends(RateLimiter(max_requests=60, window_seconds=60, prefix="market_trends_all"))]
)
def get_all_market_trends():
    """Returns live market trends, demand indices, seasonal focus and price movement across craft clusters."""
    try:
        return market_trend_service.get_all_trends()
    except Exception as e:
        logger.error(f"Error fetching market trends: {e}")
        raise HTTPException(status_code=500, detail=f"MARKET_TRENDS_ERROR: {str(e)}")


@router.get(
    "/market-trends/{craft_type}",
    response_model=MarketTrendResponse,
    summary="Get market trend intelligence for a specific craft type",
    dependencies=[Depends(RateLimiter(max_requests=60, window_seconds=60, prefix="market_trends_single"))]
)
def get_craft_market_trend(craft_type: str):
    """Returns market intelligence for a specific craft (e.g., 'Varanasi Silk', 'Bastar Dhokra')."""
    try:
        return market_trend_service.get_trend(craft_type)
    except Exception as e:
        logger.error(f"Error fetching market trend for {craft_type}: {e}")
        raise HTTPException(status_code=404, detail=f"CRAFT_TREND_NOT_FOUND: {str(e)}")

