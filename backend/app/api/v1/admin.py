import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.core.security import (
    CurrentUser,
    get_current_user,
    get_optional_current_user,
    require_admin,
    require_super_admin,
    RateLimiter
)
from app.models.system_setting import SystemSetting
from app.models.admin_audit_log import AdminAuditLog
from app.services.supabase_admin import supabase_admin

logger = logging.getLogger("artisan_platform.api.admin")

router = APIRouter(prefix="/admin", tags=["Administrative & Super Admin Console"])


class BootstrapRequest(BaseModel):
    email: Optional[str] = None


class BootstrapResponse(BaseModel):
    success: bool
    bootstrapped: bool
    message: str
    email: Optional[str] = None
    role: Optional[str] = None


class BootstrapStatusResponse(BaseModel):
    bootstrapped: bool
    super_admin_email: Optional[str] = None


class AdminUserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    role: str
    created_at: Optional[str] = None
    last_sign_in_at: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: str
    action: str
    actor_id: str
    actor_email: Optional[str] = None
    target_user_id: Optional[str] = None
    details: Optional[str] = None
    created_at: str


@router.get(
    "/bootstrap-status",
    response_model=BootstrapStatusResponse,
    summary="Check Super Admin Bootstrap Status",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="bootstrap_status"))]
)
def get_bootstrap_status(db: Session = Depends(get_db)):
    """
    Public diagnostic endpoint: Reports whether the platform's initial Super Admin
    has been bootstrapped.
    """
    setting = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_bootstrapped").first()
    is_bootstrapped = bool(setting and setting.value == "true")
    email_setting = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_email").first()
    email_val = email_setting.value if is_bootstrapped and email_setting else None

    return BootstrapStatusResponse(
        bootstrapped=is_bootstrapped,
        super_admin_email=email_val
    )


@router.post(
    "/bootstrap-super-admin",
    response_model=BootstrapResponse,
    summary="One-Time Super Admin Bootstrap",
    dependencies=[Depends(RateLimiter(max_requests=5, window_seconds=60, prefix="bootstrap_super_admin"))]
)
def bootstrap_super_admin(
    payload: Optional[BootstrapRequest] = None,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Idempotent One-Time Super Admin Bootstrap:
    1. Checks if a Super Admin is already provisioned in the database.
       If yes -> immediately returns HTTP 409 Conflict.
    2. Verifies that the target email matches the designated initial identity:
       'aryanrockstar2007@gmail.com'. Rejects all other emails with HTTP 403.
    3. Provisions 'super_admin' role in Supabase Auth app_metadata via trusted server API.
    4. Permanently locks the bootstrap mechanism in system settings and logs audit trail.
    """
    # 1. Lockout check
    existing = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_bootstrapped").first()
    if existing and existing.value == "true":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="SUPER_ADMIN_ALREADY_EXISTS: A Super Admin has already been provisioned. The bootstrap system is permanently locked."
        )

    # 2. Determine target email and user_id
    target_email = (
        (current_user.email if current_user and current_user.email else None)
        or (payload.email if payload and payload.email else None)
        or settings.INITIAL_SUPER_ADMIN_EMAIL
    )
    target_email_clean = str(target_email).strip().lower()

    if target_email_clean != settings.INITIAL_SUPER_ADMIN_EMAIL.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"BOOTSTRAP_UNAUTHORIZED: Initial bootstrap is strictly restricted to the designated administrative identity ({settings.INITIAL_SUPER_ADMIN_EMAIL})."
        )

    # Resolve user_id from Supabase Admin API, active session, or deterministic identifier
    user_id = None
    supabase_user = supabase_admin.get_user_by_email(target_email_clean)
    if supabase_user and supabase_user.get("id"):
        user_id = str(supabase_user.get("id"))
    elif current_user and current_user.id:
        user_id = current_user.id
    else:
        user_id = f"sa-{target_email_clean.split('@')[0]}"

    # 3. Server-side Supabase role assignment
    supabase_admin.set_user_role(user_id, "super_admin")

    # 4. Lock bootstrap and record audit log
    db.merge(SystemSetting(key="super_admin_bootstrapped", value="true"))
    db.merge(SystemSetting(key="super_admin_user_id", value=user_id))
    db.merge(SystemSetting(key="super_admin_email", value=target_email_clean))
    db.merge(SystemSetting(key="super_admin_bootstrapped_at", value=datetime.now(timezone.utc).isoformat()))

    audit_entry = AdminAuditLog(
        action="BOOTSTRAP_SUPER_ADMIN",
        actor_id=user_id,
        actor_email=target_email_clean,
        target_user_id=user_id,
        details=json.dumps({
            "action": "one_time_super_admin_bootstrap",
            "email": target_email_clean,
            "role": "super_admin"
        })
    )
    db.add(audit_entry)
    db.commit()

    logger.info(f"Super Admin bootstrap completed for {target_email_clean} ({user_id})")

    return BootstrapResponse(
        success=True,
        bootstrapped=True,
        message=f"Super Admin role successfully provisioned for {target_email_clean}. Bootstrap mechanism is now permanently locked.",
        email=target_email_clean,
        role="super_admin"
    )


@router.get(
    "/admins",
    response_model=List[AdminUserResponse],
    summary="List Administrators (Super Admin Only)",
    dependencies=[Depends(RateLimiter(max_requests=20, window_seconds=60, prefix="list_admins"))]
)
def list_administrators(
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to list all users with administrative roles (super_admin, admin).
    """
    raw_admins = supabase_admin.list_admin_users()
    results: List[AdminUserResponse] = []

    # If list is empty from cloud API, check local system settings for super admin
    if not raw_admins:
        sa_email = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_email").first()
        sa_uid = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_user_id").first()
        if sa_email and sa_uid:
            results.append(AdminUserResponse(
                id=sa_uid.value,
                email=sa_email.value,
                role="super_admin",
                created_at=datetime.now(timezone.utc).isoformat()
            ))
        return results

    for a in raw_admins:
        results.append(AdminUserResponse(
            id=str(a.get("id", "")),
            email=a.get("email"),
            role=str(a.get("role", "admin")),
            created_at=a.get("created_at"),
            last_sign_in_at=a.get("last_sign_in_at")
        ))
    return results


@router.post(
    "/admins/{user_id}/grant",
    response_model=Dict[str, Any],
    summary="Grant Administrator Role (Super Admin Only)"
)
def grant_admin_role(
    user_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to grant 'admin' role to a user.
    """
    if user_id == current_user.id:
        return {"success": True, "message": "You are already Super Administrator.", "role": "super_admin"}

    res = supabase_admin.set_user_role(user_id, "admin")

    audit = AdminAuditLog(
        action="GRANT_ADMIN_ROLE",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=user_id,
        details=json.dumps({"granted_role": "admin", "actor_role": current_user.role})
    )
    db.add(audit)
    db.commit()

    return {"success": True, "user_id": user_id, "new_role": "admin", "details": res}


@router.post(
    "/admins/{user_id}/revoke",
    response_model=Dict[str, Any],
    summary="Revoke Administrator Role (Super Admin Only)"
)
def revoke_admin_role(
    user_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to demote an administrator back to 'customer'.
    Super Admins cannot revoke their own role to prevent complete administrative lockout.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CANNOT_REVOKE_SELF: Super Administrator cannot revoke their own role."
        )

    # Check if target is Super Admin
    sa_uid = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_user_id").first()
    if sa_uid and sa_uid.value == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CANNOT_REVOKE_SUPER_ADMIN: The primary Super Administrator role cannot be revoked."
        )

    res = supabase_admin.set_user_role(user_id, "customer")

    audit = AdminAuditLog(
        action="REVOKE_ADMIN_ROLE",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=user_id,
        details=json.dumps({"revoked_role": "admin", "new_role": "customer"})
    )
    db.add(audit)
    db.commit()

    return {"success": True, "user_id": user_id, "new_role": "customer", "details": res}


@router.get(
    "/audit-logs",
    response_model=List[AuditLogResponse],
    summary="Retrieve Platform Audit Logs (Admin / Super Admin)",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="audit_logs"))]
)
def get_admin_audit_logs(
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Administrative endpoint to inspect audit trail of administrative decisions,
    artisan application approvals, and role updates.
    """
    logs = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).offset(offset).limit(limit).all()
    results: List[AuditLogResponse] = []
    for l in logs:
        results.append(AuditLogResponse(
            id=l.id,
            action=l.action,
            actor_id=l.actor_id,
            actor_email=l.actor_email,
            target_user_id=l.target_user_id,
            details=l.details,
            created_at=l.created_at.isoformat() if l.created_at else datetime.now(timezone.utc).isoformat()
        ))
    return results
