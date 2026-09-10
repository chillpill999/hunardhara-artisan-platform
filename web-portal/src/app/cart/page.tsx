'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ShieldCheck,
  ArrowRight,
  HeartHandshake
} from 'lucide-react';

interface CartItem {
  id: string;
  title: string;
  craft: string;
  artisan: string;
  price: number;
  statutoryWage: number;
  quantity: number;
  image: string;
}

const INITIAL_CART: CartItem[] = [
  {
    id: 'prod-001',
    title: 'Royal Kadwa Banarasi Pure Katan Silk Saree',
    craft: 'Varanasi Silk Brocade',
    artisan: 'Master Weaver Ansari',
    price: 13500,
    statutoryWage: 5200,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'prod-002',
    title: 'Ancient Lost-Wax Bastar Dhokra Brass Horse',
    craft: 'Bastar Dhokra',
    artisan: 'Tribal Elder Ghadwa',
    price: 2850,
    statutoryWage: 1200,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&q=80&w=600'
  }
];

export default function CartPage() {
  return (
    <AuthGuard allowedRoles={['customer', 'admin']}>
      <CartContent />
    </AuthGuard>
  );
}

function CartContent() {
  const { profile } = useAuth();
  const [items, setItems] = useState<CartItem[]>(INITIAL_CART);
  const [isOrdered, setIsOrdered] = useState(false);

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalWageGuaranteed = items.reduce((acc, item) => acc + item.statutoryWage * item.quantity, 0);

  if (isOrdered) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-50 text-[#1b4332] border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
          <ShieldCheck className="w-10 h-10 text-[#1b4332]" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#1b4332] uppercase tracking-wider bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
            ऑर्डर सफल • Order Confirmed
          </span>
          <h1 className="text-3xl font-extrabold text-[#1c1917] tracking-tight">
            Thank you for supporting master artisans!
          </h1>
          <p className="text-sm text-[#545454] max-w-md mx-auto leading-relaxed">
            आपका ऑर्डर स्वीकार कर लिया गया है। ₹{totalWageGuaranteed.toLocaleString('en-IN')} का वैधानिक पारिश्रमिक सीधे कारीगरों के बैंक खाते में जमा होगा।
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            href="/orders"
            className="w-full sm:w-auto bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs px-6 py-3 rounded-full transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <span>मेरे ऑर्डर देखें (View My Orders)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/#collection"
            className="w-full sm:w-auto border border-[#e6ded3] bg-white hover:bg-[#f4ede4] text-[#231f1e] font-bold text-xs px-6 py-3 rounded-full transition-all flex items-center justify-center"
          >
            <span>और शिल्प खोजें</span>
          </Link>
        </div>
      </div>
    );
  }

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
                className="bg-white rounded-3xl border border-[#e6ded3] p-4 sm:p-5 bento-shadow flex flex-col sm:flex-row items-center gap-4 transition-all"
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
                  <p className="text-xs font-bold text-[#1b4332]">
                    गारंटीड पारिश्रमिक: ₹{item.statutoryWage.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center justify-between sm:items-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-[#f4f4f5]">
                  <span className="text-base font-black text-[#1c1917]">
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </span>

                  <div className="flex items-center gap-2 bg-[#faf7f2] border border-[#e6ded3] rounded-xl p-1">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-neutral-100 flex items-center justify-center text-[#1c1917] transition-colors"
                      title="घटाएं"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold px-2">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-neutral-100 flex items-center justify-center text-[#1c1917] transition-colors"
                      title="बढ़ाएं"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-red-500 hover:text-red-700 p-1 flex items-center gap-1"
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
              onClick={() => setIsOrdered(true)}
              className="w-full bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs sm:text-sm py-3.5 rounded-full transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-[#faf7f2]" />
              <span>ऑर्डर कन्फर्म करें (Place Order)</span>
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
