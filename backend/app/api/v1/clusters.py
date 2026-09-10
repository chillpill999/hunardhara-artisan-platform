from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.craft_cluster import CraftCluster
from app.models.artisan import Artisan
from app.schemas.craft_cluster import CraftClusterResponse

router = APIRouter(prefix="/clusters", tags=["Craft Clusters & Wage Baselines"])


@router.get(
    "",
    response_model=List[CraftClusterResponse],
    summary="List All 5 Indian Craft Clusters",
    description="Returns all 5 seeded craft clusters (Varanasi Silk, Bastar Dhokra, Khurja Pottery, Madhubani Painting, Channapatna Toys) with GPS coordinates and wage rates."
)
def list_craft_clusters(db: Session = Depends(get_db)):
    clusters = db.query(CraftCluster).all()
    response = []
    for cluster in clusters:
        artisan_count = db.query(Artisan).filter(Artisan.cluster_id == cluster.id).count()
        c_dict = {
            "id": cluster.id,
            "name": cluster.name,
            "craft_name": cluster.craft_name,
            "state": cluster.state,
            "district": cluster.district,
            "latitude": cluster.latitude,
            "longitude": cluster.longitude,
            "statutory_hourly_wage": cluster.statutory_hourly_wage,
            "statutory_daily_wage": cluster.statutory_daily_wage,
            "gi_tag_status": cluster.gi_tag_status,
            "gi_tag_number": cluster.gi_tag_number,
            "materials": cluster.materials or [],
            "techniques": cluster.techniques or [],
            "description": cluster.description,
            "created_at": cluster.created_at,
            "artisan_count": artisan_count
        }
        response.append(CraftClusterResponse(**c_dict))
    return response


@router.get(
    "/{cluster_id}",
    response_model=CraftClusterResponse,
    summary="Get Detailed Craft Cluster Information"
)
def get_craft_cluster(cluster_id: str, db: Session = Depends(get_db)):
    cluster = db.query(CraftCluster).filter(
        (CraftCluster.id == cluster_id) | (CraftCluster.name.ilike(f"%{cluster_id}%"))
    ).first()
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Craft cluster '{cluster_id}' not found."
        )
    artisan_count = db.query(Artisan).filter(Artisan.cluster_id == cluster.id).count()
    return CraftClusterResponse(
        id=cluster.id,
        name=cluster.name,
        craft_name=cluster.craft_name,
        state=cluster.state,
        district=cluster.district,
        latitude=cluster.latitude,
        longitude=cluster.longitude,
        statutory_hourly_wage=cluster.statutory_hourly_wage,
        statutory_daily_wage=cluster.statutory_daily_wage,
        gi_tag_status=cluster.gi_tag_status,
        gi_tag_number=cluster.gi_tag_number,
        materials=cluster.materials or [],
        techniques=cluster.techniques or [],
        description=cluster.description,
        created_at=cluster.created_at,
        artisan_count=artisan_count
    )


@router.get(
    "/{cluster_id}/wage",
    summary="Get Statutory Minimum Wage Rate for Pricing Protection",
    description="Retrieves the certified MoSJE skilled hourly and daily wage rates for anti-exploitation price floor computation."
)
def get_cluster_wage_rate(cluster_id: str, db: Session = Depends(get_db)):
    cluster = db.query(CraftCluster).filter(
        (CraftCluster.id == cluster_id) | (CraftCluster.name.ilike(f"%{cluster_id}%"))
    ).first()
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Craft cluster '{cluster_id}' not found."
        )
    return {
        "cluster_id": cluster.id,
        "cluster_name": cluster.name,
        "state": cluster.state,
        "district": cluster.district,
        "statutory_hourly_wage_inr": cluster.statutory_hourly_wage,
        "statutory_daily_wage_inr": cluster.statutory_daily_wage,
        "policy_reference": "Ministry of Social Justice and Empowerment / Ministry of Labour Skilled Craftsman Wage Schedule"
    }
