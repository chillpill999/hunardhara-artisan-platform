'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { checkoutCustomerCart, fetchProductById } from '@/lib/api';
import { EnrichedCartItem, CustomerOrder } from '@/lib/types';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ShieldCheck,
  ArrowRight,
  HeartHandshake,
  AlertCircle,
  Loader2,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';

const LEGACY_MOCK_IDS = new Set([
  'prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005',
  'prod-varanasi-001', 'prod-bastar-001', 'prod-bastar-002',
  'prod-khurja-001', 'prod-madhubani-001', 'prod-channapatna-001',
]);

export default function CartPage() {
  return (
    <AuthGuard allowedRoles={['customer', 'artisan', 'admin']}>
      <CartContent />
    </AuthGuard>
  );
}

function CartContent() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<EnrichedCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmedOrders, setConfirmedOrders] = useState<CustomerOrder[] | null>(null);

  // Authoritative load: Sync and canonicalize cart items from PostgreSQL backend
  useEffect(() => {
    let cancelled = false;

    async function loadAndVerifyCart() {
      try {
        setIsLoading(true);
        setCheckoutError(null);
        const raw = localStorage.getItem('hunardhara_customer_cart');
        if (!raw) {
          if (!cancelled) {
            setItems([]);
            setIsLoading(false);
          }
          return;
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          if (!cancelled) {
            setItems([]);
            setIsLoading(false);
          }
          return;
        }

        // Clean mock and invalid items
        const candidateItems = parsed.filter(
          (item: any) => item && item.id && !LEGACY_MOCK_IDS.has(item.id)
        );

        // Canonicalize prices and live stock directly from the database API
        const verifiedItems: EnrichedCartItem[] = [];
        for (const entry of candidateItems) {
          try {
            const product = await fetchProductById(entry.id);
            if (product && product.id && product.is_published !== false) {
              const canonicalPrice = Number(
                product.recommended_retail_d2c ?? product.floor_price ?? 0
              );
              const availableStock = Number(product.available_stock ?? 0);
              const requestedQty = Math.max(1, Number(entry.quantity) || 1);

              verifiedItems.push({
                id: product.id,
                title: product.title_en || 'हस्तशिल्प उत्पाद',
                craft: product.craft_type || 'पारंपरिक शिल्प',
                artisan: product.artisan_name || 'प्रमाणित कारीगर',
                price: canonicalPrice,
                statutoryWage: Math.round((product.floor_price || canonicalPrice * 0.5) * 0.45),
                quantity: availableStock > 0 ? Math.min(requestedQty, availableStock) : requestedQty,
                image: product.studio_image_url || product.raw_image_url || '/logo.png',
                stock: availableStock,
                isActive: availableStock > 0,
              });
            }
          } catch (e) {
            console.warn(`Product ${entry.id} verification note:`, e);
          }
        }

        if (!cancelled) {
          setItems(verifiedItems);
          // Sync clean list of IDs back to storage
          const cleanStorage = verifiedItems.map((i) => ({
            id: i.id,
            quantity: i.quantity,
          }));
          localStorage.setItem('hunardhara_customer_cart', JSON.stringify(cleanStorage));
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load cart items:', err);
        if (!cancelled) {
          setItems([]);
          setIsLoading(false);
        }
      }
    }

    loadAndVerifyCart();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) => {
      const updated = prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.stock) {
              setCheckoutError(`अधिकतम उपलब्ध स्टॉक ${item.stock} इकाइयाँ हैं।`);
              return item;
            }
            setCheckoutError(null);
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as EnrichedCartItem[];

      try {
        const storageData = updated.map((i) => ({ id: i.id, quantity: i.quantity }));
        localStorage.setItem('hunardhara_customer_cart', JSON.stringify(storageData));
      } catch (e) {}
      return updated;
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        const storageData = updated.map((i) => ({ id: i.id, quantity: i.quantity }));
        localStorage.setItem('hunardhara_customer_cart', JSON.stringify(storageData));
      } catch (e) {}
      return updated;
    });
    setCheckoutError(null);
  };

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalWageGuaranteed = items.reduce((acc, item) => acc + item.statutoryWage * item.quantity, 0);

  // Authoritative Checkout Handler
  const handleCheckout = async () => {
    setCheckoutError(null);

    if (items.length === 0) {
      setCheckoutError('आपकी टोकरी खाली है। कृपया पहले शिल्प जोड़ें।');
      return;
    }

    // Check availability
    const unavailableItem = items.find((i) => !i.isActive || i.stock < i.quantity);
    if (unavailableItem) {
      setCheckoutError(
        `उत्पाद '${unavailableItem.title}' की मांग उपलब्ध स्टॉक (${unavailableItem.stock}) से अधिक है। कृपया मात्रा समायोजित करें।`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const checkoutItems = items.map((i) => ({
        product_id: i.id,
        quantity: i.quantity,
      }));

      // Generate idempotency key for this checkout attempt
      const idempotencyKey = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const res = await checkoutCustomerCart(checkoutItems, idempotencyKey);

      if (!res.success) {
        setCheckoutError(res.error || 'ऑर्डर प्रक्रिया विफल रही। कृपया पुनः प्रयास करें।');
        setIsSubmitting(false);
        return;
      }

      // Successful authoritative order placement: clear cart in localStorage and show real confirmation
      try {
        localStorage.removeItem('hunardhara_customer_cart');
      } catch (e) {}

      setItems([]);
      setConfirmedOrders(res.orders || []);
      setIsSubmitting(false);
    } catch (err: any) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'नेटवर्क त्रुटि: सर्वर से संपर्क नहीं हो सका।');
      setIsSubmitting(false);
    }
  };

  // 1. Confirmed Order Success View with Real PostgreSQL Order Details
  if (confirmedOrders && confirmedOrders.length > 0) {
    const totalPlacedAmount = confirmedOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const totalPlacedWage = confirmedOrders.reduce((sum, o) => sum + (o.statutory_wage || Math.round(o.total_price * 0.45)), 0);

    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-6 sm:p-8 bento-shadow space-y-6 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 text-[#1b4332] border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-[#1b4332]" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-[#1b4332] uppercase tracking-wider bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
              ऑर्डर सफल • Order Confirmed in Database
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1c1917] tracking-tight">
              कारीगरों को सीधा समर्थन देने के लिए धन्यवाद!
            </h1>
            <p className="text-xs sm:text-sm text-[#545454] max-w-md mx-auto leading-relaxed">
              आपका ऑर्डर अधिकृत रूप से स्वीकार कर लिया गया है। ₹{totalPlacedWage.toLocaleString('en-IN')} का वैधानिक पारिश्रमिक बिना बिचौलियों के सीधे कारीगरों के खाते में जाएगा।
            </p>
          </div>

          {/* Real Order Numbers & Line Items */}
          <div className="bg-[#faf7f2] rounded-2xl p-4 sm:p-5 border border-[#e6ded3] text-left space-y-3">
            <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2">
              <span className="text-xs font-bold text-[#6f5f58] uppercase">ऑर्डर विवरण (Order Details)</span>
              <span className="text-xs font-semibold text-[#1b4332]">स्थिति: प्रतीक्षारत (Pending)</span>
            </div>

            <div className="space-y-2.5">
              {confirmedOrders.map((ord) => (
                <div key={ord.id} className="flex items-start justify-between gap-3 text-xs">
                  <div>
                    <strong className="block text-[#1c1917] font-semibold">{ord.product_title}</strong>
                    <span className="text-[#6f5f58]">
                      मात्रा: {ord.quantity} इकाई • कारीगर: {ord.artisan_name || 'प्रमाणित कारीगर'}
                    </span>
                    <span className="block font-mono text-[11px] text-[#8f8179]">
                      ऑर्डर सं: {ord.order_number}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-[#1c1917]">₹{ord.total_price.toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 mt-1">
                      भुगतान: {ord.payment_status === 'paid' ? 'सत्यापित' : 'शेष (Unpaid)'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#e6ded3] flex justify-between text-sm font-bold text-[#1c1917]">
              <span>कुल मूल्य (Total Amount):</span>
              <span className="text-[#1b4332]">₹{totalPlacedAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/orders"
              className="w-full sm:w-auto bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs px-6 py-3.5 rounded-full transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              <span>मेरे ऑर्डर देखें (View My Orders)</span>
            </Link>
            <Link
              href="/#collection"
              className="w-full sm:w-auto border border-[#e6ded3] bg-white hover:bg-[#f4ede4] text-[#231f1e] font-bold text-xs px-6 py-3.5 rounded-full transition-all flex items-center justify-center"
            >
              <span>और शिल्प खोजें (Explore Crafts)</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-16 px-4 text-center space-y-4">
        <Loader2 className="w-10 h-10 text-[#1b4332] animate-spin mx-auto" />
        <p className="text-xs sm:text-sm text-[#6f5f58]">
          शिल्प टोकरी और कारीगर स्टॉक की प्रामाणिकता जांची जा रही है...
        </p>
      </div>
    );
  }

  // 3. Normal Cart View
  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-[#1b4332]/10 text-[#1b4332] text-xs font-bold px-3 py-1 rounded-full mb-2">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Customer Cart • ग्राहक टोकरी</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1c1917] tracking-tight">
            शिल्प टोकरी (My Cart)
          </h1>
          <p className="text-xs sm:text-sm text-[#545454] mt-1">
            नमस्ते, {profile?.full_name || 'Valued Patron'}! आपके द्वारा चुने गए प्रामाणिक उत्पाद।
          </p>
        </div>

        <Link
          href="/#collection"
          className="text-xs font-bold text-[#1b4332] hover:underline flex items-center gap-1"
        >
          <span>← संग्रह में और जोड़ें</span>
        </Link>
      </div>

      {/* Error Banner */}
      {checkoutError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-bold">चेतावनी (Validation Error):</strong>
            <span>{checkoutError}</span>
          </div>
          <button
            onClick={() => setCheckoutError(null)}
            className="text-red-500 hover:text-red-700 font-bold px-1 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-12 text-center space-y-4 bento-shadow">
          <div className="w-16 h-16 rounded-full bg-[#faf7f2] border border-[#e6ded3] text-[#6f5f58] flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8 text-[#a1a1aa]" />
          </div>
          <h2 className="text-xl font-bold text-[#1c1917]">
            आपकी टोकरी खाली है (Your cart is empty)
          </h2>
          <p className="text-xs text-[#545454] max-w-sm mx-auto">
            प्रमाणित भारतीय कारीगरों द्वारा हस्तनिर्मित उत्कृष्ट शिल्पों का अन्वेषण करें।
          </p>
          <Link
            href="/#collection"
            className="inline-block bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs px-6 py-3 rounded-full transition-all shadow-xs"
          >
            शिल्प संग्रह देखें (Explore Crafts)
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-3xl border ${
                  !item.isActive ? 'border-red-200 opacity-75' : 'border-[#e6ded3]'
                } p-4 sm:p-5 bento-shadow flex flex-col sm:flex-row items-center gap-4 transition-all`}
              >
                <div className="w-24 h-24 rounded-2xl bg-[#faf7f2] border border-[#e6ded3] overflow-hidden shrink-0">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 space-y-1.5 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1 bg-[#faf7f2] text-[#c85a32] text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#e6ded3]">
                    <span>{item.craft}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[#1c1917] leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#6f5f58]">
                    कारीगर: <span className="font-semibold text-[#1c1917]">{item.artisan}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-[#1b4332]">
                      गारंटीड पारिश्रमिक: ₹{item.statutoryWage.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] text-[#8f8179]">
                      (स्टॉक: {item.stock})
                    </span>
                  </div>
                  {!item.isActive && (
                    <span className="inline-block text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                      वर्तमान में अनुपलब्ध (Out of Stock)
                    </span>
                  )}
                </div>

                <div className="flex sm:flex-col items-center justify-between sm:items-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-[#f4f4f5]">
                  <span className="text-base font-black text-[#1c1917]">
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </span>

                  <div className="flex items-center gap-2 bg-[#faf7f2] border border-[#e6ded3] rounded-xl p-1">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-neutral-100 flex items-center justify-center text-[#1c1917] transition-colors cursor-pointer"
                      title="घटाएं"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold px-2">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-neutral-100 flex items-center justify-center text-[#1c1917] transition-colors cursor-pointer"
                      title="बढ़ाएं"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-red-500 hover:text-red-700 p-1 flex items-center gap-1 cursor-pointer"
                    title="हटाएं"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="sm:hidden text-[11px]">हटाएं</span>
                  </button>
                </div>
              </div>
            ))}

            {/* Middleman Guarantee Banner */}
            <div className="p-4 bg-[#f4f8f5] border border-[#bbf7d0] rounded-2xl flex items-start gap-3">
              <HeartHandshake className="w-5 h-5 text-[#1b4332] shrink-0 mt-0.5" />
              <div className="text-xs text-[#1b4332] leading-relaxed">
                <strong className="block font-bold">शून्य बिचौलिया शोषण गारंटी (Zero Exploitation):</strong>
                आपके द्वारा चुकाई गई राशि का शत-प्रतिशत प्रमाणित शिल्पकारों और उनके स्वयं सहायता समूहों (SHGs) को सीधे हस्तांतरित किया जाता है।
              </div>
            </div>
          </div>

          {/* Order Summary Card */}
          <div className="bg-white rounded-3xl border border-[#e6ded3] p-6 bento-shadow space-y-5 sticky top-24">
            <h2 className="text-lg font-bold text-[#1c1917] border-b border-[#f4f4f5] pb-3">
              ऑर्डर सारांश (Summary)
            </h2>

            <div className="space-y-3 text-xs text-[#545454]">
              <div className="flex justify-between">
                <span>कुल उत्पाद (Items)</span>
                <span className="font-bold text-[#1c1917]">
                  {items.reduce((acc, i) => acc + i.quantity, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>मूल्य (Subtotal)</span>
                <span className="font-bold text-[#1c1917]">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>कारीगर पारिश्रमिक संरक्षण</span>
                <span className="font-bold text-[#1b4332]">₹{totalWageGuaranteed.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>डिलीवरी (Pan-India Shipping)</span>
                <span className="font-bold text-emerald-600">निःशुल्क (FREE)</span>
              </div>
              <div className="pt-3 border-t border-[#f4f4f5] flex justify-between text-sm font-black text-[#1c1917]">
                <span>कुल देय राशि (Total)</span>
                <span className="text-lg text-[#1b4332]">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isSubmitting || items.length === 0}
              className="w-full bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 rounded-full transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 text-[#faf7f2] animate-spin" />
                  <span>ऑर्डर प्रक्रिया जारी है...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#faf7f2]" />
                  <span>ऑर्डर कन्फर्म करें (Place Order)</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-center text-[#a1a1aa]">
              🔒 सुरक्षित डिजिटल भुगतान • प्रत्यक्ष कारीगर डीबीटी (Direct Benefit Transfer)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
