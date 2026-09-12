/**
 * HunarDhara Sovereign Administrative Access Control Module
 * Enforces strict email verification for the National Heritage Craft Governance Portal (/admin)
 */

export const PRIMARY_ADMIN_EMAIL = 'aryanrockstar2007@gmail.com';

// Authorised admin emails whitelist
const DEFAULT_AUTHORIZED_EMAILS: string[] = [
  PRIMARY_ADMIN_EMAIL,
];

/**
 * Retrieves the list of all currently authorized admin emails,
 * merging canonical email with any dynamically authorized emails in local storage.
 */
export function getAuthorisedAdminEmails(): string[] {
  const list = new Set<string>(DEFAULT_AUTHORIZED_EMAILS.map((e) => e.trim().toLowerCase()));

  // Check environment variables if defined
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AUTHORIZED_ADMIN_EMAILS) {
    process.env.NEXT_PUBLIC_AUTHORIZED_ADMIN_EMAILS.split(',').forEach((em) => {
      if (em.trim()) list.add(em.trim().toLowerCase());
    });
  }

  // Check browser dynamic storage (e.g. for live jury evaluation whitelist)
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('hunardhara_authorized_admins');
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((em) => {
            if (em && typeof em === 'string') list.add(em.trim().toLowerCase());
          });
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  return Array.from(list);
}

/**
 * Verifies whether the provided email address is authorized to access the Admin Governance Panel.
 */
export function isAuthorisedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  const authorizedList = getAuthorisedAdminEmails();
  return authorizedList.includes(clean);
}

/**
 * Dynamically grants administrative access to an email (stored in local browser session).
 */
export function addAuthorisedAdminEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const clean = email.trim().toLowerCase();
  const current = getAuthorisedAdminEmails();
  if (!current.includes(clean)) {
    const updated = [...current, clean];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hunardhara_authorized_admins', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('hunardhara_admin_whitelist_updated'));
      } catch {
        return false;
      }
    }
  }
  return true;
}

/**
 * Sets client-side cookie so Cloudflare Workers edge can verify on direct link navigation.
 */
export function setAdminAuthCookie(email: string): void {
  if (typeof document === 'undefined') return;
  const clean = email.trim().toLowerCase();
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  document.cookie = `hunardhara_admin_email=${encodeURIComponent(clean)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `hunardhara_auth_token=valid; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Clears administrator cookies on sign out.
 */
export function clearAdminAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = 'hunardhara_admin_email=; path=/; max-age=0; SameSite=Lax';
  document.cookie = 'hunardhara_auth_token=; path=/; max-age=0; SameSite=Lax';
}
