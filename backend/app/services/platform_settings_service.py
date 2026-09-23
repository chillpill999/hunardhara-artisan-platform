import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.system_setting import SystemSetting
from app.models.admin_audit_log import AdminAuditLog

logger = logging.getLogger("artisan_platform.platform_settings")

DEFAULT_PLATFORM_SETTINGS: Dict[str, Any] = {
    "marketplace_enabled": True,
    "artisan_onboarding_enabled": True,
    "product_publishing_enabled": True,
    "b2b_enabled": True,
    "orders_enabled": True,
    "ai_catalog_enabled": True,
    "voice_catalog_enabled": True,
    "maintenance_mode": False,
    "maintenance_message": "हुनरधारा प्लेटफ़ॉर्म पर तकनीकी रखरखाव चल रहा है। कृपया कुछ समय बाद पुनः प्रयास करें। (Platform maintenance in progress. Please check back shortly.)"
}


class PlatformSettingsService:
    """
    Authoritative server-side platform configuration and emergency controls.
    Enforces persistent feature switches stored in the database.
    """

    def get_settings(self, db: Session) -> Dict[str, Any]:
        """
        Retrieves all platform settings from the database, falling back to defaults.
        """
        settings = dict(DEFAULT_PLATFORM_SETTINGS)
        rows = db.query(SystemSetting).all()
        for r in rows:
            if r.key in settings:
                val = r.value
                # Parse boolean values
                if isinstance(DEFAULT_PLATFORM_SETTINGS[r.key], bool):
                    settings[r.key] = val.lower() in ("true", "1", "yes")
                else:
                    settings[r.key] = val
        return settings

    def get_setting(self, db: Session, key: str, default: Any = None) -> Any:
        """
        Retrieves a single setting value.
        """
        row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if not row:
            return DEFAULT_PLATFORM_SETTINGS.get(key, default)
        val = row.value
        default_val = DEFAULT_PLATFORM_SETTINGS.get(key, default)
        if isinstance(default_val, bool):
            return val.lower() in ("true", "1", "yes")
        return val

    def is_enabled(self, db: Session, key: str) -> bool:
        """
        Convenience check for boolean switches.
        """
        val = self.get_setting(db, key, DEFAULT_PLATFORM_SETTINGS.get(key, True))
        return bool(val)

    def is_maintenance_mode(self, db: Session) -> bool:
        """
        Returns whether the platform is currently locked in emergency maintenance mode.
        """
        return self.is_enabled(db, "maintenance_mode")

    def update_settings(
        self,
        db: Session,
        updates: Dict[str, Any],
        actor_id: str,
        actor_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Atomically updates platform settings in the database and records an audit log.
        """
        old_settings = self.get_settings(db)
        applied_changes: Dict[str, Any] = {}

        for k, v in updates.items():
            if k not in DEFAULT_PLATFORM_SETTINGS:
                continue

            str_val = str(v).lower() if isinstance(v, bool) else str(v)
            row = db.query(SystemSetting).filter(SystemSetting.key == k).first()
            if row:
                row.value = str_val
                row.updated_at = datetime.now(timezone.utc)
            else:
                db.add(SystemSetting(key=k, value=str_val))

            applied_changes[k] = {
                "previous": old_settings.get(k),
                "new": v
            }

        # Log audit trail if changes were applied
        if applied_changes:
            audit = AdminAuditLog(
                action="UPDATE_PLATFORM_SETTINGS",
                actor_id=actor_id,
                actor_email=actor_email,
                target_user_id=None,
                details=json.dumps({
                    "action": "update_platform_switches",
                    "changes": applied_changes,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }, ensure_ascii=False)
            )
            db.add(audit)

        db.commit()
        logger.info(f"Platform settings updated by {actor_email or actor_id}: {list(applied_changes.keys())}")
        return self.get_settings(db)


platform_settings_service = PlatformSettingsService()
