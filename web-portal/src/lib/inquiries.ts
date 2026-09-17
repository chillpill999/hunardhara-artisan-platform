import { ArtisanInquiry } from './types';
import { supabase } from './supabase';

const STORAGE_KEY = 'hunardhara_artisan_inquiries';

export function getAllInquiries(): ArtisanInquiry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: ArtisanInquiry[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Retrieves inquiries specifically addressed to the given artisan.
 * Enforces strict artisan identity matching to prevent cross-artisan inquiry leakage.
 */
export function getInquiriesForArtisan(artisanIdOrEmail?: string): ArtisanInquiry[] {
  const all = getAllInquiries();
  if (!artisanIdOrEmail) return [];

  const target = artisanIdOrEmail.toLowerCase().trim();

  const filtered = all.filter((inq) => {
    const inqArtisanId = (inq.artisan_id || '').toLowerCase();
    return inqArtisanId === target;
  });

  return filtered;
}

/**
 * Syncs inquiries with Supabase cloud database
 */
export async function syncInquiriesFromCloud(artisanIdOrEmail?: string): Promise<ArtisanInquiry[]> {
  try {
    let query = supabase.from('artisan_inquiries').select('*');
    if (artisanIdOrEmail) {
      query = query.or(`artisan_id.eq.${artisanIdOrEmail},artisan_id.is.null`);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
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

      const local = getAllInquiries();
      const existingIds = new Set(local.map((i) => i.id));
      const merged = [...local];
      for (const c of cloudMapped) {
        if (!existingIds.has(c.id)) {
          merged.unshift(c);
          existingIds.add(c.id);
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('hunardhara_inquiry_updated', { detail: { merged: true } }));
      }
      return getInquiriesForArtisan(artisanIdOrEmail);
    }
  } catch (err) {
    console.warn('Sync cloud inquiries error:', err);
  }
  return getInquiriesForArtisan(artisanIdOrEmail);
}

/**
 * Saves a new buyer inquiry and forwards it directly to the artisan's inbox and Supabase.
 */
export function saveInquiry(
  data: Omit<ArtisanInquiry, 'id' | 'created_at' | 'status'>
): ArtisanInquiry {
  const all = getAllInquiries();
  const newInquiry: ArtisanInquiry = {
    ...data,
    id: `inq-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    status: 'new',
    created_at: new Date().toISOString(),
  };

  const updated = [newInquiry, ...all];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('hunardhara_new_inquiry', { detail: newInquiry }));
    } catch (e) {
      console.warn('Failed to save inquiry to storage:', e);
    }
  }

  // Asynchronously sync to Supabase cloud table
  try {
    Promise.resolve(
      supabase
        .from('artisan_inquiries')
        .insert({
          product_id: data.product_id,
          product_title: data.product_title,
          product_image: data.product_image,
          artisan_id: data.artisan_id,
          artisan_name: data.artisan_name,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          customer_email: data.customer_email,
          inquiry_type: data.inquiry_type,
          quantity: data.quantity,
          message: data.message,
          status: 'new',
        })
    )
      .then((res: any) => {
        if (res?.error) console.warn('Supabase inquiry insert note:', res.error);
      })
      .catch(() => {});
  } catch (e) {
    console.warn('Supabase inquiry insert catch:', e);
  }

  return newInquiry;
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

  // Asynchronously update in Supabase cloud
  try {
    Promise.resolve(
      supabase
        .from('artisan_inquiries')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
    )
      .then((res: any) => {
        if (res?.error) console.warn('Supabase status update note:', res.error);
      })
      .catch(() => {});
  } catch (e) {
    console.warn('Supabase status update catch:', e);
  }
}

/**
 * Deletes an inquiry.
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

  // Asynchronously delete in Supabase cloud
  try {
    Promise.resolve(
      supabase
        .from('artisan_inquiries')
        .delete()
        .eq('id', id)
    )
      .then((res: any) => {
        if (res?.error) console.warn('Supabase delete inquiry note:', res.error);
      })
      .catch(() => {});
  } catch (e) {
    console.warn('Supabase delete inquiry catch:', e);
  }
}
