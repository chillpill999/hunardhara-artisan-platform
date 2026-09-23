import { ArtisanInquiry } from './types';
import { supabase } from './supabase';

const API_BASE = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.NEXT_PUBLIC_API_URL || 'https://hunardhara-artisan-platform.onrender.com/api/v1');
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
 * Authoritative: Syncs inquiries with Supabase PostgreSQL database (primary)
 * and FastAPI backend database (fallback).
 */
export async function syncInquiriesFromCloud(artisanIdOrEmail?: string): Promise<ArtisanInquiry[]> {
  // 1. Primary path: Supabase Database directly
  try {
    let query = (supabase.from('artisan_inquiries') as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (artisanIdOrEmail) {
      query = query.or(`artisan_id.eq.${artisanIdOrEmail},artisan_id.is.null`);
    }

    const { data, error } = await query;

    if (!error && Array.isArray(data)) {
      const mapped: ArtisanInquiry[] = data.map((d: any) => ({
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        window.dispatchEvent(new CustomEvent('hunardhara_inquiry_updated', { detail: { merged: true } }));
      }
      return mapped;
    }
  } catch (supErr) {
    console.warn('Supabase inquiries sync failed, falling back to backend:', supErr);
  }

  // 2. Dual-path fallback: FastAPI backend
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
 * Saves a new buyer inquiry authoritatively through Supabase (primary) and FastAPI backend (fallback).
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

  // Authoritative Async Persistence
  (async () => {
    // 1. Primary: Supabase Insert
    try {
      const { data: inserted, error } = await (supabase.from('artisan_inquiries') as any)
        .insert({
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
          status: 'new',
        })
        .select()
        .single();

      if (!error && inserted) {
        const current = getAllInquiries();
        const replaced = current.map((item) => (item.id === localId ? { ...item, id: inserted.id } : item));
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(replaced));
          window.dispatchEvent(new CustomEvent('hunardhara_inquiry_updated', { detail: inserted }));
        }
        return;
      }
    } catch (supErr) {
      console.warn('Supabase saveInquiry insert failed, trying backend fallback:', supErr);
    }

    // 2. Dual-path fallback: FastAPI backend
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

  (async () => {
    // 1. Primary: Supabase update
    try {
      const { error } = await (supabase.from('artisan_inquiries') as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (!error) return;
    } catch (supErr) {
      console.warn('Supabase inquiry status update failed, trying backend fallback:', supErr);
    }

    // 2. Dual-path fallback: FastAPI backend
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
 * Deletes an inquiry authoritatively from Supabase and PostgreSQL.
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

  (async () => {
    // 1. Primary: Supabase delete
    try {
      const { error } = await (supabase.from('artisan_inquiries') as any)
        .delete()
        .eq('id', id);

      if (!error) return;
    } catch (supErr) {
      console.warn('Supabase delete inquiry failed, trying backend fallback:', supErr);
    }

    // 2. Dual-path fallback: FastAPI backend
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

/**
 * Subscribes to Supabase Realtime changes on artisan_inquiries for instant live updates.
 */
export function subscribeToInquiries(
  artisanId?: string,
  onUpdate?: (inquiry: any) => void
) {
  const channel = supabase
    .channel(`artisan_inquiries_realtime_${artisanId || 'all'}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'artisan_inquiries',
      },
      (payload) => {
        syncInquiriesFromCloud(artisanId);
        if (onUpdate) {
          onUpdate(payload.new || payload.old);
        }
      }
    )
    .subscribe();

  return channel;
}
