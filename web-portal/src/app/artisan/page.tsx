'use client';

import { useState } from 'react';
import ArtisanStudio from '@/components/ArtisanStudio';
import ArtisanRevenueLedger from '@/components/ArtisanRevenueLedger';
import HunarSaathi from '@/components/HunarSaathi';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
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
  HeartHandshake
} from 'lucide-react';
import Link from 'next/link';

export default function ArtisanPortalPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'studio' | 'products' | 'orders' | 'revenue'>('home');
  const [showAssistantModal, setShowAssistantModal] = useState(false);

  // Sample artisan products for "My Products" section
  const artisanProducts = [
    {
      id: 'prod-001',
      title: 'Varanasi Pure Katan Silk Saree',
      titleHi: 'पारंपरिक बनारसी कतान सिल्क साड़ी',
      price: 6160,
      status: 'Live',
      days: 10,
      ordersCount: 4,
      image: '/static/studio/varanasi_silk.jpg',
    },
    {
      id: 'prod-002',
      title: 'Bastar Dhokra Brass Tribal Figurine',
      titleHi: 'बस्तर ढोकरा पीतल आदिवासी मूर्ति',
      price: 1850,
      status: 'Live',
      days: 4,
      ordersCount: 7,
      image: '/static/studio/bastar_dhokra.jpg',
    },
  ];

  // Sample active orders for "Orders" section
  const activeOrders = [
    {
      id: 'ORD-9842',
      customer: 'Priya Sharma (Mumbai)',
      craft: 'Varanasi Pure Katan Silk Saree',
      qty: 1,
      amount: 6160,
      date: 'आज (Today)',
      status: 'नया ऑर्डर (New Order)',
      statusColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'ORD-9839',
      customer: 'FabIndia Craft Procurement',
      craft: 'Bastar Dhokra Brass Figurines',
      qty: 12,
      amount: 22200,
      date: '2 दिन पहले',
      status: 'डिलीवरी के लिए तैयार (Dispatched)',
      statusColor: 'bg-amber-100 text-amber-800',
    },
  ];

  return (
    <AuthGuard
      allowedRoles={['artisan', 'admin']}
      redirectMessage="Sign in to continue. Access your Artisan Studio, products, AI cataloging tools and earnings."
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-10 space-y-6 pb-28">
        {/* ===================================================================== */}
        {/* ARTISAN WELCOME & DIGNIFIED PROFILE HEADER                            */}
        {/* ===================================================================== */}
        <div className="flex items-center justify-between bg-white rounded-3xl p-4 sm:p-5 border border-[#e6ded3] bento-shadow">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1b4332] text-white flex items-center justify-center text-lg font-bold shadow-xs">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'र'}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#c85a32] uppercase tracking-wider">
                <Palette className="w-3.5 h-3.5" />
                <span>कारीगर कार्यशाला • Artisan Atelier</span>
              </div>
              <h1 className="font-sans text-lg sm:text-xl font-extrabold text-[#231f1e]">
                {profile?.full_name || 'राधेश्याम अंसारी'}
              </h1>
              <p className="text-xs text-[#6f5f58]">
                वाराणसी सिल्क क्लस्टर (उत्तर प्रदेश) • [प्रमाणित कारीगर]
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAssistantModal(true)}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-[#faf7f2] border border-[#e6ded3] hover:bg-[#f4ede4] text-[#1b4332] transition-colors"
            title="हुनर साथी खोलें"
          >
            <span className="text-lg">🌾</span>
            <span className="text-[9px] font-bold">साथी</span>
          </button>
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
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div
                onClick={() => setActiveTab('orders')}
                className="bg-white rounded-2xl p-4 border border-[#e6ded3] bento-shadow cursor-pointer hover:border-[#1b4332] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#6f5f58] uppercase">सक्रिय ऑर्डर</span>
                  <ShoppingBag className="w-4 h-4 text-[#c85a32]" />
                </div>
                <div className="font-sans text-2xl font-extrabold text-[#231f1e] mt-1">
                  2 नए ऑर्डर
                </div>
                <span className="text-[11px] text-[#1b4332] font-semibold flex items-center gap-1 mt-1">
                  विवरण देखें <ArrowRight className="w-3 h-3" />
                </span>
              </div>

              <div
                onClick={() => setActiveTab('revenue')}
                className="bg-white rounded-2xl p-4 border border-[#e6ded3] bento-shadow cursor-pointer hover:border-[#1b4332] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#6f5f58] uppercase">कुल कमाई</span>
                  <TrendingUp className="w-4 h-4 text-[#2d6a4f]" />
                </div>
                <div className="font-sans text-2xl font-extrabold text-[#1b4332] mt-1">
                  ₹42,500
                </div>
                <span className="text-[11px] text-[#c85a32] font-semibold flex items-center gap-1 mt-1">
                  +₹14,875 बचत <ArrowRight className="w-3 h-3" />
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
                {artisanProducts.map((p) => (
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
                ))}
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
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: EARNINGS & REVENUE LEDGER                                      */}
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
