'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  QrCode,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ShoppingBag
} from 'lucide-react';

interface OrderItem {
  id: string;
  orderNumber: string;
  date: string;
  status: 'confirmed' | 'crafting' | 'dispatched' | 'delivered';
  productTitle: string;
  craft: string;
  artisanName: string;
  cluster: string;
  price: number;
  statutoryWage: number;
  image: string;
  trackingId?: string;
  passportUrl: string;
}

const SAMPLE_ORDERS: OrderItem[] = [
  {
    id: 'ord-101',
    orderNumber: 'HD-2026-8941',
    date: '10 Sept 2026',
    status: 'crafting',
    productTitle: 'Royal Kadwa Banarasi Pure Katan Silk Saree',
    craft: 'Varanasi Silk Brocade',
    artisanName: 'Master Weaver Ansari',
    cluster: 'Varanasi, Uttar Pradesh',
    price: 13500,
    statutoryWage: 5200,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=600',
    trackingId: 'IND-POST-99281',
    passportUrl: '/craft/varanasi-silk'
  },
  {
    id: 'ord-102',
    orderNumber: 'HD-2026-8712',
    date: '02 Sept 2026',
    status: 'delivered',
    productTitle: 'Ancient Lost-Wax Bastar Dhokra Brass Horse',
    craft: 'Bastar Dhokra',
    artisanName: 'Tribal Elder Ghadwa',
    cluster: 'Kondagaon, Chhattisgarh',
    price: 2850,
    statutoryWage: 1200,
    image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&q=80&w=600',
    trackingId: 'DTDC-881920',
    passportUrl: '/craft/bastar-dhokra'
  }
];

export default function OrdersPage() {
  return (
    <AuthGuard allowedRoles={['customer', 'artisan', 'admin']}>
      <OrdersContent />
    </AuthGuard>
  );
}

function OrdersContent() {
  const { profile } = useAuth();
  const [orders] = useState<OrderItem[]>(SAMPLE_ORDERS);

  const getStatusBadge = (status: OrderItem['status']) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <Clock className="w-3 h-3" />
            स्वीकृत • Placed
          </span>
        );
      case 'crafting':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#c85a32] bg-[#fbf0ea] px-2.5 py-1 rounded-full border border-[#f2d3c2]">
            <Clock className="w-3 h-3" />
            निर्माण जारी • Crafting
          </span>
        );
      case 'dispatched':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            <Truck className="w-3 h-3" />
            प्रेषित • In Transit
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            सफलतापूर्वक प्राप्त • Delivered
          </span>
        );
    }
  };

  return (
    <main className="min-h-screen bg-[#faf7f2] py-8 sm:py-12 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e6ded3] pb-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#c85a32] bg-white px-3 py-1 rounded-full border border-[#e6ded3] inline-block mb-2">
              खरीदारी विवरण • Customer Orders
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1c1917] tracking-tight">
              आपके ऑर्डर (My Orders)
            </h1>
            <p className="text-xs sm:text-sm text-[#545454] mt-1">
              प्रत्येक हस्तशिल्प की प्रामाणिकता और कारीगर पारिश्रमिक की स्थिति
            </p>
          </div>
          <Link
            href="/#collection"
            className="inline-flex items-center justify-center gap-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full transition-all shadow-xs"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>नया शिल्प खोजें</span>
          </Link>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#e6ded3] space-y-4 max-w-md mx-auto shadow-2xs">
            <div className="w-16 h-16 rounded-full bg-[#faf7f2] flex items-center justify-center mx-auto text-[#6f5f58]">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#1c1917]">कोई ऑर्डर नहीं मिला</h3>
            <p className="text-xs text-[#545454]">
              आपने अभी तक कोई शिल्प ऑर्डर नहीं किया है। देश के विख्यात कारीगरों के हस्तशिल्प संग्रह को देखें।
            </p>
            <Link
              href="/#collection"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-full bg-[#1b4332] text-white hover:bg-[#2d6a4f] transition-all"
            >
              <span>संग्रह देखें</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-7 shadow-2xs space-y-6 transition-all hover:shadow-xs"
              >
                {/* Order Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f4ede4] pb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs sm:text-sm font-bold text-[#1c1917]">
                      {order.orderNumber}
                    </span>
                    <span className="text-xs text-[#8f8179]">•</span>
                    <span className="text-xs text-[#6f5f58]">{order.date}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {/* Product & Artisan Detail */}
                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="w-full sm:w-32 h-32 rounded-2xl overflow-hidden bg-[#faf7f2] border border-[#e6ded3] shrink-0">
                    <img
                      src={order.image}
                      alt={order.productTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 space-y-2.5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#c85a32]">
                          {order.craft}
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-[#1c1917] leading-snug">
                          {order.productTitle}
                        </h3>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg sm:text-xl font-extrabold text-[#1b4332]">
                          ₹{order.price.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#6f5f58]">
                      कारीगर: <strong className="text-[#1c1917]">{order.artisanName}</strong> ({order.cluster})
                    </p>

                    {/* Wage Protection Guarantee Box */}
                    <div className="bg-[#faf7f2] rounded-2xl p-3 border border-[#e6ded3] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#1b4332] shrink-0" />
                        <span className="text-xs text-[#545454]">
                          कारीगर को सीधे प्राप्त पारिश्रमिक (Direct Artisan Wage):
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#1b4332] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        ₹{order.statutoryWage.toLocaleString('en-IN')} सुरक्षित (Zero Exploitation)
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <Link
                        href={order.passportUrl}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1b4332] bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-full border border-emerald-200 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>शिल्प पासपोर्ट (Digital Passport)</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>

                      {order.trackingId && (
                        <span className="text-xs text-[#6f5f58]">
                          ट्रैकिंग संख्या: <strong className="font-mono text-[#1c1917]">{order.trackingId}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tracking Progress Steps */}
                <div className="pt-2 border-t border-[#f4ede4]">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="space-y-1">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-xs font-bold">
                        ✓
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold text-[#1c1917] block">स्वीकृत</span>
                      <span className="text-[9px] text-[#6f5f58] hidden sm:block">Order Placed</span>
                    </div>

                    <div className="space-y-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                        order.status !== 'confirmed' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {order.status !== 'confirmed' ? '✓' : '2'}
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold text-[#1c1917] block">कारीगरी</span>
                      <span className="text-[9px] text-[#6f5f58] hidden sm:block">Crafting</span>
                    </div>

                    <div className="space-y-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                        order.status === 'dispatched' || order.status === 'delivered' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {order.status === 'dispatched' || order.status === 'delivered' ? '✓' : '3'}
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold text-[#1c1917] block">प्रेषित</span>
                      <span className="text-[9px] text-[#6f5f58] hidden sm:block">Dispatched</span>
                    </div>

                    <div className="space-y-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                        order.status === 'delivered' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {order.status === 'delivered' ? '✓' : '4'}
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold text-[#1c1917] block">प्राप्त</span>
                      <span className="text-[9px] text-[#6f5f58] hidden sm:block">Delivered</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
