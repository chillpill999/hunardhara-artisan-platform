"""
Seed script for MoSJE Artisan Platform.
Smart India Hackathon 2026 (SIH26090)

Populates 5 realistic Indian craft clusters:
1. Varanasi Silk (Uttar Pradesh) - GI-99
2. Bastar Dhokra (Chhattisgarh) - GI-83
3. Khurja Pottery (Uttar Pradesh) - GI-177
4. Madhubani Painting (Bihar) - GI-105
5. Channapatna Toys (Karnataka) - GI-131

Includes GPS coordinates, statutory skilled wage rates, artisan profiles with UIDAI Verhoeff-validated
masked Aadhaar, sample handicraft products with cost-plus floor pricing, and pricing benchmarks with
768-dimensional visual embeddings.
"""

import math
import random
import logging
import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.database import SessionLocal, init_db
from app.models.craft_cluster import CraftCluster
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.pricing_benchmark import PricingBenchmark
from app.models.consent_log import ConsentLog
from app.services.aadhaar_vault import MaskedAadhaarVault, generate_valid_aadhaar

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_craft_clusters")


def generate_cluster_embedding(cluster_seed: int, item_seed: int, dim: int = 768) -> list:
    """
    Generates a deterministic, normalized 768-dimensional visual embedding vector
    simulating Google SigLIP output. Combines a cluster direction vector with an
    item variation vector and applies L2 normalization.
    """
    rnd_cluster = random.Random(cluster_seed)
    rnd_item = random.Random(item_seed)
    
    vec = []
    for _ in range(dim):
        cluster_val = rnd_cluster.gauss(0, 1.0)
        item_val = rnd_item.gauss(0, 0.35)
        vec.append(cluster_val + item_val)
        
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [round(x / norm, 6) for x in vec]


def seed_database():
    logger.info("Initializing database tables...")
    init_db()
    
    db = SessionLocal()
    try:
        logger.info("Checking for existing craft clusters...")
        existing_cluster = db.query(CraftCluster).first()
        if existing_cluster:
            logger.info("Craft clusters already exist in database. Clearing existing records for fresh seed...")
            db.query(ConsentLog).delete()
            db.query(Product).delete()
            db.query(PricingBenchmark).delete()
            db.query(Artisan).delete()
            db.query(CraftCluster).delete()
            db.commit()

        # ==============================================================================
        # 1. CRAFT CLUSTERS SPECIFICATION (5 REALISTIC HUBS)
        # ==============================================================================
        clusters_data = [
            {
                "id": "cluster-varanasi-silk",
                "name": "Varanasi Silk Craft Cluster",
                "craft_name": "Varanasi Silk",
                "state": "Uttar Pradesh",
                "district": "Varanasi",
                "latitude": 25.3176,
                "longitude": 82.9739,
                "statutory_hourly_wage": 60.0,
                "statutory_daily_wage": 480.0,
                "gi_tag_status": "Registered (GI-99)",
                "gi_tag_number": "GI-99",
                "materials": ["Mulberry Silk Yarn", "Gold Zari Thread", "Silver Metallic Thread", "Pure Katan Silk"],
                "techniques": ["Jacquard Handloom Weaving", "Kadwa Brocade Weaving", "Tanchoi Silk Weft", "Cutwork Handloom"],
                "description": (
                    "Ancient silk weaving hub of Kashi renowned for opulent Banarasi brocades, gold and silver zari embroidery, "
                    "and royal sarees cherished worldwide since the Mughal era."
                )
            },
            {
                "id": "cluster-bastar-dhokra",
                "name": "Bastar Dhokra Craft Cluster",
                "craft_name": "Bastar Dhokra",
                "state": "Chhattisgarh",
                "district": "Bastar",
                "latitude": 19.0748,
                "longitude": 82.0298,
                "statutory_hourly_wage": 50.0,
                "statutory_daily_wage": 400.0,
                "gi_tag_status": "Registered (GI-83)",
                "gi_tag_number": "GI-83",
                "materials": ["Recycled Brass Scrap", "Natural Beeswax", "River Bank Clay", "Mustard Oil & Charcoal"],
                "techniques": ["Lost-Wax Bell Metal Casting (Cire Perdue)", "Clay Core Sculpting", "Wax Thread Filigree", "Earthen Kiln Smelting"],
                "description": (
                    "Indigenous tribal bell-metal metalcraft of the Ghadwa and Gond tribes of Bastar and Kondagaon, "
                    "preserving an unbroken 4,000-year non-ferrous casting heritage tracing to Mohenjo-daro."
                )
            },
            {
                "id": "cluster-khurja-pottery",
                "name": "Khurja Pottery Craft Cluster",
                "craft_name": "Khurja Pottery",
                "state": "Uttar Pradesh",
                "district": "Bulandshahr",
                "latitude": 28.2530,
                "longitude": 77.8540,
                "statutory_hourly_wage": 55.0,
                "statutory_daily_wage": 440.0,
                "gi_tag_status": "Registered (GI-177)",
                "gi_tag_number": "GI-177",
                "materials": ["China Clay (Kaolin)", "Feldspar Stone Powder", "Quartz Powder", "Natural Mineral Glaze Oxides"],
                "techniques": ["Potter's Wheel Hand Throwing", "Slip Casting in Plaster Molds", "Cobalt Brush Artistry", "High-Temperature Kiln Glaze (1250°C)"],
                "description": (
                    "Renowned Ceramic City of India with over 600 operational kilns, producing vibrant glazed stoneware, "
                    "ornate floral tableware, and artistic ceramic architectural pottery."
                )
            },
            {
                "id": "cluster-madhubani-painting",
                "name": "Madhubani Painting Craft Cluster",
                "craft_name": "Madhubani Painting",
                "state": "Bihar",
                "district": "Madhubani",
                "latitude": 26.3533,
                "longitude": 86.0718,
                "statutory_hourly_wage": 50.0,
                "statutory_daily_wage": 400.0,
                "gi_tag_status": "Registered (GI-105)",
                "gi_tag_number": "GI-105",
                "materials": ["Handmade Recycled Cotton Paper", "Tussar Silk Fabric", "Natural Plant Pigments", "Cow Dung Wash", "Soot Lampblack"],
                "techniques": ["Bharni Rich Color Filling", "Kachni Fine Double Line Hatching", "Godna Tattoo Motifs", "Bamboo Nib & Twig Painting"],
                "description": (
                    "Ancient Mithila folk art practiced traditionally by rural women on mud walls during celebrations, "
                    "depicting celestial deities, nature, and the auspicious Tree of Life."
                )
            },
            {
                "id": "cluster-channapatna-toys",
                "name": "Channapatna Toys Craft Cluster",
                "craft_name": "Channapatna Toys",
                "state": "Karnataka",
                "district": "Ramanagara",
                "latitude": 12.6518,
                "longitude": 77.2089,
                "statutory_hourly_wage": 65.0,
                "statutory_daily_wage": 520.0,
                "gi_tag_status": "Registered (GI-131)",
                "gi_tag_number": "GI-131",
                "materials": ["Wrightia Tinctoria (Ivory Wood)", "Natural Lac Resin", "Turmeric & Indigo Organic Pigments", "Screwpine Polishing Leaf"],
                "techniques": ["Precision Lathe Wood Turning", "Friction Thermo-Lacquer Application", "Screwpine Leaf High-Luster Burnishing", "Non-Toxic Child-Safe Hand Assembly"],
                "description": (
                    "The Gombegala Ooru (Toy Town) of Karnataka established under Tipu Sultan, celebrated for 100% natural, "
                    "non-toxic wooden lacquer toys, games, and home accents."
                )
            }
        ]

        created_clusters = {}
        for cdata in clusters_data:
            cluster = CraftCluster(**cdata)
            db.add(cluster)
            created_clusters[cdata["id"]] = cluster
        db.flush()
        logger.info(f"Seeded {len(created_clusters)} craft clusters.")

        # ==============================================================================
        # 2. ARTISANS SPECIFICATION (REALISTIC CRAFTSPEOPLE ACROSS CLUSTERS)
        # ==============================================================================
        artisans_data = [
            # Varanasi Silk
            {
                "id": "art-varanasi-001",
                "full_name": "Mohammad Irfan Ansari",
                "phone_number": "+919876543201",
                "raw_aadhaar": "234567890123",
                "social_category": "OBC",
                "gender": "Male",
                "cluster_id": "cluster-varanasi-silk",
                "state": "Uttar Pradesh",
                "district": "Varanasi",
                "village": "Kotwa",
                "latitude": 25.3210,
                "longitude": 82.9810,
                "primary_craft": "Varanasi Silk",
                "experience_years": 24,
                "monthly_capacity_units": 18,
                "daily_capacity_units": 0.60,
                "profile_photo_url": "/static/profiles/irfan_ansari.jpg",
                "preferred_language": "hi",
            },
            {
                "id": "art-varanasi-002",
                "full_name": "Savitri Devi Maurya",
                "phone_number": "+919876543202",
                "raw_aadhaar": "298765432104",
                "social_category": "OBC",
                "gender": "Female",
                "cluster_id": "cluster-varanasi-silk",
                "state": "Uttar Pradesh",
                "district": "Varanasi",
                "village": "Lallapura",
                "latitude": 25.3120,
                "longitude": 82.9650,
                "primary_craft": "Varanasi Silk",
                "experience_years": 14,
                "monthly_capacity_units": 12,
                "daily_capacity_units": 0.40,
                "profile_photo_url": "/static/profiles/savitri_maurya.jpg",
                "preferred_language": "hi",
            },

            # Bastar Dhokra
            {
                "id": "art-bastar-001",
                "full_name": "Rameshwar Baghel",
                "phone_number": "+919876543203",
                "raw_aadhaar": "345678901234",
                "social_category": "ST",
                "gender": "Male",
                "cluster_id": "cluster-bastar-dhokra",
                "state": "Chhattisgarh",
                "district": "Bastar",
                "village": "Kondagaon",
                "latitude": 19.5950,
                "longitude": 81.6700,
                "primary_craft": "Bastar Dhokra",
                "experience_years": 22,
                "monthly_capacity_units": 180,
                "daily_capacity_units": 6.0,
                "profile_photo_url": "/static/profiles/rameshwar_baghel.jpg",
                "preferred_language": "hi",
            },
            {
                "id": "art-bastar-002",
                "full_name": "Sukhvati Ghadwa",
                "phone_number": "+919876543204",
                "raw_aadhaar": "387654321095",
                "social_category": "ST",
                "gender": "Female",
                "cluster_id": "cluster-bastar-dhokra",
                "state": "Chhattisgarh",
                "district": "Bastar",
                "village": "Bhelvapadar",
                "latitude": 19.5880,
                "longitude": 81.6620,
                "primary_craft": "Bastar Dhokra",
                "experience_years": 16,
                "monthly_capacity_units": 110,
                "daily_capacity_units": 3.67,
                "profile_photo_url": "/static/profiles/sukhvati_ghadwa.jpg",
                "preferred_language": "hi",
            },

            # Khurja Pottery
            {
                "id": "art-khurja-001",
                "full_name": "Dinesh Prajapati",
                "phone_number": "+919876543205",
                "raw_aadhaar": "456789012345",
                "social_category": "OBC",
                "gender": "Male",
                "cluster_id": "cluster-khurja-pottery",
                "state": "Uttar Pradesh",
                "district": "Bulandshahr",
                "village": "Khurja GT Road",
                "latitude": 28.2580,
                "longitude": 77.8590,
                "primary_craft": "Khurja Pottery",
                "experience_years": 19,
                "monthly_capacity_units": 350,
                "daily_capacity_units": 11.67,
                "profile_photo_url": "/static/profiles/dinesh_prajapati.jpg",
                "preferred_language": "hi",
            },
            {
                "id": "art-khurja-002",
                "full_name": "Sunita Devi Sharma",
                "phone_number": "+919876543206",
                "raw_aadhaar": "498765432106",
                "social_category": "General",
                "gender": "Female",
                "cluster_id": "cluster-khurja-pottery",
                "state": "Uttar Pradesh",
                "district": "Bulandshahr",
                "village": "Munda Khera",
                "latitude": 28.2450,
                "longitude": 77.8420,
                "primary_craft": "Khurja Pottery",
                "experience_years": 11,
                "monthly_capacity_units": 240,
                "daily_capacity_units": 8.0,
                "profile_photo_url": "/static/profiles/sunita_sharma.jpg",
                "preferred_language": "hi",
            },

            # Madhubani Painting
            {
                "id": "art-madhubani-001",
                "full_name": "Sita Devi Paswan",
                "phone_number": "+919876543207",
                "raw_aadhaar": "567890123456",
                "social_category": "SC",
                "gender": "Female",
                "cluster_id": "cluster-madhubani-painting",
                "state": "Bihar",
                "district": "Madhubani",
                "village": "Jitwarpur",
                "latitude": 26.3610,
                "longitude": 86.0820,
                "primary_craft": "Madhubani Painting",
                "experience_years": 26,
                "monthly_capacity_units": 45,
                "daily_capacity_units": 1.50,
                "profile_photo_url": "/static/profiles/sita_paswan.jpg",
                "preferred_language": "hi",
            },
            {
                "id": "art-madhubani-002",
                "full_name": "Manju Kumari Jha",
                "phone_number": "+919876543208",
                "raw_aadhaar": "587654321097",
                "social_category": "General",
                "gender": "Female",
                "cluster_id": "cluster-madhubani-painting",
                "state": "Bihar",
                "district": "Madhubani",
                "village": "Ranti",
                "latitude": 26.3480,
                "longitude": 86.0640,
                "primary_craft": "Madhubani Painting",
                "experience_years": 15,
                "monthly_capacity_units": 35,
                "daily_capacity_units": 1.17,
                "profile_photo_url": "/static/profiles/manju_jha.jpg",
                "preferred_language": "hi",
            },

            # Channapatna Toys
            {
                "id": "art-channapatna-001",
                "full_name": "Syed Khaleel Ur Rehman",
                "phone_number": "+919876543209",
                "raw_aadhaar": "678901234567",
                "social_category": "OBC",
                "gender": "Male",
                "cluster_id": "cluster-channapatna-toys",
                "state": "Karnataka",
                "district": "Ramanagara",
                "village": "Channapatna Old Town",
                "latitude": 12.6560,
                "longitude": 77.2140,
                "primary_craft": "Channapatna Toys",
                "experience_years": 21,
                "monthly_capacity_units": 520,
                "daily_capacity_units": 17.33,
                "profile_photo_url": "/static/profiles/syed_khaleel.jpg",
                "preferred_language": "kn",
            },
            {
                "id": "art-channapatna-002",
                "full_name": "Gowramma N.",
                "phone_number": "+919876543210",
                "raw_aadhaar": "698765432108",
                "social_category": "SC",
                "gender": "Female",
                "cluster_id": "cluster-channapatna-toys",
                "state": "Karnataka",
                "district": "Ramanagara",
                "village": "Honganur",
                "latitude": 12.6390,
                "longitude": 77.1950,
                "primary_craft": "Channapatna Toys",
                "experience_years": 13,
                "monthly_capacity_units": 360,
                "daily_capacity_units": 12.0,
                "profile_photo_url": "/static/profiles/gowramma.jpg",
                "preferred_language": "kn",
            }
        ]

        created_artisans = {}
        for adata in artisans_data:
            # Process raw Aadhaar using Verhoeff generation & sovereign hashing vault
            valid_aadhaar = generate_valid_aadhaar(adata["raw_aadhaar"])
            vault_result = MaskedAadhaarVault.process_and_mask(valid_aadhaar)
            
            artisan = Artisan(
                id=adata["id"],
                full_name=adata["full_name"],
                phone_number=adata["phone_number"],
                masked_aadhaar=vault_result.masked_aadhaar,
                aadhaar_hash=vault_result.aadhaar_hash,
                social_category=adata["social_category"],
                gender=adata["gender"],
                cluster_id=adata["cluster_id"],
                state=adata["state"],
                district=adata["district"],
                village=adata["village"],
                latitude=adata["latitude"],
                longitude=adata["longitude"],
                primary_craft=adata["primary_craft"],
                experience_years=adata["experience_years"],
                monthly_capacity_units=adata["monthly_capacity_units"],
                daily_capacity_units=adata["daily_capacity_units"],
                profile_photo_url=adata["profile_photo_url"],
                preferred_language=adata["preferred_language"],
                is_active=True
            )
            db.add(artisan)
            created_artisans[adata["id"]] = artisan
            
            # Add DPDP affirmative consent log for registration
            consent = ConsentLog(
                artisan_id=adata["id"],
                consent_type="DATA_COLLECTION",
                granted=True,
                purpose="Artisan registration and smart marketplace cataloging under MoSJE scheme",
                language=adata["preferred_language"],
                consent_artifact_type="VISUAL_TOUCH"
            )
            db.add(consent)

        db.flush()
        logger.info(f"Seeded {len(created_artisans)} artisan profiles with DPDP consent logs.")

        # ==============================================================================
        # 3. PRODUCTION CATALOG (DYNAMICALLY POPULATED BY AUTHENTIC ARTISAN UPLOADS)
        # ==============================================================================
        products_data = []

        for pdata in products_data:
            product = Product(**pdata)
            db.add(product)
        db.flush()
        logger.info("Initialized fresh product catalog ready for authentic artisan uploads.")

        # ==============================================================================
        # 4. PRICING BENCHMARKS SPECIFICATION (MARKET BASELINES & 768-DIM EMBEDDINGS)
        # ==============================================================================
        benchmarks_data = [
            # Varanasi Silk Benchmarks
            {
                "id": "bench-vns-001",
                "cluster_id": "cluster-varanasi-silk",
                "craft_type": "Varanasi Silk",
                "item_name": "Authentic Banarasi Katan Silk Brocade Saree",
                "category": "Handloom Sarees",
                "materials": ["Katan Silk", "Gold Zari", "Silver Metallic Weft"],
                "standard_labor_hours": 50.0,
                "benchmark_floor_price": 7200.0,
                "benchmark_retail_price": 12800.0,
                "benchmark_wholesale_price": 9200.0,
                "sample_image_url": "/static/benchmarks/banarasi_saree_bench.jpg",
                "visual_embedding": generate_cluster_embedding(101, 10),
                "tags": ["Banarasi Silk", "Katan", "Zari", "Wedding Saree"]
            },
            {
                "id": "bench-vns-002",
                "cluster_id": "cluster-varanasi-silk",
                "craft_type": "Varanasi Silk",
                "item_name": "Banarasi Pure Tanchoi Silk Stole / Dupatta",
                "category": "Scarves & Stoles",
                "materials": ["Mulberry Silk", "Colored Silk Weft"],
                "standard_labor_hours": 18.0,
                "benchmark_floor_price": 2400.0,
                "benchmark_retail_price": 4500.0,
                "benchmark_wholesale_price": 3100.0,
                "sample_image_url": "/static/benchmarks/banarasi_dupatta_bench.jpg",
                "visual_embedding": generate_cluster_embedding(101, 20),
                "tags": ["Banarasi Silk", "Tanchoi", "Dupatta", "Handloom"]
            },

            # Bastar Dhokra Benchmarks
            {
                "id": "bench-bst-001",
                "cluster_id": "cluster-bastar-dhokra",
                "craft_type": "Bastar Dhokra",
                "item_name": "Bastar Tribal Nandi Brass Figurine 15cm",
                "category": "Metal Sculptures",
                "materials": ["Recycled Brass", "Natural Beeswax", "River Clay"],
                "standard_labor_hours": 24.0,
                "benchmark_floor_price": 1650.0,
                "benchmark_retail_price": 2900.0,
                "benchmark_wholesale_price": 2050.0,
                "sample_image_url": "/static/benchmarks/dhokra_nandi_bench.jpg",
                "visual_embedding": generate_cluster_embedding(202, 10),
                "tags": ["Bastar Dhokra", "Nandi Bull", "Brass Figurine", "Lost Wax"]
            },
            {
                "id": "bench-bst-002",
                "cluster_id": "cluster-bastar-dhokra",
                "craft_type": "Bastar Dhokra",
                "item_name": "Bastar Dhokra Tribal Wall Hanging Lamp / Diya",
                "category": "Home Decor & Lighting",
                "materials": ["Brass Scrap", "Beeswax", "Clay"],
                "standard_labor_hours": 16.0,
                "benchmark_floor_price": 1200.0,
                "benchmark_retail_price": 2100.0,
                "benchmark_wholesale_price": 1500.0,
                "sample_image_url": "/static/benchmarks/dhokra_lamp_bench.jpg",
                "visual_embedding": generate_cluster_embedding(202, 20),
                "tags": ["Bastar Dhokra", "Tribal Diya", "Hanging Lamp", "Brass"]
            },
            {
                "id": "bench-bst-003",
                "cluster_id": "cluster-bastar-dhokra",
                "craft_type": "Bastar Dhokra",
                "item_name": "Bastar Dhokra Tribal Musician Quintet Set",
                "category": "Metal Figurines",
                "materials": ["Bell Metal Brass", "Beeswax", "Clay"],
                "standard_labor_hours": 40.0,
                "benchmark_floor_price": 3100.0,
                "benchmark_retail_price": 5400.0,
                "benchmark_wholesale_price": 3900.0,
                "sample_image_url": "/static/benchmarks/dhokra_musicians_bench.jpg",
                "visual_embedding": generate_cluster_embedding(202, 30),
                "tags": ["Bastar Dhokra", "Tribal Musicians", "Bell Metal"]
            },

            # Khurja Pottery Benchmarks
            {
                "id": "bench-khj-001",
                "cluster_id": "cluster-khurja-pottery",
                "craft_type": "Khurja Pottery",
                "item_name": "Hand-Painted Khurja Ceramic Flower Vase 28cm",
                "category": "Ceramics & Vases",
                "materials": ["China Clay", "Cobalt Glaze", "Feldspar"],
                "standard_labor_hours": 12.0,
                "benchmark_floor_price": 920.0,
                "benchmark_retail_price": 1700.0,
                "benchmark_wholesale_price": 1200.0,
                "sample_image_url": "/static/benchmarks/khurja_vase_bench.jpg",
                "visual_embedding": generate_cluster_embedding(303, 10),
                "tags": ["Khurja Pottery", "Ceramic Vase", "Cobalt Blue"]
            },
            {
                "id": "bench-khj-002",
                "cluster_id": "cluster-khurja-pottery",
                "craft_type": "Khurja Pottery",
                "item_name": "Khurja Glazed Stoneware Dinner Plate Set (6 Pcs)",
                "category": "Tableware",
                "materials": ["Kaolin Clay", "Quartz", "Food-Safe Ceramic Glaze"],
                "standard_labor_hours": 20.0,
                "benchmark_floor_price": 1600.0,
                "benchmark_retail_price": 2900.0,
                "benchmark_wholesale_price": 2100.0,
                "sample_image_url": "/static/benchmarks/khurja_dinner_bench.jpg",
                "visual_embedding": generate_cluster_embedding(303, 20),
                "tags": ["Khurja Pottery", "Stoneware Plates", "Tableware", "Ceramic"]
            },

            # Madhubani Painting Benchmarks
            {
                "id": "bench-mdb-001",
                "cluster_id": "cluster-madhubani-painting",
                "craft_type": "Madhubani Painting",
                "item_name": "Madhubani Tree of Life Painting A3 Framed",
                "category": "Folk Paintings",
                "materials": ["Handmade Paper", "Natural Botanical Dyes", "Soot"],
                "standard_labor_hours": 20.0,
                "benchmark_floor_price": 1200.0,
                "benchmark_retail_price": 2300.0,
                "benchmark_wholesale_price": 1650.0,
                "sample_image_url": "/static/benchmarks/madhubani_tree_bench.jpg",
                "visual_embedding": generate_cluster_embedding(404, 10),
                "tags": ["Madhubani Painting", "Tree of Life", "Mithila Art", "Natural Dyes"]
            },
            {
                "id": "bench-mdb-002",
                "cluster_id": "cluster-madhubani-painting",
                "craft_type": "Madhubani Painting",
                "item_name": "Madhubani Kohbar Auspicious Wedding Canvas 60x40cm",
                "category": "Folk Paintings",
                "materials": ["Tussar Silk Canvas", "Natural Dyes", "Bamboo Stylus"],
                "standard_labor_hours": 36.0,
                "benchmark_floor_price": 2300.0,
                "benchmark_retail_price": 4300.0,
                "benchmark_wholesale_price": 3050.0,
                "sample_image_url": "/static/benchmarks/madhubani_kohbar_bench.jpg",
                "visual_embedding": generate_cluster_embedding(404, 20),
                "tags": ["Madhubani Painting", "Kohbar", "Wedding Art", "Mithila"]
            },

            # Channapatna Toys Benchmarks
            {
                "id": "bench-cpn-001",
                "cluster_id": "cluster-channapatna-toys",
                "craft_type": "Channapatna Toys",
                "item_name": "Channapatna Classic 7-Tier Rainbow Stacking Ring",
                "category": "Wooden Toys",
                "materials": ["Ivory Wood", "Natural Vegetable Lacquer", "Organic Pigments"],
                "standard_labor_hours": 6.0,
                "benchmark_floor_price": 570.0,
                "benchmark_retail_price": 1100.0,
                "benchmark_wholesale_price": 780.0,
                "sample_image_url": "/static/benchmarks/channapatna_stacker_bench.jpg",
                "visual_embedding": generate_cluster_embedding(505, 10),
                "tags": ["Channapatna Toys", "Stacking Rings", "Wooden Toy", "Baby Safe"]
            },
            {
                "id": "bench-cpn-002",
                "cluster_id": "cluster-channapatna-toys",
                "craft_type": "Channapatna Toys",
                "item_name": "Channapatna Hand-Turned Rocking Horse Wooden Toy",
                "category": "Wooden Toys",
                "materials": ["Wrightia Tinctoria Wood", "Lacquer Polish", "Natural Dyes"],
                "standard_labor_hours": 12.0,
                "benchmark_floor_price": 1150.0,
                "benchmark_retail_price": 2150.0,
                "benchmark_wholesale_price": 1550.0,
                "sample_image_url": "/static/benchmarks/channapatna_horse_bench.jpg",
                "visual_embedding": generate_cluster_embedding(505, 20),
                "tags": ["Channapatna Toys", "Rocking Horse", "Hand Turned Toy"]
            }
        ]

        for bdata in benchmarks_data:
            benchmark = PricingBenchmark(**bdata)
            db.add(benchmark)
        db.flush()
        logger.info(f"Seeded {len(benchmarks_data)} pricing benchmarks with 768-dim visual embeddings.")

        db.commit()
        logger.info("Database seeding completed successfully! All 5 craft clusters, artisans, products, and benchmarks active.")
        return True

    except Exception as e:
        logger.error(f"Seeding failed: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
