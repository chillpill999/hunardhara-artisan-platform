'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { fetchCustomerOrders, cancelCustomerOrder } from '@/lib/api';
import { CustomerOrder } from '@/lib/types';
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  QrCode,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  ShoppingBag,
  Loader2,
  AlertCircle,
  XCircle
} from 'lucide-react';

export default function OrdersPage() {
  return (
    <AuthGuard allowedRoles={['customer', 'artisan', 'admin']}>
      <OrdersContent />
    </AuthGuard>
  );
}

function OrdersContent() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const loadOrders = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchCustomerOrders();
      if (!res.success) {
        setErrorMessage(res.error || 'ऑर्डर लोड करने में समस्या आई।');
        setOrders([]);
      } else {
        setOrders(res.orders);
      }
    } catch (err: any) {
      console.error('Error fetching customer orders:', err);
      setErrorMessage(err.message || 'सर्वर से संपर्क नहीं हो सका।');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadOrders();
    }
  }, [user]);

  const handleCancelOrder = async (orderId: string) => {
    const confirmed = window.confirm(
      'क्या आप निश्चित रूप से इस ऑर्डर को रद्द करना चाहते हैं? (Are you sure you want to cancel this order?)'
    );
    if (!confirmed) return;

    setCancellingOrderId(orderId);
    try {
      const res = await cancelCustomerOrder(orderId);
      if (res.success) {
        // Optimistically update order status and replenish state
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'cancelled',
                  payment_status: o.payment_status === 'paid' ? 'refunded' : o.payment_status,
                }
              : o
          )
        );
      } else {
        alert(res.error || 'ऑर्डर रद्द नहीं किया जा सका।');
      }
    } catch (err: any) {
      alert(err.message || 'त्रुटि उत्पन्न हुई।');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const getStatusBadge = (status: CustomerOrder['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <Clock className="w-3 h-3" />
            प्रतीक्षारत • Order Placed
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            <CheckCircle2 className="w-3 h-3" />
            भुगतान सत्यापित • Paid
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
            <CheckCircle2 className="w-3 h-3" />
            स्वीकृत • Confirmed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#c85a32] bg-[#fbf0ea] px-2.5 py-1 rounded-full border border-[#f2d3c2]">
            <Clock className="w-3 h-3" />
            निर्माण जारी • Crafting
          </span>
        );
      case 'shipped':
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
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
            ✕ रद्द • Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-700 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const getPaymentBadge = (payStatus: CustomerOrder['payment_status']) => {
    switch (payStatus) {
      case 'paid':
        return (
          <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            भुगतान: सत्यापित (Paid)
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
            भुगतान: वापस (Refunded)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            भुगतान: शेष (Unpaid / COD / Escrow)
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
              नमस्ते, {profile?.full_name || 'Valued Patron'}! प्रत्येक हस्तशिल्प की प्रामाणिकता और कारीगर पारिश्रमिक की स्थिति।
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

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-bold">त्रुटि (Error):</strong>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={loadOrders}
              className="text-xs font-bold text-red-700 underline hover:text-red-900"
            >
              पुनः प्रयास करें (Retry)
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-[#e6ded3] space-y-4 max-w-md mx-auto shadow-2xs">
            <Loader2 className="w-10 h-10 text-[#1b4332] animate-spin mx-auto" />
            <p className="text-xs text-[#6f5f58]">
              डेटाबेस से आपके आधिकारिक ऑर्डर लोड किए जा रहे हैं...
            </p>
          </div>
        ) : orders.length === 0 ? (
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
            {orders.map((order) => {
              const formattedDate = order.created_at
                ? new Date(order.created_at).toLocaleDateString('hi-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'हाल ही में';

              const canCancel =
                ['pending', 'paid', 'confirmed'].includes(order.status) &&
                order.status !== 'cancelled' &&
                order.status !== 'delivered' &&
                order.status !== 'shipped';

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-7 shadow-2xs space-y-6 transition-all hover:shadow-xs"
                >
                  {/* Order Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f4ede4] pb-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs sm:text-sm font-bold text-[#1c1917]">
                        {order.order_number}
                      </span>
                      <span className="text-xs text-[#8f8179]">•</span>
                      <span className="text-xs text-[#6f5f58]">{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPaymentBadge(order.payment_status)}
                      {getStatusBadge(order.status)}
                    </div>
                  </div>

                  {/* Product & Artisan Detail */}
                  <div className="flex flex-col sm:flex-row gap-5">
                    <div className="w-full sm:w-32 h-32 rounded-2xl overflow-hidden bg-[#faf7f2] border border-[#e6ded3] shrink-0">
                      <img
                        src={order.product_image_url || '/logo.png'}
                        alt={order.product_title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 space-y-2.5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#c85a32]">
                            {order.craft_type || 'हस्तशिल्प'}
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-[#1c1917] leading-snug">
                            {order.product_title}
                          </h3>
                          <span className="text-xs text-[#8f8179]">मात्रा: {order.quantity} इकाई</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg sm:text-xl font-extrabold text-[#1b4332]">
                            ₹{Number(order.total_price || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[#6f5f58]">
                        कारीगर: <strong className="text-[#1c1917]">{order.artisan_name || 'प्रमाणित कारीगर'}</strong>
                        {order.cluster_name ? ` (${order.cluster_name})` : ''}
                      </p>

                      {/* Wage Protection Guarantee Box */}
                      <div className="bg-[#faf7f2] rounded-2xl p-3 border border-[#e6ded3] flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-[#1b4332] shrink-0" />
                          <span className="text-xs text-[#545454]">
                            कारीगर को सीधे प्राप्त वैधानिक पारिश्रमिक:
                          </span>
                        </div>
                        <span className="text-xs font-bold text-[#1b4332] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          ₹{Number(order.statutory_wage || Math.round(order.total_price * 0.45)).toLocaleString('en-IN')} सुरक्षित (Zero Exploitation)
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <Link
                          href={`/craft/${order.product_id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1b4332] bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-full border border-emerald-200 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>शिल्प पासपोर्ट (Digital Passport)</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>

                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={cancellingOrderId === order.id}
                            className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3.5 py-1.5 rounded-full border border-red-200 transition-colors cursor-pointer"
                          >
                            {cancellingOrderId === order.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>रद्द किया जा रहा है...</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                <span>ऑर्डर रद्द करें (Cancel)</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tracking Progress Steps or Cancellation Notice */}
                  {order.status === 'cancelled' ? (
                    <div className="pt-3 border-t border-[#f4ede4]">
                      <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>
                          यह ऑर्डर रद्द कर दिया गया है। कारीगर इन्वेंट्री पुनः बहाल कर दी गई है।
                          {order.payment_status === 'refunded' ? ' भुगतान की धनवापसी प्रक्रिया प्रारंभ कर दी गई है।' : ''}
                        </span>
                      </div>
                    </div>
                  ) : (
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
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                              order.status !== 'pending' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {order.status !== 'pending' ? '✓' : '2'}
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-[#1c1917] block">पुष्टि</span>
                          <span className="text-[9px] text-[#6f5f58] hidden sm:block">Confirmed</span>
                        </div>

                        <div className="space-y-1">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                              ['shipped', 'delivered'].includes(order.status)
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {['shipped', 'delivered'].includes(order.status) ? '✓' : '3'}
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-[#1c1917] block">प्रेषित</span>
                          <span className="text-[9px] text-[#6f5f58] hidden sm:block">Dispatched</span>
                        </div>

                        <div className="space-y-1">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                              order.status === 'delivered' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {order.status === 'delivered' ? '✓' : '4'}
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-[#1c1917] block">प्राप्त</span>
                          <span className="text-[9px] text-[#6f5f58] hidden sm:block">Delivered</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
