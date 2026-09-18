import json
import math
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.artisan import Artisan
from app.models.craft_cluster import CraftCluster
from app.schemas.b2b import (
    B2BRFQCreate,
    B2BMatchResponse,
    B2BRFQSummary,
    B2BArtisanMatchItem,
    B2BMatchScoreBreakdown,
    ConsortiumClusterOption,
)

logger = logging.getLogger("artisan_platform.services.b2b_matching")

# Locate seed fixtures directory
SERVICE_FILE = Path(__file__).resolve()
BACKEND_DIR = SERVICE_FILE.parents[2]
FIXTURES_DIR = BACKEND_DIR / "tests" / "fixtures" / "seed_data"
ALT_FIXTURES_DIR = BACKEND_DIR / "tests" / "fixtures" / "seeds"


class B2BMatchingService:
    """
    Sovereign B2B Multi-Factor Matching Engine (SIH26090 - MoSJE R4 / A3).
    
    Weights:
    - Craft Compatibility: 35%
    - Price Budget: 30%
    - Production Capacity: 25%
    - Location Proximity: 10%
    """

    WEIGHT_CRAFT = 0.35
    WEIGHT_PRICE = 0.30
    WEIGHT_CAPACITY = 0.25
    WEIGHT_LOCATION = 0.10

    def __init__(self):
        self._cached_seed_candidates: Optional[List[Dict[str, Any]]] = None
        self._cached_clusters: Optional[Dict[str, Dict[str, Any]]] = None

    def _get_fixtures_dir(self) -> Path:
        if FIXTURES_DIR.exists():
            return FIXTURES_DIR
        if ALT_FIXTURES_DIR.exists():
            return ALT_FIXTURES_DIR
        fallback = Path("backend/tests/fixtures/seed_data")
        if fallback.exists():
            return fallback
        return FIXTURES_DIR

    def _load_clusters_map(self) -> Dict[str, Dict[str, Any]]:
        if self._cached_clusters is not None:
            return self._cached_clusters

        clusters_map: Dict[str, Dict[str, Any]] = {}
        fixtures_path = self._get_fixtures_dir() / "craft_clusters.json"
        if fixtures_path.exists():
            try:
                with open(fixtures_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        cid = item.get("cluster_id") or item.get("id")
                        if cid:
                            loc = item.get("location", {})
                            clusters_map[cid] = {
                                "cluster_id": cid,
                                "name": item.get("name", "Indian Craft Cluster"),
                                "state": item.get("state", "India"),
                                "district": item.get("district", ""),
                                "latitude": loc.get("latitude", item.get("latitude", 20.5937)),
                                "longitude": loc.get("longitude", item.get("longitude", 78.9629)),
                                "primary_crafts": item.get("primary_crafts", [item.get("craft_name", "Handicraft")]),
                                "skilled_hourly_wage_inr": item.get("skilled_hourly_wage_inr", 60.0),
                            }
            except Exception as e:
                logger.warning(f"Could not read craft_clusters.json fixture: {e}")

        self._cached_clusters = clusters_map
        return clusters_map

    def _load_seed_candidates(self) -> List[Dict[str, Any]]:
        if self._cached_seed_candidates is not None:
            return self._cached_seed_candidates

        candidates: List[Dict[str, Any]] = []
        clusters_map = self._load_clusters_map()

        fixtures_path = self._get_fixtures_dir() / "artisan_profiles.json"
        if fixtures_path.exists():
            try:
                with open(fixtures_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for a in data:
                        cid = a.get("cluster_id")
                        cinfo = clusters_map.get(cid, {})
                        candidates.append({
                            "artisan_id": a.get("artisan_id"),
                            "artisan_name": a.get("name"),
                            "cluster_id": cid,
                            "cluster_name": cinfo.get("name", "Indian Craft Cluster"),
                            "location_str": f"{cinfo.get('district', '')}, {cinfo.get('state', '')}".strip(", "),
                            "craft_specialty": a.get("craft_specialty"),
                            "monthly_capacity_units": a.get("monthly_capacity_units", 30),
                            "average_wholesale_price_inr": float(a.get("average_wholesale_price_inr", 1200.0)),
                            "latitude": cinfo.get("latitude", 20.0),
                            "longitude": cinfo.get("longitude", 78.0),
                            "experience_years": a.get("experience_years", 10),
                            "verified": a.get("verified", True),
                        })
            except Exception as e:
                logger.warning(f"Could not read artisan_profiles.json fixture: {e}")

        self._cached_seed_candidates = candidates
        return candidates

    # --------------------------------------------------------------------------
    # 1. COMPONENT SCORING ALGORITHMS
    # --------------------------------------------------------------------------

    @staticmethod
    def score_craft(artisan_craft: str, requested_craft: str) -> float:
        """
        Evaluates craft compatibility (weight 35%).
        Returns 1.0 for exact/semantic matches, 0.90 for category overlap, 0.0 otherwise.
        """
        if not artisan_craft or not requested_craft:
            return 0.0

        a = artisan_craft.strip().lower()
        r = requested_craft.strip().lower()

        if a == r:
            return 1.0

        # Substring / partial match (e.g. 'Dhokra' in 'Bastar Dhokra')
        if a in r or r in a:
            return 1.0

        # Word token overlap
        a_tokens = set(a.split())
        r_tokens = set(r.split())
        if a_tokens & r_tokens:
            return 0.90

        return 0.0

    @staticmethod
    def score_price(artisan_wholesale: float, buyer_unit_budget: float) -> float:
        """
        Evaluates price budget compatibility (weight 30%).
        - 1.0 if artisan wholesale <= buyer unit budget.
        - Linear degradation up to 30% over budget: 1.0 - (overage / 0.30).
        - 0.0 if more than 30% over budget or if budget <= 0.
        """
        if buyer_unit_budget <= 0:
            return 0.0
        if artisan_wholesale <= buyer_unit_budget:
            return 1.0

        overage = (artisan_wholesale - buyer_unit_budget) / buyer_unit_budget
        if overage >= 0.30:
            return 0.0
        return round(max(0.0, 1.0 - (overage / 0.30)), 3)

    @staticmethod
    def score_capacity(monthly_capacity: int, quantity: int, deadline_days: int) -> Tuple[float, bool]:
        """
        Evaluates production delivery capacity (weight 25%).
        deliverable = monthly_capacity * (deadline_days / 30.0)
        feasible = deliverable >= quantity
        score = 1.0 if feasible else min(0.95, deliverable / quantity)
        """
        if quantity <= 0 or deadline_days <= 0 or monthly_capacity <= 0:
            return 0.0, False

        max_deliverable = monthly_capacity * (deadline_days / 30.0)
        feasible = max_deliverable >= quantity
        if feasible:
            score = 1.0
        else:
            score = min(0.95, max_deliverable / quantity)
        return round(score, 3), feasible

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Computes great-circle distance in kilometers using the Haversine formula.
        """
        R = 6371.0  # Earth radius in km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(R * c, 2)

    @classmethod
    def score_location(cls, distance_km: float) -> float:
        """
        Evaluates geodesic proximity score (weight 10%).
        Scaled against standard domestic logistics corridors (up to 4000 km).
        1200 km (Bastar to Delhi) produces 0.70.
        """
        if distance_km <= 0:
            return 1.0
        # 1.0 - (distance / 4000.0)
        score = 1.0 - (distance_km / 4000.0)
        return round(max(0.10, min(1.0, score)), 2)

    @classmethod
    def calculate_composite_score(
        cls, craft_s: float, price_s: float, capacity_s: float, location_s: float
    ) -> float:
        """
        Calculates composite match percentage:
        (0.35 * Craft) + (0.30 * Price) + (0.25 * Capacity) + (0.10 * Location)
        Multiplied by 100.0 and rounded to 2 decimal places.
        """
        composite = (
            (cls.WEIGHT_CRAFT * craft_s)
            + (cls.WEIGHT_PRICE * price_s)
            + (cls.WEIGHT_CAPACITY * capacity_s)
            + (cls.WEIGHT_LOCATION * location_s)
        )
        return round(composite * 100.0, 2)

    # --------------------------------------------------------------------------
    # 2. CANDIDATE GATHERING & ENRICHMENT
    # --------------------------------------------------------------------------

    def get_candidate_artisans(self, db: Optional[Session] = None) -> List[Dict[str, Any]]:
        """
        Collects candidate artisans:
        - In production with active DB session: gathers exclusively verified active database artisans.
        - In explicit OFFLINE_MODE or when db is None (offline tests): falls back to seed profiles.
        """
        candidates_by_id: Dict[str, Dict[str, Any]] = {}

        # 1. Production Mode: Strict verified database artisans only
        if db is not None and not settings.OFFLINE_MODE:
            try:
                db_artisans = db.query(Artisan).filter(Artisan.is_active == True).all()
                for a in db_artisans:
                    cid = a.cluster_id
                    cluster = a.cluster
                    c_name = cluster.name if cluster else "Regional Craft Cluster"
                    c_lat = a.latitude if a.latitude is not None else (cluster.latitude if cluster else 0.0)
                    c_lon = a.longitude if a.longitude is not None else (cluster.longitude if cluster else 0.0)

                    # Filter only active, eligible products with valid b2b wholesale price
                    active_products = [
                        p for p in (a.products or [])
                        if p.is_active and p.wholesale_b2b_price and p.wholesale_b2b_price > 0
                    ]
                    # If artisan has registered products, but NONE are active/eligible, exclude artisan
                    if a.products and len(a.products) > 0 and len(active_products) == 0:
                        continue

                    # Active vs inactive craft types for strict eligibility checks
                    active_crafts = {
                        p.craft_type.strip().lower() for p in (a.products or [])
                        if p.is_active and p.craft_type
                    }
                    inactive_crafts = {
                        p.craft_type.strip().lower() for p in (a.products or [])
                        if not p.is_active and p.craft_type
                    }
                    active_craft_prices = [
                        (p.craft_type, float(p.wholesale_b2b_price))
                        for p in active_products if p.craft_type and p.wholesale_b2b_price
                    ]

                    # Determine wholesale price from active products or cluster statutory daily wage
                    if active_products:
                        wholesale_price = min(p.wholesale_b2b_price for p in active_products)
                    elif cluster and cluster.statutory_daily_wage:
                        wholesale_price = cluster.statutory_daily_wage * 2.5
                    else:
                        wholesale_price = 1200.0

                    candidates_by_id[a.id] = {
                        "id": a.id,
                        "artisan_id": a.id,
                        "artisan_name": a.full_name,
                        "cluster_id": cid,
                        "cluster_name": c_name,
                        "location_str": f"{a.district or ''}, {a.state or ''}".strip(", "),
                        "craft_specialty": a.primary_craft,
                        "monthly_capacity_units": a.monthly_capacity_units or 30,
                        "average_wholesale_price_inr": wholesale_price,
                        "latitude": c_lat,
                        "longitude": c_lon,
                        "experience_years": a.experience_years or 5,
                        "verified": getattr(a, "is_verified", True),
                        "active_crafts": active_crafts,
                        "inactive_crafts": inactive_crafts,
                        "active_craft_prices": active_craft_prices,
                        "has_products": bool(a.products),
                    }
                return list(candidates_by_id.values())
            except Exception as e:
                logger.warning(f"Error querying database artisans: {e}")
                return []

        # 2. Isolated Offline / Test Fallback: load seed candidates only if explicitly OFFLINE_MODE or db is None
        seed_candidates = self._load_seed_candidates()
        candidates_by_id = {c["artisan_id"]: dict(c) for c in seed_candidates}

        if db:
            try:
                db_artisans = db.query(Artisan).filter(Artisan.is_active == True).all()
                for a in db_artisans:
                    cid = a.cluster_id
                    cluster = a.cluster
                    c_name = cluster.name if cluster else "Regional Craft Cluster"
                    c_lat = a.latitude if a.latitude is not None else (cluster.latitude if cluster else 0.0)
                    c_lon = a.longitude if a.longitude is not None else (cluster.longitude if cluster else 0.0)

                    active_products = [
                        p for p in (a.products or [])
                        if p.is_active and p.wholesale_b2b_price and p.wholesale_b2b_price > 0
                    ]
                    if a.products and len(a.products) > 0 and len(active_products) == 0:
                        continue

                    active_crafts = {
                        p.craft_type.strip().lower() for p in (a.products or [])
                        if p.is_active and p.craft_type
                    }
                    inactive_crafts = {
                        p.craft_type.strip().lower() for p in (a.products or [])
                        if not p.is_active and p.craft_type
                    }
                    active_craft_prices = [
                        (p.craft_type, float(p.wholesale_b2b_price))
                        for p in active_products if p.craft_type and p.wholesale_b2b_price
                    ]

                    if active_products:
                        wholesale_price = min(p.wholesale_b2b_price for p in active_products)
                    elif cluster and cluster.statutory_daily_wage:
                        wholesale_price = cluster.statutory_daily_wage * 2.5
                    else:
                        wholesale_price = 1200.0

                    if a.id not in candidates_by_id:
                        candidates_by_id[a.id] = {
                            "id": a.id,
                            "artisan_id": a.id,
                            "artisan_name": a.full_name,
                            "cluster_id": cid,
                            "cluster_name": c_name,
                            "location_str": f"{a.district or ''}, {a.state or ''}".strip(", "),
                            "craft_specialty": a.primary_craft,
                            "monthly_capacity_units": a.monthly_capacity_units or 30,
                            "average_wholesale_price_inr": wholesale_price,
                            "latitude": c_lat,
                            "longitude": c_lon,
                            "experience_years": a.experience_years or 5,
                            "verified": True,
                            "active_crafts": active_crafts,
                            "inactive_crafts": inactive_crafts,
                            "active_craft_prices": active_craft_prices,
                            "has_products": bool(a.products),
                        }
            except Exception as e:
                logger.warning(f"Error querying database artisans: {e}")

        return list(candidates_by_id.values())

    # --------------------------------------------------------------------------
    # 3. MATCHMAKING EXECUTION
    # --------------------------------------------------------------------------

    def match_rfq(
        self,
        rfq: B2BRFQCreate,
        db: Optional[Session] = None,
        rfq_id: Optional[str] = None
    ) -> B2BMatchResponse:
        """
        Executes multi-factor B2B matching against candidate artisans.
        Outputs ranked matches with component breakdowns, capacity feasibility flags,
        and cluster consortium fulfillment evaluation.
        """
        quantity = rfq.quantity or rfq.required_quantity or 1
        deadline_days = rfq.deadline_days or rfq.days_to_deadline or 30
        unit_budget = rfq.unit_budget
        craft_type = rfq.craft_type
        del_lat = rfq.delivery_latitude
        del_lon = rfq.delivery_longitude

        all_candidates = self.get_candidate_artisans(db=db)

        # If a specific artisan was requested, filter candidate list strictly to that artisan
        # Never substitute an unrelated artisan if the requested artisan is not found or ineligible
        requested_artisan_id = getattr(rfq, "requested_artisan_id", None)
        if requested_artisan_id:
            all_candidates = [c for c in all_candidates if c["artisan_id"] == requested_artisan_id]

        scored_matches: List[B2BArtisanMatchItem] = []

        for c in all_candidates:
            # 1. Craft Compatibility
            craft_s = self.score_craft(c["craft_specialty"], craft_type)

            # Strict product eligibility check:
            # If the artisan has registered products, but all products for the requested craft are inactive/expired, exclude
            active_crafts = c.get("active_crafts", set())
            inactive_crafts = c.get("inactive_crafts", set())
            req_c = craft_type.strip().lower()

            if inactive_crafts and any(self.score_craft(ic, req_c) > 0 for ic in inactive_crafts):
                if not any(self.score_craft(ac, req_c) > 0 for ac in active_crafts):
                    continue

            if any(self.score_craft(ac, req_c) > 0 for ac in active_crafts):
                craft_s = max(craft_s, 1.0)

            if craft_s == 0.0:
                continue  # Filter out non-matching crafts

            # 2. Price Budget Compatibility: derive wholesale price from active products for this craft if available
            craft_prices = [
                p_price for p_craft, p_price in c.get("active_craft_prices", [])
                if self.score_craft(p_craft, craft_type) > 0
            ]
            wholesale_price = min(craft_prices) if craft_prices else c["average_wholesale_price_inr"]
            price_s = self.score_price(wholesale_price, unit_budget)

            # 3. Production Capacity Feasibility
            monthly_capacity = c["monthly_capacity_units"]
            cap_s, solo_feasible = self.score_capacity(monthly_capacity, quantity, deadline_days)
            deliverable_units = monthly_capacity * (deadline_days / 30.0)

            # 4. Geodesic Proximity: calculate Haversine only when coordinates are provided; neutral score otherwise
            if del_lat is not None and del_lon is not None and c.get("latitude") is not None and c.get("longitude") is not None:
                dist_km = self.haversine_distance(c["latitude"], c["longitude"], del_lat, del_lon)
                loc_s = self.score_location(dist_km)
            else:
                dist_km = 0.0
                loc_s = 0.50

            # Composite percentage
            composite = self.calculate_composite_score(craft_s, price_s, cap_s, loc_s)

            # Estimated production days for solo artisan
            daily_output = monthly_capacity / 30.0
            est_days = math.ceil(quantity / daily_output) if daily_output > 0 else 999

            # Human-readable explanation
            if solo_feasible:
                explanation = (
                    f"Artisan {c['artisan_name']} ({c['cluster_name']}) achieves a high match of {composite:.1f}%. "
                    f"Production capacity is feasible ({deliverable_units:.0f} units in {deadline_days} days vs {quantity} requested) "
                    f"at ₹{wholesale_price:.2f}/unit within budget of ₹{unit_budget:.2f}."
                )
            else:
                explanation = (
                    f"Artisan {c['artisan_name']} ({c['cluster_name']}) matches craft specifications and unit budget "
                    f"(₹{wholesale_price:.2f} <= ₹{unit_budget:.2f}), but individual capacity ({deliverable_units:.0f} units in {deadline_days} days) "
                    f"is insufficient for bulk quantity of {quantity} units solo. Recommended for cluster consortium aggregation."
                )

            breakdown = B2BMatchScoreBreakdown(
                craft_compatibility=round(craft_s * 100.0, 1),
                price_compatibility=round(price_s * 100.0, 1),
                capacity_feasibility=round(cap_s * 100.0, 1),
                location_score=round(loc_s * 100.0, 1),
            )

            item = B2BArtisanMatchItem(
                artisan_id=c["artisan_id"],
                artisan_name=c["artisan_name"],
                cluster_name=c["cluster_name"],
                location=c["location_str"],
                match_percentage=composite,
                breakdown=breakdown,
                scores={
                    "craft": craft_s,
                    "price": price_s,
                    "capacity": cap_s,
                    "location": loc_s
                },
                capacity_feasible=solo_feasible,
                estimated_production_days=est_days,
                estimated_fulfillment_days=est_days,
                offered_wholesale_price=wholesale_price,
                quoted_unit_price=wholesale_price,
                distance_km=dist_km,
                match_explanation=explanation,
                explanation=explanation
            )
            # Store raw monthly capacity for consortium calculation
            item._monthly_cap = monthly_capacity
            scored_matches.append(item)

        # Sort ranked by match percentage descending
        scored_matches.sort(key=lambda x: x.match_percentage, reverse=True)

        # Consortium evaluation across top matching artisans in the primary cluster
        consortium_option = None
        consortium_feasible = False

        if scored_matches:
            top_cluster = scored_matches[0].cluster_name
            cluster_matches = [m for m in scored_matches if m.cluster_name == top_cluster]
            # Take up to 5 top artisans in the cluster
            selected_consortium = cluster_matches[:5]
            combined_monthly = sum(getattr(m, "_monthly_cap", 35) for m in selected_consortium)
            consortium_deliverable = combined_monthly * (deadline_days / 30.0)
            consortium_feasible = consortium_deliverable >= quantity
            artisan_names = [m.artisan_name for m in selected_consortium]

            if any(not m.capacity_feasible for m in scored_matches[:3]):
                recommended = True
                exp = (
                    f"No single artisan can fulfill {quantity} units within {deadline_days} days. "
                    f"Cluster Consortium of {len(selected_consortium)} {top_cluster} artisans ({', '.join(artisan_names)}) "
                    f"can collectively supply {consortium_deliverable:.0f} units (combined monthly capacity: {combined_monthly} units)."
                )
            else:
                recommended = False
                exp = f"Individual artisans can fulfill order solo; consortium optional for expedited delivery."

            consortium_option = ConsortiumClusterOption(
                consortium_recommended=recommended,
                cluster_name=top_cluster,
                participating_artisans=artisan_names,
                artisan_count=len(selected_consortium),
                combined_monthly_capacity=combined_monthly,
                deliverable_in_deadline=consortium_deliverable,
                consortium_feasible=consortium_feasible,
                explanation=exp
            )

        summary = B2BRFQSummary(
            craft_type=craft_type,
            required_quantity=quantity,
            unit_budget=unit_budget,
            days_to_deadline=deadline_days
        )

        return B2BMatchResponse(
            status="success",
            rfq_id=rfq_id,
            rfq_summary=summary,
            total_matches_found=len(scored_matches),
            matches=scored_matches,
            consortium_feasible=consortium_feasible,
            consortium_option=consortium_option
        )


b2b_matching_service = B2BMatchingService()
