import { ArtisanInquiry } from './types';
import { supabase } from './supabase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://hunardhara-artisan-platform.onrender.com/api/v1';
const STORAGE_KEY = 'hunardhara_artisan_inquiries';

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` };
    }
  } catch {}
  return {};
}

export function getAllInquiries(): ArtisanInquiry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: ArtisanInquiry[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Retrieves inquiries specifically addressed to the given artisan from local cache.
 */
export function getInquiriesForArtisan(artisanIdOrEmail?: string): ArtisanInquiry[] {
  const all = getAllInquiries();
  if (!artisanIdOrEmail) return all;

  const target = artisanIdOrEmail.toLowerCase().trim();

  const filtered = all.filter((inq) => {
    const inqArtisanId = (inq.artisan_id || '').toLowerCase();
    return inqArtisanId === target || !inqArtisanId || inqArtisanId.includes(target);
  });

  return filtered.length > 0 ? filtered : all;
}

/**
 * Authoritative: Syncs inquiries with FastAPI backend PostgreSQL database
 */
export async function syncInquiriesFromCloud(artisanIdOrEmail?: string): Promise<ArtisanInquiry[]> {
  try {
    const authHeaders = await getAuthHeader();
    const queryParam = artisanIdOrEmail ? `?artisan_id_override=${encodeURIComponent(artisanIdOrEmail)}` : '';
    const res = await fetch(`${API_BASE}/inquiries/artisan${queryParam}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const cloudMapped: ArtisanInquiry[] = data.map((d: any) => ({
          id: d.id,
          product_id: d.product_id || '',
          product_title: d.product_title,
          product_image: d.product_image,
          artisan_id: d.artisan_id,
          artisan_name: d.artisan_name,
          customer_name: d.customer_name,
          customer_phone: d.customer_phone,
          customer_email: d.customer_email,
          inquiry_type: d.inquiry_type || 'general',
          message: d.message,
          quantity: d.quantity,
          status: d.status || 'new',
          created_at: d.created_at || new Date().toISOString(),
        }));

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudMapped));
          window.dispatchEvent(new CustomEvent('hunardhara_inquiry_updated', { detail: { merged: true } }));
        }
        return cloudMapped;
      }
    }
  } catch (err) {
    console.warn('Sync backend inquiries note:', err);
  }

  // Fallback to local cache if network offline
  return getInquiriesForArtisan(artisanIdOrEmail);
}

/**
 * Saves a new buyer inquiry authoritatively through FastAPI backend into PostgreSQL.
 */
export function saveInquiry(
  data: Omit<ArtisanInquiry, 'id' | 'created_at' | 'status'>
): ArtisanInquiry {
  const localId = `inq-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const optimisticInquiry: ArtisanInquiry = {
    ...data,
    id: localId,
    status: 'new',
    created_at: new Date().toISOString(),
  };

  const all = getAllInquiries();
  const updated = [optimisticInquiry, ...all];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('hunardhara_new_inquiry', { detail: optimisticInquiry }));
    } catch (e) {
      console.warn('Failed to save inquiry to cache:', e);
    }
  }

  // Authoritative POST to FastAPI backend
  (async () => {
    try {
      const authHeaders = await getAuthHeader();
      const res = await fetch(`${API_BASE}/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          product_id: data.product_id,
          product_title: data.product_title,
          product_image: data.product_image,
          artisan_id: data.artisan_id,
          artisan_name: data.artisan_name,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          customer_email: data.customer_email,
          inquiry_type: data.inquiry_type || 'general',
          quantity: data.quantity,
          message: data.message,
        }),
      });

      if (res.ok) {
        const canonical = await res.json();
        const current = getAllInquiries();
        const replaced = current.map((item) => (item.id === localId ? { ...item, id: canonical.id } : item));
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(replaced));
          window.dispatchEvent(new CustomEvent('hunardhara_inquiry_updated', { detail: canonical }));
        }
      }
    } catch (err) {
      console.warn('Backend inquiry POST note:', err);
    }
  })();

  return optimisticInquiry;
}

/**
 * Updates the status of an inquiry (e.g. from 'new' to 'replied').
 */
export function updateInquiryStatus(id: string, status: ArtisanInquiry['status']): void {
  const all = getAllInquiries();
  const updated = all.map((inq) => (inq.id === id ? { ...inq, status } : inq));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('hunardhara_inquiry_updated', { detail: { id, status } }));
    } catch (e) {
      console.warn('Failed to update inquiry status:', e);
    }
  }

  // Authoritative status PATCH to FastAPI backend
  (async () => {
    try {
      const authHeaders = await getAuthHeader();
      await fetch(`${API_BASE}/inquiries/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      console.warn('Backend status update note:', err);
    }
  })();
}

/**
 * Deletes an inquiry authoritatively from PostgreSQL.
 */
export function deleteInquiry(id: string): void {
  const all = getAllInquiries();
  const updated = all.filter((inq) => inq.id !== id);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('hunardhara_inquiry_updated', { detail: { id, status: 'deleted' } }));
    } catch (e) {
      console.warn('Failed to delete inquiry:', e);
    }
  }

  // Authoritative DELETE to FastAPI backend
  (async () => {
    try {
      const authHeaders = await getAuthHeader();
      await fetch(`${API_BASE}/inquiries/${id}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
      });
    } catch (err) {
      console.warn('Backend delete inquiry note:', err);
    }
  })();
}
