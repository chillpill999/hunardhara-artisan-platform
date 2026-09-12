import { ArtisanInquiry } from './types';

const STORAGE_KEY = 'hunardhara_artisan_inquiries';

// Initial realistic baseline inquiries for standard artisan demo crafts
const SEED_INQUIRIES: ArtisanInquiry[] = [
  {
    id: 'inq-seed-001',
    product_id: 'prod-001',
    product_title: 'पारंपरिक बनारसी कतान सिल्क साड़ी (Varanasi Pure Katan Silk)',
    product_image: '/static/studio/varanasi_silk.jpg',
    artisan_id: '11111111-1111-1111-1111-111111111111',
    artisan_name: 'Radheshyam Ansari (राधेश्याम अंसारी)',
    customer_name: 'अनामिका बनर्जी (Anamika Banerjee)',
    customer_phone: '+91 98201 45678',
    customer_email: 'anamika.banerjee@gmail.com',
    inquiry_type: 'customization',
    message: 'नमस्ते राधेश्याम जी, क्या यह बनारसी साड़ी गहरे जामुनी (Deep Wine / Purple) रंग में और बिना ज़री बॉर्डर के कस्टमाइज़ हो सकती है? मुझे अगले महीने शादी के लिए 2 साड़ियाँ चाहिए।',
    quantity: 2,
    status: 'new',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
  },
  {
    id: 'inq-seed-002',
    product_id: 'prod-001',
    product_title: 'पारंपरिक बनारसी कतान सिल्क साड़ी',
    product_image: '/static/studio/varanasi_silk.jpg',
    artisan_id: '11111111-1111-1111-1111-111111111111',
    artisan_name: 'Radheshyam Ansari',
    customer_name: 'हॉस्पिटैलिटी डेकोर समूह (FabIndia Boutique Buyer)',
    customer_phone: '+91 91122 33445',
    customer_email: 'sourcing@boutiqueheritage.in',
    inquiry_type: 'bulk_order',
    message: 'हम दिल्ली शोरूम के लिए 15 बनारसी कतान सिल्क साड़ियों का थोक ऑर्डर देना चाहते हैं। कृपया थोक दर (Wholesale Rate) और अनुमानित डिलीवरी समय बताएं।',
    quantity: 15,
    status: 'new',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
  },
  {
    id: 'inq-seed-003',
    product_id: 'prod-002',
    product_title: 'बस्तर ढोकरा पीतल आदिवासी मूर्ति (Bastar Dhokra Figurine)',
    product_image: '/static/studio/bastar_dhokra.jpg',
    artisan_id: 'artisan-sukhruram-02',
    artisan_name: 'सुखराम बघेल (Sukhram Baghel)',
    customer_name: 'राजेश वर्मा (Rajesh Verma)',
    customer_phone: '+91 94150 99887',
    customer_email: 'rajesh.verma@tcs.com',
    inquiry_type: 'delivery_time',
    message: 'क्या यह ढोकरा कलाकृति बेंगलुरु में 4 दिनों के भीतर सुरक्षित पैकेजिंग के साथ डिलीवर हो सकती है? कॉर्पोरेट उपहार के लिए चाहिए।',
    quantity: 5,
    status: 'replied',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  }
];

export function getAllInquiries(): ArtisanInquiry[] {
  if (typeof window === 'undefined') return SEED_INQUIRIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_INQUIRIES));
      return SEED_INQUIRIES;
    }
    const parsed: ArtisanInquiry[] = JSON.parse(raw);
    return parsed;
  } catch {
    return SEED_INQUIRIES;
  }
}

/**
 * Retrieves inquiries specifically addressed to the given artisan.
 * Matches by artisan_id, artisan_email, or default artisan identifiers.
 */
export function getInquiriesForArtisan(artisanIdOrEmail?: string): ArtisanInquiry[] {
  const all = getAllInquiries();
  if (!artisanIdOrEmail) return all;

  const target = artisanIdOrEmail.toLowerCase().trim();
  const isDefaultDemoArtisan =
    target === 'artisan@hunardhara.gov.in' ||
    target === '11111111-1111-1111-1111-111111111111' ||
    target.includes('radheshyam') ||
    target.includes('artisan');

  return all.filter((inq) => {
    const inqArtisanId = (inq.artisan_id || '').toLowerCase();
    const inqArtisanName = (inq.artisan_name || '').toLowerCase();

    if (inqArtisanId === target) return true;
    if (isDefaultDemoArtisan && (inqArtisanId === '11111111-1111-1111-1111-111111111111' || inqArtisanName.includes('radheshyam'))) return true;
    return false;
  });
}

/**
 * Saves a new buyer inquiry and forwards it directly to the artisan's inbox.
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
}
