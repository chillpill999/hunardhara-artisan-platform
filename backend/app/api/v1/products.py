import os
import uuid
import math
import random
import logging
import hashlib
from datetime import datetime, timezone
from typing import List, Optional
from PIL import Image
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status, Header
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import CurrentUser, require_artisan, require_admin, RateLimiter
from app.core.storage_security import (
    validate_uploaded_file,
    generate_secure_filename,
    delete_stored_file,
    ALLOWED_CATEGORIES,
    resolve_safe_storage_path,
)
from app.models.product import Product
from app.models.artisan import Artisan
from app.models.craft_cluster import CraftCluster
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductFilter
from app.schemas.studio import StudioResponse, StudioMetadata
from app.schemas.voice import VoiceCatalogResponse
from app.schemas.image_understanding import ImageUnderstandingResponse
from app.services.studio_service import studio_service
from app.services.voice_service import voice_service
from app.services.pricing_service import pricing_service
from app.services.openrouter_service import openrouter_service
from app.services.embedding_service import embedding_service
from app.services.platform_settings_service import platform_settings_service

logger = logging.getLogger("artisan_platform.api.products")
router = APIRouter(prefix="/products", tags=["Products & AI Pipelines"])


@router.post(
    "/studio",
    response_model=StudioResponse,
    summary="AI Product Photo Studio",
    dependencies=[Depends(RateLimiter(max_requests=10, window_seconds=60, prefix="studio"))]
)
async def product_studio_upload(
    image: UploadFile = File(..., description="Raw handicraft photo to isolate and ground"),
    canvas_size: int = Form(1080, description="Square canvas dimension (default 1080px)"),
    current_user: CurrentUser = Depends(require_artisan)
):
    """
    R1 Photo Studio Pipeline:
    Removes clutter, synthesizes procedural contact/ambient shadows on 1:1 canvas,
    purges GPS EXIF tags, and generates Before/After preview.
    Requires authenticated artisan or admin.
    """
    if not image.filename:
        raise HTTPException(status_code=400, detail="INVALID_IMAGE_DATA: Filename missing")

    image_bytes = await image.read()
    canonical_ext = validate_uploaded_file(
        data=image_bytes,
        original_filename=image.filename,
        expected_type="image",
        max_size_mb=15
    )
    safe_filename = generate_secure_filename(owner_id=current_user.id, extension=canonical_ext, prefix="studio")

    # Clamp canvas_size to safe bounded range (512px to 2048px) to prevent memory exhaustion DoS
    safe_canvas_size = max(512, min(int(canvas_size), 2048))

    try:
        result = studio_service.process_image_bytes(
            image_bytes=image_bytes,
            owner_id=current_user.id,
            original_filename=safe_filename,
            canvas_size=safe_canvas_size
        )
        return StudioResponse(
            studio_image_url=result["studio_image_url"],
            before_after_preview_url=result["before_after_preview_url"],
            metadata=StudioMetadata(**result["metadata"])
        )
    except Exception as e:
        logger.error(f"Studio pipeline failed: {e}")
        raise HTTPException(status_code=400, detail=f"STUDIO_PROCESSING_ERROR: {str(e)}")


@router.post(
    "/analyze-image",
    response_model=ImageUnderstandingResponse,
    summary="AI Craft Image Understanding (Gemma 4 31B)",
    dependencies=[Depends(RateLimiter(max_requests=10, window_seconds=60, prefix="analyze_image"))]
)
async def product_analyze_image(
    image: UploadFile = File(..., description="Craft photo to analyze"),
    hint: Optional[str] = Form(None, description="Optional artisan craft hint or cluster context"),
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """
    Multimodal Craft Image Understanding Pipeline (Google Gemma 4 31B):
    Visually inspects craft photos to detect GI craft cluster, traditional materials,
    artisan technique, and auto-generates bilingual e-commerce catalog listings.
    Requires authenticated artisan or admin.
    """
    if not platform_settings_service.is_enabled(db, "ai_catalog_enabled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI_CATALOG_PAUSED: AI multimodal analysis is temporarily suspended by platform administrators."
        )

    if not image.filename:
        raise HTTPException(status_code=400, detail="INVALID_IMAGE_DATA: Filename missing")

    image_bytes = await image.read()
    canonical_ext = validate_uploaded_file(
        data=image_bytes,
        original_filename=image.filename,
        expected_type="image",
        max_size_mb=15
    )

    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    mime_type = mime_map.get(canonical_ext, "image/jpeg")
    try:
        res = openrouter_service.analyze_craft_image(
            image_bytes=image_bytes,
            mime_type=mime_type,
            hint=hint
        )
        if not res.success:
            raise HTTPException(status_code=502, detail=res.error or "IMAGE_ANALYSIS_FAILED")
        return res
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"IMAGE_ANALYSIS_ERROR: {str(e)}")


@router.post(
    "/voice-catalog",
    response_model=VoiceCatalogResponse,
    summary="Indic Voice-to-Catalog",
    dependencies=[Depends(RateLimiter(max_requests=15, window_seconds=60, prefix="voice_catalog"))]
)
async def product_voice_catalog_upload(
    audio: UploadFile = File(..., description="Voice recording audio (.opus / .wav / .m4a)"),
    language_code: str = Form("hi", description="ISO 639 Indic language code"),
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """
    R2 Voice-to-Catalog Pipeline:
    Extracts structured craft attributes, bilingual marketing descriptions, and SEO tags.
    Requires authenticated artisan or admin.
    """
    if not platform_settings_service.is_enabled(db, "voice_catalog_enabled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="VOICE_CATALOG_PAUSED: Voice-to-catalog pipeline is temporarily suspended by platform administrators."
        )

    if not audio.filename:
        raise HTTPException(status_code=400, detail="INVALID_AUDIO_FORMAT_OR_CORRUPT")

    audio_bytes = await audio.read()
    canonical_ext = validate_uploaded_file(
        data=audio_bytes,
        original_filename=audio.filename,
        expected_type="audio",
        max_size_mb=settings.UPLOAD_MAX_SIZE_MB
    )
    safe_audio_fn = generate_secure_filename(owner_id=current_user.id, extension=canonical_ext, prefix="voice")

    try:
        return voice_service.process_audio_bytes(
            audio_bytes=audio_bytes,
            filename=audio.filename if settings.OFFLINE_MODE else safe_audio_fn,
            language_code=language_code
        )
    except ValueError as ve:
        err_msg = str(ve)
        if "AUDIO_SILENT" in err_msg or "INCOMPREHENSIBLE" in err_msg or "silence" in err_msg.lower():
            raise HTTPException(status_code=400, detail="AUDIO_SILENT_OR_INCOMPREHENSIBLE")
        if "CORRUPT" in err_msg or "INVALID" in err_msg:
            raise HTTPException(status_code=400, detail="INVALID_AUDIO_FORMAT_OR_CORRUPT")
        if "ASR_TRANSCRIPTION_FAILED" in err_msg or "AI_EXTRACTION_FAILED" in err_msg:
            raise HTTPException(status_code=502, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except RuntimeError as re:
        logger.error(f"Configuration error during voice processing: {re}")
        raise HTTPException(status_code=500, detail=str(re))
    except Exception as e:
        logger.error(f"Voice processing failed: {e}")
        raise HTTPException(status_code=400, detail=f"VOICE_PROCESSING_ERROR: {str(e)}")


def _resolve_image_for_embedding(image_url: Optional[str]) -> Optional[Image.Image]:
    """
    Resolves a stored image URL or file path to a PIL Image instance.
    Loads actual image pixels for computing genuine SigLIP visual feature vectors.
    """
    if not image_url:
        return None
    try:
        path_str = image_url.strip()
        if path_str.startswith("http://") or path_str.startswith("https://"):
            path_str = "/" + path_str.split("://", 1)[1].split("/", 1)[-1]

        candidates = []
        # 1. /storage/files/{category}/{filename}
        if "/storage/files/" in path_str:
            sub = path_str.split("/storage/files/", 1)[1].split("?")[0]
            parts = sub.split("/", 1)
            if len(parts) == 2 and parts[0] in ALLOWED_CATEGORIES:
                try:
                    candidates.append(resolve_safe_storage_path(parts[0], parts[1]))
                except Exception:
                    pass

        # 2. /static/{subdir}/{filename}
        if path_str.startswith("/static/"):
            rel_static = path_str[len("/static/"):].split("?")[0]
            safe_rel = os.path.normpath(rel_static).lstrip("\\/")
            if ".." not in safe_rel:
                candidates.append(os.path.join(settings.STATIC_DIR, safe_rel))
                backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
                candidates.append(os.path.join(backend_dir, "static", safe_rel))
                root_dir = os.path.abspath(os.path.join(backend_dir, ".."))
                candidates.append(os.path.join(root_dir, "static", safe_rel))

        # 3. Direct filesystem paths
        if os.path.isabs(path_str):
            candidates.append(path_str)
        else:
            candidates.append(os.path.join(os.getcwd(), path_str))
            candidates.append(os.path.join(settings.STORAGE_DIR, path_str))

        for c in candidates:
            if c and os.path.isfile(c):
                try:
                    img = Image.open(c)
                    img.load()
                    return img
                except Exception as img_err:
                    logger.warning(f"Failed opening image candidate at {c}: {img_err}")
    except Exception as e:
        logger.warning(f"Failed to resolve image for embedding from '{image_url}': {e}")
    return None


def _validate_media_url_ownership(
    media_url: Optional[str],
    owner_id: str,
    is_admin: bool = False,
    field_name: str = "media_url"
) -> None:
    """
    Validates that a client-supplied media URL belongs to the target owner if it points
    to private storage or user-scoped studio directories, preventing cross-user file association or unauthorized deletion.
    """
    if not media_url:
        return

    clean_url = media_url.strip()
    if ".." in clean_url or "\x00" in clean_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"INVALID_{field_name.upper()}: Path traversal sequence detected in media URL."
        )

    if is_admin:
        return

    owner_hash = hashlib.sha256(owner_id.encode("utf-8")).hexdigest()[:8]
    norm_url = clean_url.replace("\\", "/")

    # 1. Check if URL points to private storage
    if "/storage/files/" in norm_url:
        sub = norm_url.split("/storage/files/", 1)[1].split("?")[0]
        parts = sub.split("/", 1)
        if len(parts) == 2:
            cat, filename = parts
            if cat in ALLOWED_CATEGORIES:
                parts_fn = os.path.splitext(filename)[0].split("_")
                hashes_in_fn = [p.lower() for p in parts_fn if len(p) == 8 and all(ch in "0123456789abcdefABCDEF" for ch in p)]
                if hashes_in_fn and owner_hash not in hashes_in_fn:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"FORBIDDEN_FILE_ACCESS: Cannot attach private storage file in {field_name} belonging to another user."
                    )

    # 2. Check if URL points to static studio
    if norm_url.startswith("/static/studio/"):
        filename = norm_url[len("/static/studio/"):].split("?")[0]
        parts_fn = os.path.splitext(filename)[0].split("_")
        hashes_in_fn = [p.lower() for p in parts_fn if len(p) == 8 and all(ch in "0123456789abcdefABCDEF" for ch in p)]
        if hashes_in_fn and owner_hash not in hashes_in_fn:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"FORBIDDEN_FILE_ACCESS: Cannot attach studio output file in {field_name} belonging to another user."
            )


@router.post(
    "",
    response_model=ProductResponse,
    status_code=201,
    summary="Create Product Listing with Price Floor Guardrail",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="product_create"))]
)
def create_product(
    product_in: ProductCreate,
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """
    R6 Server-Side HTTP 422 Price Floor Guardrail & RBAC:
    Requires authenticated artisan or admin role.
    Rejects any marketplace listing priced below the certified cost-plus anti-exploitation floor.
    Guarantees idempotency via X-Idempotency-Key header or idempotency_key payload.
    """
    if not platform_settings_service.is_enabled(db, "product_publishing_enabled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PRODUCT_PUBLISHING_PAUSED: Product publishing is temporarily suspended by platform administrators."
        )
    if not platform_settings_service.is_enabled(db, "marketplace_enabled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MARKETPLACE_PAUSED: The marketplace is currently paused by platform administrators."
        )

    # 0. Idempotency Check: Safely return existing product on retries
    effective_idempotency_key = (x_idempotency_key or product_in.idempotency_key)
    if effective_idempotency_key:
        effective_idempotency_key = effective_idempotency_key.strip()
        existing = db.query(Product).filter(Product.idempotency_key == effective_idempotency_key).first()
        if existing:
            if not current_user.is_admin and existing.artisan_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="FORBIDDEN_IDEMPOTENCY_KEY: This idempotency key belongs to another artisan."
                )
            logger.info(f"Idempotent replay: Returning existing product '{existing.id}' for key '{effective_idempotency_key}'")
            return existing

    # 1. Enforce strict numeric and stock validation
    if product_in.cost_materials < 0:
        raise HTTPException(status_code=400, detail="INVALID_COST: Material cost cannot be negative.")
    if product_in.labor_hours <= 0:
        raise HTTPException(status_code=400, detail="INVALID_HOURS: Labor hours must be greater than zero.")
    if product_in.stock_quantity < 0:
        raise HTTPException(status_code=400, detail="INVALID_STOCK: Stock quantity cannot be negative.")
    if product_in.listing_price <= 0:
        raise HTTPException(status_code=400, detail="INVALID_PRICE: Listing price must be greater than zero.")

    # 1. Resolve cluster and validate foreign key
    cluster = db.query(CraftCluster).filter(CraftCluster.id == product_in.cluster_id).first()
    if not cluster:
        base_id = product_in.cluster_id.rsplit("-", 1)[0] if "-" in product_in.cluster_id else product_in.cluster_id
        cluster = db.query(CraftCluster).filter(CraftCluster.id == base_id).first()
    if not cluster:
        # Tighter match: exact case-insensitive match on craft_name or cluster name (avoid ambiguous loose substrings)
        cluster = db.query(CraftCluster).filter(
            (CraftCluster.craft_name.ilike(product_in.cluster_id)) | (CraftCluster.name.ilike(product_in.cluster_id))
        ).first()
    if not cluster:
        raise HTTPException(
            status_code=400,
            detail=f"INVALID_CLUSTER_ID: Craft cluster '{product_in.cluster_id}' does not exist in verified database."
        )

    # 2. Enforce artisan ownership & validate foreign key
    if not current_user.is_admin:
        product_in.artisan_id = current_user.id
    else:
        if not product_in.artisan_id:
            product_in.artisan_id = current_user.id

    # Enforce registered artisan check: must exist in database
    artisan_record = db.query(Artisan).filter(Artisan.id == product_in.artisan_id).first()
    if not artisan_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ARTISAN_NOT_FOUND: Artisan '{product_in.artisan_id}' is not onboarded in certified database."
        )
    if not artisan_record.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ARTISAN_DEACTIVATED: This artisan account has been deactivated."
        )

    # Validate media URLs ownership to prevent cross-user file association or unauthorized deletion
    _validate_media_url_ownership(product_in.raw_photo_url, owner_id=product_in.artisan_id, is_admin=current_user.is_admin, field_name="raw_photo_url")
    _validate_media_url_ownership(product_in.raw_audio_url, owner_id=product_in.artisan_id, is_admin=current_user.is_admin, field_name="raw_audio_url")
    _validate_media_url_ownership(product_in.studio_image_url, owner_id=product_in.artisan_id, is_admin=current_user.is_admin, field_name="studio_image_url")
    _validate_media_url_ownership(product_in.before_after_preview_url, owner_id=product_in.artisan_id, is_admin=current_user.is_admin, field_name="before_after_preview_url")

    hourly_wage = max(cluster.statutory_hourly_wage, product_in.hourly_wage_rate or cluster.statutory_hourly_wage)

    # 3. Compute cost-plus floor
    computed_floor = pricing_service.calculate_floor(
        raw_material_cost=product_in.cost_materials,
        labor_hours=product_in.labor_hours,
        wage_rate=hourly_wage,
        consumables_rate=0.10
    )

    # 4. ENFORCE SERVER-SIDE HTTP 422 GUARDRAIL
    if product_in.listing_price < computed_floor:
        logger.warning(f"Price floor violation: listing {product_in.listing_price} < floor {computed_floor}")
        raise HTTPException(
            status_code=422,
            detail=f"PRICE_BELOW_STATUTORY_FLOOR: Listing price (₹{product_in.listing_price:.2f}) is strictly prohibited from being lower than the certified cost-plus floor price (₹{computed_floor:.2f})."
        )

    # 5. Compute recommended tiers
    tiers = pricing_service.calculate_tiers(computed_floor)

    product_id = f"prod-{uuid.uuid4().hex[:12]}"
    qr_passport_id = f"qr-passport-{uuid.uuid4().hex[:8]}"

    dimensions_dict = product_in.dimensions.model_dump() if hasattr(product_in.dimensions, "model_dump") else product_in.dimensions

    # 6. Compute 768-dimensional visual embedding from actual product image
    visual_embedding = None
    target_img_url = product_in.studio_image_url or product_in.raw_photo_url
    if target_img_url:
        img = _resolve_image_for_embedding(target_img_url)
        if img:
            visual_embedding = embedding_service.generate_embedding_from_image(img)

    # Fallback to deterministic semantic text embedding if no image is uploaded or resolved
    if not visual_embedding:
        semantic_desc = f"{product_in.title} {product_in.craft_type} {product_in.technique} {' '.join(product_in.dominant_colors or [])}"
        visual_embedding = embedding_service.embed_text(semantic_desc)

    # 7. Authoritative Geographical Indication (GI) Separation
    # Craft-level registration: strictly derived from verified CraftCluster
    gi_craft_registered = False
    gi_registration_name = None
    gi_registration_reference = None
    gi_registered_region = None

    if cluster:
        tag_status = (cluster.gi_tag_status or "").lower()
        if cluster.gi_tag_number or "registered" in tag_status:
            gi_craft_registered = True
            gi_registration_name = cluster.craft_name
            gi_registration_reference = cluster.gi_tag_number or cluster.gi_tag_status
            gi_registered_region = f"{cluster.district}, {cluster.state}"

    # Artisan-level authorization: individual documentation required
    # Region + craft matching alone does NOT mark an artisan or product as certified
    doc_ref = (product_in.gi_authorization_document_reference or "").strip() or None
    gi_verif_date = None
    gi_verif_source = None

    if current_user.is_admin and product_in.gi_artisan_authorization_status == "AUTHORIZED" and doc_ref:
        gi_artisan_status = "AUTHORIZED"
        gi_verif_source = "MoSJE GI Registry Authority"
        gi_verif_date = datetime.now(timezone.utc)
    elif doc_ref:
        gi_artisan_status = "PENDING_REVIEW"
    else:
        gi_artisan_status = "NOT_PROVIDED"

    # Product provenance status: independent batch verification required
    if current_user.is_admin and product_in.gi_product_provenance_status == "VERIFIED":
        gi_provenance_status = "VERIFIED"
    else:
        gi_provenance_status = "UNVERIFIED"

    product = Product(
        id=product_id,
        artisan_id=product_in.artisan_id,
        cluster_id=cluster.id,
        title=product_in.title,
        craft_type=product_in.craft_type,
        materials=product_in.materials,
        dimensions=dimensions_dict,
        production_time_hours=product_in.production_time_hours,
        technique=product_in.technique,
        dominant_colors=product_in.dominant_colors,
        cost_materials=product_in.cost_materials,
        labor_hours=product_in.labor_hours,
        hourly_wage_rate=hourly_wage,
        floor_price=computed_floor,
        recommended_retail_price=tiers["retail_price"],
        wholesale_b2b_price=tiers["wholesale_price"],
        listing_price=product_in.listing_price,
        stock_quantity=product_in.stock_quantity,
        description_hindi=product_in.description_hindi,
        description_english=product_in.description_english,
        seo_tags_hindi=product_in.seo_tags_hindi,
        seo_tags_english=product_in.seo_tags_english,
        raw_photo_url=product_in.raw_photo_url,
        studio_image_url=product_in.studio_image_url,
        before_after_preview_url=product_in.before_after_preview_url,
        raw_audio_url=product_in.raw_audio_url,
        transcription_regional=product_in.transcription_regional,
        transcription_english=product_in.transcription_english,
        visual_embedding=visual_embedding,
        is_active=True,
        qr_passport_id=qr_passport_id,
        idempotency_key=effective_idempotency_key,
        gi_craft_registered=gi_craft_registered,
        gi_registration_name=gi_registration_name,
        gi_registration_reference=gi_registration_reference,
        gi_registered_region=gi_registered_region,
        gi_artisan_authorization_status=gi_artisan_status,
        gi_authorization_document_reference=doc_ref,
        gi_product_provenance_status=gi_provenance_status,
        gi_verification_source=gi_verif_source,
        gi_verification_date=gi_verif_date
    )

    db.add(product)
    try:
        db.commit()
        db.refresh(product)
    except Exception as e:
        db.rollback()
        # If another concurrent request committed with this same idempotency_key just now, return it
        if effective_idempotency_key:
            concurrent_existing = db.query(Product).filter(Product.idempotency_key == effective_idempotency_key).first()
            if concurrent_existing:
                logger.info(f"Concurrent race resolved: returning existing product '{concurrent_existing.id}' for key '{effective_idempotency_key}'")
                return concurrent_existing
        logger.error(f"Failed to commit product '{product.id}' to database: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PRODUCT_CREATE_FAILED: Database commit failed. The product was not saved."
        )

    return product


@router.get("", response_model=List[ProductResponse], summary="List Marketplace Products")
def list_products(
    craft_type: Optional[str] = Query(None),
    cluster_id: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Product).filter(Product.is_active == True)
    if craft_type:
        query = query.filter(Product.craft_type.ilike(f"%{craft_type}%"))
    if cluster_id:
        query = query.filter(Product.cluster_id == cluster_id)
    if min_price is not None:
        query = query.filter(Product.listing_price >= min_price)
    if max_price is not None:
        query = query.filter(Product.listing_price <= max_price)

    return query.offset(offset).limit(limit).all()


@router.get("/artisan/my", response_model=List[ProductResponse], summary="List Authenticated Artisan's Own Products")
def get_my_products(
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """Returns products owned by the authenticated artisan."""
    target_ids = {current_user.id}
    artisan = db.query(Artisan).filter(
        (Artisan.id == current_user.id) | (getattr(Artisan, "user_id", Artisan.id) == current_user.id)
    ).first()
    if artisan:
        target_ids.add(artisan.id)
    return db.query(Product).filter(Product.artisan_id.in_(list(target_ids))).order_by(Product.created_at.desc()).all()


@router.get("/{product_id}", response_model=ProductResponse, summary="Get Product by ID")
def get_product(
    product_id: str,
    db: Session = Depends(get_db)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail=f"Product with ID '{product_id}' not found")
    return prod


@router.put("/{product_id}", response_model=ProductResponse, summary="Update Artisan Product")
def update_product(
    product_id: str,
    product_in: ProductUpdate,
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """
    Updates an existing product listing.
    Enforces strict ownership: only the owning artisan or an admin may update.
    """
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail=f"Product with ID '{product_id}' not found")

    if not current_user.is_admin and prod.artisan_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="FORBIDDEN_OWNERSHIP: You are not authorized to modify products belonging to another artisan."
        )

    update_data = product_in.model_dump(exclude_unset=True)
    # 1. Enforce ownership and primary key immutability
    update_data.pop("id", None)
    update_data.pop("artisan_id", None)
    update_data.pop("cluster_id", None)

    # 2. Validate numeric bounds if provided
    if "listing_price" in update_data and update_data["listing_price"] <= 0:
        raise HTTPException(status_code=400, detail="INVALID_PRICE: Listing price must be greater than zero.")
    if "stock_quantity" in update_data and update_data["stock_quantity"] < 0:
        raise HTTPException(status_code=400, detail="INVALID_STOCK: Stock quantity cannot be negative.")
    if "cost_materials" in update_data and update_data["cost_materials"] < 0:
        raise HTTPException(status_code=400, detail="INVALID_COST: Material cost cannot be negative.")
    if "labor_hours" in update_data and update_data["labor_hours"] <= 0:
        raise HTTPException(status_code=400, detail="INVALID_HOURS: Labor hours must be greater than zero.")

    # 3. Recompute and revalidate statutory price floor
    effective_cost = update_data.get("cost_materials", prod.cost_materials)
    effective_labor = update_data.get("labor_hours", prod.labor_hours)
    cluster = db.query(CraftCluster).filter(CraftCluster.id == prod.cluster_id).first()
    effective_wage = cluster.statutory_hourly_wage if cluster else prod.hourly_wage_rate

    computed_floor = pricing_service.calculate_floor(
        raw_material_cost=effective_cost,
        labor_hours=effective_labor,
        wage_rate=effective_wage,
        consumables_rate=0.10
    )
    effective_listing_price = update_data.get("listing_price", prod.listing_price)
    if effective_listing_price < computed_floor:
        raise HTTPException(
            status_code=422,
            detail=f"PRICE_BELOW_STATUTORY_FLOOR: Updated listing price (₹{effective_listing_price:.2f}) is strictly prohibited from being lower than the certified cost-plus floor price (₹{computed_floor:.2f})."
        )

    # 4. Update floor and pricing tiers
    tiers = pricing_service.calculate_tiers(computed_floor)
    prod.floor_price = computed_floor
    prod.recommended_retail_price = tiers["retail_price"]
    prod.wholesale_b2b_price = tiers["wholesale_price"]
    prod.hourly_wage_rate = effective_wage

    # 5. Guard GI updates
    update_data.pop("gi_craft_registered", None)
    update_data.pop("gi_registration_name", None)
    update_data.pop("gi_registration_reference", None)
    update_data.pop("gi_registered_region", None)

    if "gi_authorization_document_reference" in update_data:
        doc_ref = (update_data["gi_authorization_document_reference"] or "").strip()
        if doc_ref:
            update_data["gi_authorization_document_reference"] = doc_ref
            if not current_user.is_admin:
                update_data["gi_artisan_authorization_status"] = "PENDING_REVIEW"
        else:
            update_data["gi_authorization_document_reference"] = None
            if not current_user.is_admin:
                update_data["gi_artisan_authorization_status"] = "NOT_PROVIDED"

    if "gi_artisan_authorization_status" in update_data:
        req_status = update_data["gi_artisan_authorization_status"]
        if not current_user.is_admin:
            if req_status in ["AUTHORIZED", "REJECTED"]:
                raise HTTPException(
                    status_code=403,
                    detail="FORBIDDEN_GI_VERIFICATION: Only platform administrators can certify or reject artisan GI authorization."
                )
        else:
            if req_status == "AUTHORIZED":
                prod.gi_verification_source = update_data.get("gi_verification_source") or "MoSJE GI Administrative Audit"
                prod.gi_verification_date = datetime.now(timezone.utc)

    if "gi_product_provenance_status" in update_data:
        prov_status = update_data["gi_product_provenance_status"]
        if not current_user.is_admin and prov_status == "VERIFIED":
            raise HTTPException(
                status_code=403,
                detail="FORBIDDEN_PROVENANCE_VERIFICATION: Only platform administrators can verify physical product provenance."
            )

    for key, value in update_data.items():
        setattr(prod, key, value)
    prod.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(prod)
    return prod


@router.delete("/{product_id}", status_code=200, summary="Delete Artisan Product")
def delete_product(
    product_id: str,
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """
    Deletes an existing product listing.
    Enforces strict ownership: only the owning artisan or an admin may delete.
    """
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail=f"Product with ID '{product_id}' not found")

    target_ids = {current_user.id}
    artisan = db.query(Artisan).filter(
        (Artisan.id == current_user.id) | (getattr(Artisan, "user_id", Artisan.id) == current_user.id)
    ).first()
    if artisan:
        target_ids.add(artisan.id)

    if not current_user.is_admin and prod.artisan_id not in target_ids:
        raise HTTPException(
            status_code=403,
            detail="FORBIDDEN_OWNERSHIP: You are not authorized to delete products belonging to another artisan."
        )

    # Safe removal of associated stored files from disk
    delete_stored_file(prod.studio_image_url, owner_id=prod.artisan_id)
    delete_stored_file(prod.before_after_preview_url, owner_id=prod.artisan_id)
    delete_stored_file(prod.raw_photo_url, owner_id=prod.artisan_id)
    delete_stored_file(prod.raw_audio_url, owner_id=prod.artisan_id)

    db.delete(prod)
    db.commit()
    return {"status": "deleted", "id": product_id}

