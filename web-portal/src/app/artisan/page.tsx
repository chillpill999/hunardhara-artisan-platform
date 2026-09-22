'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ArtisanStudio from '@/components/ArtisanStudio';
import ArtisanRevenueLedger from '@/components/ArtisanRevenueLedger';
import HunarSaathi from '@/components/HunarSaathi';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { getUploadedProducts, LEGACY_MOCK_IDS } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { getInquiriesForArtisan, syncInquiriesFromCloud, updateInquiryStatus, deleteInquiry, saveInquiry } from '@/lib/inquiries';
import { ArtisanInquiry } from '@/lib/types';
import {
  Palette,
  TrendingUp,
  PlusCircle,
  Package,
  ShoppingBag,
  Mic,
  Camera,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  Bot,
  User,
  HeartHandshake,
  MessageSquareQuote,
  Phone,
  Mail,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

function ArtisanPortalContent() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'home' | 'studio' | 'products' | 'orders' | 'inquiries' | 'revenue'>(
    tabParam && ['home', 'studio', 'products', 'orders', 'inquiries', 'revenue'].includes(tabParam)
      ? (tabParam as any)
      : 'home'
  );

  useEffect(() => {
    if (tabParam && ['home', 'studio', 'products', 'orders', 'inquiries', 'revenue'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  const [showAssistantModal, setShowAssistantModal] = useState(false);
  const [inquiries, setInquiries] = useState<ArtisanInquiry[]>([]);
  const [inquiryFilter, setInquiryFilter] = useState<'all' | 'new' | 'replied'>('all');

  // Dynamic live artisan products state (zero fake seeds)
  const [artisanProducts, setArtisanProducts] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const syncArtisanProducts = async () => {
      try {
        const uploaded = getUploadedProducts();
        let supaProducts: any[] = [];
        if (user?.id) {
          try {
            const { data, error } = await supabase
              .from('craft_products')
              .select('*')
              .eq('artisan_id', user.id);
            if (!error && Array.isArray(data)) {
              supaProducts = data;
            }
          } catch (e) {
            console.warn('Supabase artisan products fetch note:', e);
          }
        }

        const combined: any[] = [];
        const seenIds = new Set<string>();

        // Uploaded items from local storage for current user
        for (const p of uploaded) {
          if (!p || !p.id || LEGACY_MOCK_IDS.has(p.id)) continue;
          if (user?.id) {
            if (!p.artisan_id || (p.artisan_id !== user.id && p.artisan_id !== user.email)) {
              continue;
            }
          }
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            combined.push({
              id: p.id,
              title: p.title_en || 'हस्तशिल्प',
              titleHi: p.title_hi || p.title_en || 'हस्तशिल्प',
              price: p.recommended_retail_d2c || p.floor_price || 0,
              status: 'Live',
              days: p.production_time_days || 7,
              ordersCount: 0,
              image: p.studio_image_url || '/logo.png',
            });
          }
        }

        // Cloud items from Supabase
        for (const p of supaProducts) {
          if (!p || !p.id || LEGACY_MOCK_IDS.has(p.id)) continue;
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            combined.push({
              id: p.id,
              title: p.title_en || p.title || 'हस्तशिल्प',
              titleHi: p.title_hi || p.title_en || p.title || 'हस्तशिल्प',
              price: p.recommended_retail_d2c || p.listing_price || p.floor_price || 0,
              status: p.is_published !== false ? 'Live' : 'Draft',
              days: p.production_time_days || 7,
              ordersCount: 0,
              image: p.studio_image_url || p.image_url || '/logo.png',
            });
          }
        }

        if (isMounted) {
          setArtisanProducts(combined);
        }
      } catch (e) {
        console.warn('Sync artisan products error:', e);
        if (isMounted) setArtisanProducts([]);
      }
    };

    syncArtisanProducts();
    window.addEventListener('hunardhara_product_published', syncArtisanProducts);
    return () => {
      isMounted = false;
      window.removeEventListener('hunardhara_product_published', syncArtisanProducts);
    };
  }, [user]);

  // Sync real incoming artisan orders from database
  useEffect(() => {
    let isMounted = true;
    const loadOrders = async () => {
      if (!user?.id) {
        if (isMounted) setActiveOrders([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, craft_products(title_en, title_hi), profiles:customer_id(full_name, phone)')
          .eq('artisan_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          if (isMounted) {
            setActiveOrders(
              data.map((o: any) => ({
                id: o.order_number || o.id,
                customer: o.profiles?.full_name || 'Verified Customer',
                craft: o.craft_products?.title_hi || o.craft_products?.title_en || o.product_title || 'हस्तशिल्प उत्पाद',
                qty: o.quantity || 1,
                amount: Number(o.total_price) || Number(o.total_amount) || 0,
                date: new Date(o.created_at || Date.now()).toLocaleDateString('hi-IN', {
                  day: 'numeric',
                  month: 'short',
                }),
                status: o.status === 'confirmed' ? 'नया ऑर्डर (New Order)' : (o.status === 'delivered' ? 'सफलतापूर्वक प्राप्त (Delivered)' : 'प्रक्रिया में (Processing)'),
                statusColor: o.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
              }))
            );
          }
        } else {
          if (isMounted) setActiveOrders([]);
        }
      } catch (e) {
        console.warn('Load artisan orders note:', e);
        if (isMounted) setActiveOrders([]);
      }
    };
    loadOrders();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Sync inquiries specifically addressed to this artisan from cloud and local cache
  useEffect(() => {
    let isMounted = true;
    const syncInquiries = async () => {
      try {
        const artisanId = user?.id || user?.email || '';
        if (!artisanId) {
          if (isMounted) setInquiries([]);
          return;
        }
        const inqs = await syncInquiriesFromCloud(artisanId);
        if (isMounted) {
          setInquiries(inqs);
        }
      } catch (e) {
        console.warn('Sync inquiries error:', e);
      }
    };

    syncInquiries();
    window.addEventListener('hunardhara_new_inquiry', syncInquiries);
    window.addEventListener('hunardhara_inquiry_updated', syncInquiries);
    return () => {
      isMounted = false;
      window.removeEventListener('hunardhara_new_inquiry', syncInquiries);
      window.removeEventListener('hunardhara_inquiry_updated', syncInquiries);
    };
  }, [user]);

  const handleSimulateInquiry = () => {
    const currentProduct = artisanProducts[0];
    saveInquiry({
      product_id: currentProduct?.id || `prod-inq-${Date.now()}`,
      product_title: currentProduct?.titleHi || currentProduct?.title || 'हस्तशिल्प उत्पाद',
      product_image: currentProduct?.image || '/logo.png',
      artisan_id: user?.id || '',
      artisan_name: profile?.full_name || (user?.user_metadata as any)?.full_name || 'कारीगर',
      customer_name: 'अपूर्वा मेहता (Apurva Mehta, Mumbai)',
      customer_phone: '+91 98112 34567',
      customer_email: 'apurva.mehta@gmail.com',
      inquiry_type: 'customization',
      quantity: 1,
      message: 'नमस्ते जी! मुझे इस शिल्प की बनावट बहुत सुंदर लगी। क्या इसमें कस्टमाइज़ेशन संभव है? मुझे 10 दिनों में चाहिए।',
    });
  };

  const newInquiriesCount = inquiries.filter((i) => i.status === 'new').length;
  const filteredInquiries = inquiries.filter((i) => {
    if (inquiryFilter === 'new') return i.status === 'new';
    if (inquiryFilter === 'replied') return i.status === 'replied';
    return true;
  });

  const totalEarned = activeOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const totalSavings = Math.round(totalEarned * 0.35);

  const artisanDisplayName = profile?.full_name || (user?.user_metadata as any)?.full_name || user?.email?.split('@')[0] || 'प्रमाणित शिल्पकार';
  const artisanDisplayInitial = artisanDisplayName.charAt(0).toUpperCase();
  const artisanClusterState = profile?.state || (user?.user_metadata as any)?.state || '';

  return (
    <AuthGuard
      allowedRoles={['artisan']}
      redirectMessage="Sign in to continue. Access your Artisan Studio, products, AI cataloging tools and earnings."
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-10 space-y-6 pb-28">
        {/* ===================================================================== */}
        {/* ARTISAN WELCOME & DIGNIFIED PROFILE HEADER                            */}
        {/* ===================================================================== */}
        <div className="flex items-center justify-between bg-white rounded-3xl p-4 sm:p-5 border border-[#e6ded3] bento-shadow">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1b4332] text-white flex items-center justify-center text-lg font-bold shadow-xs">
              {artisanDisplayInitial}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#c85a32] uppercase tracking-wider">
                <Palette className="w-3.5 h-3.5" />
                <span>कारीगर कार्यशाला • Artisan Atelier</span>
              </div>
              <h1 className="font-sans text-lg sm:text-xl font-extrabold text-[#231f1e]">
                {artisanDisplayName}
              </h1>
              <p className="text-xs text-[#6f5f58]">
                {artisanClusterState ? `${artisanClusterState} • ` : ''}[प्रमाणित कारीगर]
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl font-bold text-xs transition-all shadow-xs cursor-pointer ${
                activeTab === 'studio'
                  ? 'bg-[#c85a32] text-white ring-2 ring-[#c85a32]/30'
                  : 'bg-[#fdf8f6] hover:bg-[#faeee9] text-[#c85a32] border border-[#c85a32]/30'
              }`}
              title="सीधे फोटो व आवाज स्टूडियो खोलें"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">कारीगर</span>
              <span>स्टूडियो (Studio)</span>
            </button>

            <button
              onClick={() => setShowAssistantModal(true)}
              className="flex flex-col items-center justify-center w-11 h-11 rounded-2xl bg-[#faf7f2] border border-[#e6ded3] hover:bg-[#f4ede4] text-[#1b4332] transition-colors"
              title="हुनर साथी खोलें"
            >
              <span className="text-base">🌾</span>
              <span className="text-[9px] font-bold">साथी</span>
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* TOP TAB NAVIGATION FOR ARTISAN                                        */}
        {/* ===================================================================== */}
        <div className="flex bg-[#f4ede4] p-1 rounded-2xl border border-[#e6ded3] overflow-x-auto no-scrollbar gap-1">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 min-w-[70px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
              activeTab === 'home'
                ? 'bg-white text-[#1b4332] shadow-xs'
                : 'text-[#6f5f58] hover:text-[#231f1e]'
            }`}
          >
            होम (Home)
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex-1 min-w-[85px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap flex items-center justify-center gap-1 ${
              activeTab === 'studio'
                ? 'bg-[#c85a32] text-white shadow-xs'
                : 'text-[#6f5f58] hover:text-[#231f1e]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>उत्पाद जोड़ें</span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 min-w-[70px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
              activeTab === 'products'
                ? 'bg-white text-[#1b4332] shadow-xs'
                : 'text-[#6f5f58] hover:text-[#231f1e]'
            }`}
          >
            मेरे शिल्प ({artisanProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 min-w-[70px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-white text-[#1b4332] shadow-xs'
                : 'text-[#6f5f58] hover:text-[#231f1e]'
            }`}
          >
            ऑर्डर ({activeOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`flex-1 min-w-[95px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap flex items-center justify-center gap-1.5 ${
              activeTab === 'inquiries'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'text-[#6f5f58] hover:text-[#231f1e]'
            }`}
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>पूछताछ बॉक्स (Query Box)</span>
            {newInquiriesCount > 0 ? (
              <span className="bg-[#c85a32] text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                {newInquiriesCount}
              </span>
            ) : (
              <span className="text-[10px] opacity-75">({inquiries.length})</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('revenue')}
            className={`flex-1 min-w-[70px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
              activeTab === 'revenue'
                ? 'bg-white text-[#1b4332] shadow-xs'
                : 'text-[#6f5f58] hover:text-[#231f1e]'
            }`}
          >
            कमाई (₹)
          </button>
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: ARTISAN HOME (PRIORITIZED MOBILE LAYOUT)                       */}
        {/* ===================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* 1. HERO ACTION CARD: ADD PRODUCT (PRIMARY & VOICE CTA) */}
            <div className="bg-[#1b4332] text-white rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-sm space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#e9a83a] uppercase tracking-wider block">
                  आपके हुनर को मिले सही बाज़ार
                </span>
                <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-white">
                  अपना उत्पाद बोलकर जोड़ें
                </h2>
                <p className="text-xs sm:text-sm text-[#e8f5e9] font-light">
                  फोटो लें और अपने हुनर के बारे में बताएं — AI बाकी काम खुद करेगा।
                </p>
              </div>

              {/* Two Big Mobile Touch CTAs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('studio')}
                  className="bg-[#c85a32] hover:bg-[#b84e28] text-white font-bold text-sm sm:text-base py-4 px-5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
                >
                  <Mic className="w-5 h-5 text-[#e9a83a]" />
                  <span>🎤 बोलकर उत्पाद जोड़ें</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('studio')}
                  className="bg-white hover:bg-[#faf7f2] text-[#1b4332] font-bold text-sm sm:text-base py-4 px-5 rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2 active:scale-98"
                >
                  <PlusCircle className="w-5 h-5 text-[#1b4332]" />
                  <span>➕ Add Product (उत्पाद जोड़ें)</span>
                </button>
              </div>
            </div>

            {/* QUICK STATS STRIP (OPTIMISTIC & SIMPLE) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <div
                onClick={() => setActiveTab('orders')}
                className="bg-white rounded-2xl p-4 border border-[#e6ded3] bento-shadow cursor-pointer hover:border-[#1b4332] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#6f5f58] uppercase">सक्रिय ऑर्डर</span>
                  <ShoppingBag className="w-4 h-4 text-[#c85a32]" />
                </div>
                <div className="font-sans text-2xl font-extrabold text-[#231f1e] mt-1">
                  {activeOrders.length} {activeOrders.length === 1 ? 'ऑर्डर' : 'ऑर्डर'}
                </div>
                <span className="text-[11px] text-[#1b4332] font-semibold flex items-center gap-1 mt-1">
                  विवरण देखें <ArrowRight className="w-3 h-3" />
                </span>
              </div>

              <div
                onClick={() => setActiveTab('inquiries')}
                className="bg-white rounded-2xl p-4 border border-[#e6ded3] bento-shadow cursor-pointer hover:border-[#1b4332] transition-colors col-span-2 sm:col-span-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#6f5f58] uppercase">ग्राहक पूछताछ</span>
                  <MessageSquareQuote className="w-4 h-4 text-[#c85a32]" />
                </div>
                <div className="font-sans text-2xl font-extrabold text-[#231f1e] mt-1 flex items-baseline gap-2">
                  <span>{newInquiriesCount} नई</span>
                  <span className="text-xs font-normal text-[#6f5f58]">/ {inquiries.length} कुल</span>
                </div>
                <span className="text-[11px] text-[#1b4332] font-semibold flex items-center gap-1 mt-1">
                  सीधा उत्तर दें <ArrowRight className="w-3 h-3" />
                </span>
              </div>

              <div
                onClick={() => setActiveTab('revenue')}
                className="bg-white rounded-2xl p-4 border border-[#e6ded3] bento-shadow cursor-pointer hover:border-[#1b4332] transition-colors col-span-2 sm:col-span-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#6f5f58] uppercase">कुल कमाई</span>
                  <TrendingUp className="w-4 h-4 text-[#2d6a4f]" />
                </div>
                <div className="font-sans text-2xl font-extrabold text-[#1b4332] mt-1">
                  ₹{totalEarned.toLocaleString('en-IN')}
                </div>
                <span className="text-[11px] text-[#c85a32] font-semibold flex items-center gap-1 mt-1">
                  {totalEarned > 0 ? `+₹${totalSavings.toLocaleString('en-IN')} बचत` : 'पारदर्शी सीधी आय'} <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* 2. RECENT PRODUCTS SECTION */}
            <div className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-6 space-y-4 bento-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-sans text-base sm:text-lg font-bold text-[#231f1e]">
                    मेरे शिल्प (My Products)
                  </h3>
                  <p className="text-xs text-[#6f5f58]">
                    बाज़ार में लाइव आपके द्वारा बनाए गए उत्पाद
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('products')}
                  className="text-xs font-bold text-[#c85a32] hover:underline"
                >
                  सभी देखें →
                </button>
              </div>

              <div className="space-y-3">
                {artisanProducts.length === 0 ? (
                  <div className="bg-[#faf7f2] rounded-2xl border border-dashed border-[#e6ded3] p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-white border border-[#e6ded3] text-[#c85a32] flex items-center justify-center mx-auto">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#231f1e]">कोई शिल्प सूचीबद्ध नहीं है</h4>
                      <p className="text-xs text-[#6f5f58] mt-1 max-w-sm mx-auto">
                        आपकी कार्यशाला में अभी कोई उत्पाद नहीं है। बोलकर या फोटो खींचकर 60 सेकंड में अपना पहला शिल्प जोड़ें।
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('studio')}
                      className="inline-flex items-center gap-1.5 bg-[#c85a32] hover:bg-[#b84e28] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>पहला शिल्प जोड़ें (Add First Craft)</span>
                    </button>
                  </div>
                ) : (
                  artisanProducts.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-[#faf7f2] rounded-2xl border border-[#e6ded3] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white border border-[#e6ded3] overflow-hidden shrink-0">
                          <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <h4 className="font-sans font-bold text-xs sm:text-sm text-[#231f1e] line-clamp-1">
                            {p.titleHi}
                          </h4>
                          <span className="text-xs font-extrabold text-[#c85a32] block mt-0.5">
                            ₹{p.price.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="bg-[#e8f5e9] text-[#1b4332] text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-[#2d6a4f]" />
                          <span>लाइव</span>
                        </span>
                        <Link
                          href={`/craft/${p.id}`}
                          className="p-2 rounded-xl bg-white border border-[#e6ded3] text-[#6f5f58] hover:text-[#1b4332]"
                          title="देखें"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3. ASSISTANT BANNER CARD */}
            <div className="bg-[#f4ede4] rounded-3xl p-5 border border-[#e6ded3] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1b4332] text-white flex items-center justify-center text-lg">
                  🌾
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#231f1e]">
                    हुनर साथी से पूछें (AI Assistant)
                  </h4>
                  <p className="text-xs text-[#6f5f58]">
                    कीमत, ऑर्डर या नए उत्पाद के बारे में कभी भी पूछें।
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAssistantModal(true)}
                className="bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shrink-0"
              >
                बात करें
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: ADD PRODUCT STUDIO FLOW                                        */}
        {/* ===================================================================== */}
        {activeTab === 'studio' && <ArtisanStudio />}

        {/* ===================================================================== */}
        {/* TAB 3: MY PRODUCTS FULL LIST                                          */}
        {/* ===================================================================== */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-sans text-xl font-bold text-[#231f1e]">
                  मेरे सभी शिल्प ({artisanProducts.length})
                </h2>
                <p className="text-xs text-[#6f5f58]">
                  आपके द्वारा प्रमाणित व प्रकाशित उत्पाद
                </p>
              </div>

              <button
                onClick={() => setActiveTab('studio')}
                className="bg-[#c85a32] text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>नया उत्पाद</span>
              </button>
            </div>

            {artisanProducts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#e6ded3] p-12 text-center space-y-4 bento-shadow">
                <div className="w-16 h-16 rounded-full bg-[#faf7f2] border border-[#e6ded3] text-[#c85a32] flex items-center justify-center mx-auto">
                  <Package className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#231f1e]">आपकी कार्यशाला में अभी कोई शिल्प नहीं है</h3>
                  <p className="text-xs text-[#6f5f58] max-w-md mx-auto">
                    हुनरधारा AI स्टूडियो के माध्यम से अपनी कलाकृति की एक फोटो लें या बोलकर विवरण दें — AI तुरंत पेशेवर कैटलॉग तैयार करेगा।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('studio')}
                  className="inline-flex items-center gap-2 bg-[#c85a32] hover:bg-[#b84e28] text-white text-xs font-bold px-6 py-3 rounded-2xl transition-all shadow-xs cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>नया शिल्प जोड़ें (Add Craft)</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {artisanProducts.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-3xl border border-[#e6ded3] p-4 bento-shadow space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-[#faf7f2] border border-[#e6ded3] overflow-hidden shrink-0">
                        <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-sans font-bold text-sm text-[#231f1e] line-clamp-1">
                          {p.titleHi}
                        </h4>
                        <p className="text-xs text-[#6f5f58] truncate">{p.title}</p>
                        <span className="font-sans text-base font-extrabold text-[#c85a32] block mt-0.5">
                          ₹{p.price.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#e6ded3] flex items-center justify-between text-xs">
                      <span className="text-[#6f5f58]">निर्माण: {p.days} दिन</span>
                      <Link
                        href={`/craft/${p.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1b4332] hover:underline"
                      >
                        <span>दुकान में देखें</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: ORDERS OVERVIEW                                                */}
        {/* ===================================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-sans text-xl font-bold text-[#231f1e]">
                ग्राहकों के ऑर्डर (Customer Orders)
              </h2>
              <p className="text-xs text-[#6f5f58]">
                सीधे आपकी कार्यशाला को भेजे गए ऑर्डर
              </p>
            </div>

            {activeOrders.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#e6ded3] p-12 text-center space-y-4 bento-shadow">
                <div className="w-16 h-16 rounded-full bg-[#faf7f2] border border-[#e6ded3] text-[#1b4332] flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-8 h-8 text-[#a1a1aa]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#231f1e]">अभी कोई नया ऑर्डर नहीं मिला है</h3>
                  <p className="text-xs text-[#6f5f58] max-w-sm mx-auto">
                    जैसे ही कोई ग्राहक या B2B खरीदार आपके शिल्पों का ऑर्डर देगा, वह विवरण यहाँ पर दिखाई देगा।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('studio')}
                  className="inline-flex items-center gap-1.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold px-5 py-2.5 rounded-full transition-all shadow-xs cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>शिल्प जोड़ें ताकि ऑर्डर मिल सकें</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeOrders.map((o) => (
                  <div
                    key={o.id}
                    className="bg-white rounded-3xl border border-[#e6ded3] p-5 bento-shadow space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold text-[#6f5f58] uppercase">
                          ऑर्डर आईडी: {o.id} • {o.date}
                        </span>
                        <h4 className="font-sans font-bold text-sm sm:text-base text-[#231f1e] mt-0.5">
                          {o.craft}
                        </h4>
                        <p className="text-xs text-[#6f5f58]">ग्राहक: {o.customer}</p>
                      </div>

                      <div className="text-right">
                        <span className="font-sans text-lg font-extrabold text-[#1b4332] block">
                          ₹{o.amount.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-[#6f5f58]">{o.qty} इकाई</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#e6ded3] flex items-center justify-between">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${o.statusColor}`}>
                        {o.status}
                      </span>

                      <button
                        onClick={() => alert(`ऑर्डर #${o.id} की रसीद तैयार है।`)}
                        className="text-xs font-bold text-[#1b4332] hover:underline"
                      >
                        रसीद देखें
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: ARTISAN DIRECT INQUIRIES & BUYER CONVERSATIONS                 */}
        {/* ===================================================================== */}
        {activeTab === 'inquiries' && (
          <div className="space-y-6">
            {/* Header / Intro Card */}
            <div className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-6 bento-shadow space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#c85a32] uppercase tracking-wider">
                    <MessageSquareQuote className="w-4 h-4" />
                    <span>सीधी ग्राहक व खरीदार पूछताछ • Direct Inquiries</span>
                  </div>
                  <h3 className="font-sans font-extrabold text-xl text-[#231f1e] mt-1">
                    कार्यशाला इनबॉक्स (Workshop Inquiry Inbox)
                  </h3>
                  <p className="text-xs text-[#6f5f58] mt-0.5">
                    ग्राहकों और B2B खरीदारों द्वारा आपके शिल्पों के संबंध में पूछे गए प्रश्न — सीधे व्हाट्सएप या कॉल से उत्तर दें।
                  </p>
                </div>

                {/* Controls & Quick Test */}
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <div className="flex items-center bg-[#faf7f2] p-1 rounded-xl border border-[#e6ded3]">
                    <button
                      onClick={() => setInquiryFilter('all')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        inquiryFilter === 'all'
                          ? 'bg-white text-[#1b4332] shadow-xs'
                          : 'text-[#6f5f58] hover:text-[#231f1e]'
                      }`}
                    >
                      सभी ({inquiries.length})
                    </button>
                    <button
                      onClick={() => setInquiryFilter('new')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        inquiryFilter === 'new'
                          ? 'bg-[#c85a32] text-white shadow-xs'
                          : 'text-[#6f5f58] hover:text-[#231f1e]'
                      }`}
                    >
                      नई ({newInquiriesCount})
                    </button>
                    <button
                      onClick={() => setInquiryFilter('replied')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        inquiryFilter === 'replied'
                          ? 'bg-white text-[#1b4332] shadow-xs'
                          : 'text-[#6f5f58] hover:text-[#231f1e]'
                      }`}
                    >
                      उत्तर दिया ({inquiries.filter((i) => i.status === 'replied').length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateInquiry}
                    className="inline-flex items-center gap-1.5 bg-[#fdf8f6] hover:bg-[#faeee9] text-[#c85a32] border border-[#c85a32]/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    title="जांच के लिए एक नमूना ग्राहक पूछताछ बनाएं"
                  >
                    <span>+ परीक्षण पूछताछ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Inquiries List */}
            {filteredInquiries.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#e6ded3] p-10 text-center space-y-3 bento-shadow">
                <div className="w-14 h-14 rounded-full bg-[#faf7f2] text-[#6f5f58] flex items-center justify-center mx-auto border border-[#e6ded3]">
                  <MessageSquareQuote className="w-7 h-7 text-[#c85a32]" />
                </div>
                <h4 className="font-bold text-base text-[#231f1e]">कोई पूछताछ नहीं मिली</h4>
                <p className="text-xs text-[#6f5f58] max-w-sm mx-auto">
                  {inquiryFilter === 'new'
                    ? 'सभी पूछताछ का उत्तर दिया जा चुका है।'
                    : 'जैसे ही कोई ग्राहक या B2B खरीदार आपके शिल्पों पर पूछताछ करेगा, वह सीधे यहाँ दिखाई देगी।'}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSimulateInquiry}
                    className="inline-flex items-center gap-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs px-4 py-2.5 rounded-full transition-all shadow-xs cursor-pointer"
                  >
                    <span>+ परीक्षण ग्राहक पूछताछ जोड़ें (Add Test Query)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInquiries.map((inq) => {
                  const cleanPhone = (inq.customer_phone || '').replace(/[^0-9]/g, '');
                  const waText = encodeURIComponent(
                    `नमस्ते ${inq.customer_name} जी, मैं ${profile?.full_name || inq.artisan_name || 'कारीगर'} बोल रहा हूँ। हुनरधारा पर आपके द्वारा "${inq.product_title}" के लिए भेजी गई पूछताछ के संबंध में...`
                  );
                  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${waText}` : null;

                  return (
                    <div
                      key={inq.id}
                      className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-6 bento-shadow space-y-4 transition-all hover:border-[#1b4332]/40"
                    >
                      {/* Top Meta Line: Category Badge + Status + Time */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f4ede4] pb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                            inq.inquiry_type === 'customization'
                              ? 'bg-purple-100 text-purple-800'
                              : inq.inquiry_type === 'bulk_order'
                              ? 'bg-amber-100 text-amber-800'
                              : inq.inquiry_type === 'delivery_time'
                              ? 'bg-blue-100 text-blue-800'
                              : inq.inquiry_type === 'price'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-100 text-stone-800'
                          }`}>
                            {inq.inquiry_type === 'customization' && '🎨 कस्टमाइज़ेशन (Customization)'}
                            {inq.inquiry_type === 'bulk_order' && '📦 थोक ऑर्डर (B2B Bulk Order)'}
                            {inq.inquiry_type === 'delivery_time' && '🚚 डिलीवरी समय (Delivery Timeline)'}
                            {inq.inquiry_type === 'price' && '💰 मूल्य दर (Price Query)'}
                            {inq.inquiry_type === 'general' && '❓ सामान्य प्रश्न (General)'}
                          </span>

                          {inq.quantity && inq.quantity > 0 && (
                            <span className="text-[11px] font-bold bg-[#faf7f2] text-[#231f1e] border border-[#e6ded3] px-2.5 py-0.5 rounded-md">
                              मांग: {inq.quantity} इकाई
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            inq.status === 'new'
                              ? 'bg-rose-100 text-rose-700 animate-pulse'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {inq.status === 'new' ? '🔴 नई पूछताछ' : '✓ उत्तर दिया गया'}
                          </span>
                          <span className="text-[10.5px] text-[#6f5f58] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(inq.created_at).toLocaleDateString('hi-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Product & Buyer Context */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#faf7f2] p-3.5 rounded-2xl border border-[#e6ded3]">
                        <div className="flex items-center gap-3">
                          {inq.product_image && (
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-[#e6ded3] shrink-0 p-1 flex items-center justify-center">
                              <img
                                src={inq.product_image}
                                alt={inq.product_title}
                                className="w-full h-full object-contain rounded-lg"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = '/logo.png';
                                }}
                              />
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#6f5f58]">उत्पाद (Craft)</span>
                            <h5 className="font-sans font-bold text-xs sm:text-sm text-[#231f1e] line-clamp-1">
                              {inq.product_title}
                            </h5>
                          </div>
                        </div>

                        <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-[#e6ded3]">
                          <span className="text-[10px] uppercase font-bold text-[#6f5f58]">ग्राहक (Customer / Buyer)</span>
                          <div className="font-bold text-xs text-[#1b4332]">{inq.customer_name}</div>
                          <div className="text-[11px] text-[#6f5f58]">{inq.customer_phone || inq.customer_email}</div>
                        </div>
                      </div>

                      {/* Inquiry Message Bubble */}
                      <div className="bg-[#fcfbf9] border border-[#e6ded3] rounded-2xl p-4 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-[#c85a32] flex items-center gap-1">
                          <MessageSquareQuote className="w-3.5 h-3.5" />
                          <span>ग्राहक का संदेश (Customer Message):</span>
                        </span>
                        <p className="text-xs sm:text-sm text-[#231f1e] leading-relaxed italic">
                          &quot;{inq.message}&quot;
                        </p>
                      </div>

                      {/* 1-Tap Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#f4ede4]">
                        <div className="flex flex-wrap items-center gap-2">
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => updateInquiryStatus(inq.id, 'replied')}
                              className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs py-2 px-3.5 rounded-xl transition-colors shadow-xs"
                            >
                              <span>🟢 व्हाट्सएप पर उत्तर दें (WhatsApp)</span>
                            </a>
                          )}

                          {inq.customer_phone && (
                            <a
                              href={`tel:${inq.customer_phone}`}
                              onClick={() => updateInquiryStatus(inq.id, 'replied')}
                              className="inline-flex items-center gap-1.5 bg-[#faf7f2] hover:bg-white text-[#1b4332] border border-[#e6ded3] font-bold text-xs py-2 px-3.5 rounded-xl transition-colors shadow-xs"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#1b4332]" />
                              <span>फोन करें ({inq.customer_phone})</span>
                            </a>
                          )}

                          {inq.customer_email && (
                            <a
                              href={`mailto:${inq.customer_email}?subject=${encodeURIComponent(`Re: ${inq.product_title} - HunarDhara`)}`}
                              onClick={() => updateInquiryStatus(inq.id, 'replied')}
                              className="inline-flex items-center gap-1.5 bg-[#faf7f2] hover:bg-white text-[#6f5f58] border border-[#e6ded3] font-medium text-xs py-2 px-3 rounded-xl transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>ईमेल</span>
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newStatus = inq.status === 'new' ? 'replied' : 'new';
                              updateInquiryStatus(inq.id, newStatus);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                              inq.status === 'new'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-[#faf7f2] text-[#6f5f58] border-[#e6ded3] hover:bg-white'
                            }`}
                          >
                            {inq.status === 'new' ? '✓ उत्तर दे दिया चिह्नित करें' : 'नई चिह्नित करें'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('क्या आप इस पूछताछ को हटाना चाहते हैं?')) {
                                deleteInquiry(inq.id);
                              }
                            }}
                            className="p-2 text-[#6f5f58] hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                            title="हटाएं"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 6: EARNINGS & REVENUE LEDGER                                      */}
        {/* ===================================================================== */}
        {activeTab === 'revenue' && <ArtisanRevenueLedger />}

        {/* ===================================================================== */}
        {/* HUNAR SAATHI MODAL (IF OPEN)                                          */}
        {/* ===================================================================== */}
        {showAssistantModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
              <HunarSaathi
                onClose={() => setShowAssistantModal(false)}
                onNavigateTab={(tab) => {
                  setShowAssistantModal(false);
                  setActiveTab(tab);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

export default function ArtisanPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-10 h-10 rounded-full border-3 border-[#c85a32] border-t-transparent animate-spin mb-3" />
          <p className="text-xs text-[#6f5f58] font-bold">कारीगर कार्यशाला लोड हो रही है...</p>
        </div>
      }
    >
      <ArtisanPortalContent />
    </Suspense>
  );
}
