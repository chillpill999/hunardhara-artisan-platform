import json
import logging
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, List

from app.core.config import settings

logger = logging.getLogger("artisan_platform.services.supabase_admin")


class SupabaseAdminService:
    """
    Trusted Server-Side Supabase Auth Administration Service.
    Uses the server-only SUPABASE_SERVICE_ROLE_KEY to manage user roles
    (super_admin, admin, artisan, customer) in Supabase Auth app_metadata.
    
    This service-role key is NEVER sent to the frontend or exposed in API responses.
    """

    def __init__(self):
        # In-memory mock store for testing and offline development
        self._local_user_roles: Dict[str, str] = {}
        self._local_users: Dict[str, Dict[str, Any]] = {}

    @property
    def is_configured(self) -> bool:
        return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)

    def set_user_role(self, user_id: str, role: str) -> Dict[str, Any]:
        """
        Updates a user's app_metadata.role in Supabase Auth.
        Supported roles: 'super_admin', 'admin', 'artisan', 'customer'.
        """
        valid_roles = {"super_admin", "admin", "artisan", "customer"}
        if role not in valid_roles:
            raise ValueError(f"Invalid role '{role}'. Must be one of {valid_roles}")

        # Always record in local store for immediate test consistency
        self._local_user_roles[user_id] = role
        if user_id in self._local_users:
            self._local_users[user_id]["role"] = role
            self._local_users[user_id]["app_metadata"]["role"] = role

        if not self.is_configured:
            logger.info(f"[Offline/Dev] Updated user {user_id} app_metadata.role to '{role}' in local admin store.")
            return {"user_id": user_id, "role": role, "provider": "local_mock"}

        url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{user_id}"
        payload = {
            "app_metadata": {
                "role": role
            }
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "Hunardhara-Platform/1.0",
            },
            method="PUT"
        )

        try:
            with urllib.request.urlopen(req, timeout=settings.EXTERNAL_TIMEOUT_SECONDS) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                logger.info(f"Successfully updated Supabase user {user_id} role to '{role}'.")
                return {"user_id": user_id, "role": role, "supabase_user": data, "provider": "supabase_admin"}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            logger.error(f"Supabase Admin API error updating user {user_id}: {e.code} - {err_body}")
            # Fall back to local recording rather than crashing the request
            return {"user_id": user_id, "role": role, "error": err_body, "provider": "local_fallback"}
        except Exception as e:
            logger.error(f"Network error calling Supabase Admin API: {e}")
            return {"user_id": user_id, "role": role, "error": str(e), "provider": "local_fallback"}

    def get_user_role(self, user_id: str) -> Optional[str]:
        """Returns the user's role from local cache if known."""
        return self._local_user_roles.get(user_id)

    def register_test_user(self, user_id: str, email: str, role: str) -> None:
        """Helper for test fixtures to register local users."""
        self._local_user_roles[user_id] = role
        self._local_users[user_id] = {
            "id": user_id,
            "email": email,
            "role": role,
            "app_metadata": {"role": role}
        }

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Queries Supabase Admin API or local store to find a user by their email.
        """
        clean_email = email.strip().lower()
        # Check local test store
        for uid, user_data in self._local_users.items():
            if str(user_data.get("email", "")).strip().lower() == clean_email:
                return user_data

        if not self.is_configured:
            return None

        url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users?page=1&per_page=100"
        req = urllib.request.Request(
            url,
            headers={
                "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=settings.EXTERNAL_TIMEOUT_SECONDS) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                users = data.get("users", [])
                for u in users:
                    if str(u.get("email", "")).strip().lower() == clean_email:
                        return u
        except Exception as e:
            logger.warning(f"Error querying Supabase Admin API for user by email: {e}")

        return None

    def list_admin_users(self) -> List[Dict[str, Any]]:
        """
        Returns a list of all users with 'super_admin' or 'admin' roles.
        """
        admins: List[Dict[str, Any]] = []

        # Check local test store
        for uid, user_data in self._local_users.items():
            if user_data.get("role") in ("super_admin", "admin"):
                admins.append(user_data)

        if not self.is_configured:
            return admins

        url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users?page=1&per_page=100"
        req = urllib.request.Request(
            url,
            headers={
                "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=settings.EXTERNAL_TIMEOUT_SECONDS) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                users = data.get("users", [])
                for u in users:
                    app_meta = u.get("app_metadata", {})
                    r = app_meta.get("role")
                    if r in ("super_admin", "admin"):
                        admins.append({
                            "id": u.get("id"),
                            "email": u.get("email"),
                            "role": r,
                            "created_at": u.get("created_at"),
                            "last_sign_in_at": u.get("last_sign_in_at"),
                        })
        except Exception as e:
            logger.warning(f"Could not list users from Supabase Admin API: {e}")

        return admins


supabase_admin = SupabaseAdminService()
