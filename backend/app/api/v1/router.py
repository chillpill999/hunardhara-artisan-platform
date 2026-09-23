from fastapi import APIRouter
from app.api.v1 import health, clusters, products, pricing, compliance, b2b, orders, earnings, applications, voice, ai_assistant, storage, artisans, admin, inquiries

api_router = APIRouter()

# Register core endpoints for Milestone M1
api_router.include_router(health.router)
api_router.include_router(clusters.router)
api_router.include_router(artisans.router)

# Register AI pipelines & Security endpoints for Milestone M2
api_router.include_router(products.router)
api_router.include_router(pricing.router)
api_router.include_router(compliance.router)
api_router.include_router(voice.router)
api_router.include_router(storage.router)

# Register B2B matchmaker endpoints for Milestone M3
api_router.include_router(b2b.router)

# Register Role Workspaces & Commerce endpoints
api_router.include_router(orders.router)
api_router.include_router(earnings.router)
api_router.include_router(applications.router)
api_router.include_router(admin.router)
api_router.include_router(inquiries.router)

# Register Hunardhara AI Commerce Assistant (Gateway & Observability)
api_router.include_router(ai_assistant.router)




