'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  fetchClusters,
  fetchProducts,
  removeProduct,
  restoreAllProducts,
  getRemovedProductIds
} from '@/lib/api';
import { CraftCluster, Product } from '@/lib/types';
import AuthGuard from '@/components/AuthGuard';
import {
  ShieldCheck,
  Building2,
  Users,
  TrendingUp,
  MapPin,
  Award,
  Compass,
  HeartHandshake,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Search,
  CheckCircle2,
  Eye,
  Package,
  Sparkles,
  ExternalLink,
  X
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'clusters' | 'products'>('products');
  const [clusters, setClusters] = useState<CraftCluster[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [removedCount, setRemovedCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Deletion Confirmation Modal State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [clusterData, productData] = await Promise.all([
        fetchClusters(),
        fetchProducts()
      ]);
      setClusters(clusterData);
      setProducts(productData);
      setRemovedCount(getRemovedProductIds().length);
    } catch (err) {
      console.warn('Admin load data error:', err);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('hunardhara_product_published', handleUpdate);
    window.addEventListener('hunardhara_product_removed', handleUpdate);
    return () => {
      window.removeEventListener('hunardhara_product_published', handleUpdate);
      window.removeEventListener('hunardhara_product_removed', handleUpdate);
    };
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase();
      return (
        p.title_en.toLowerCase().includes(q) ||
        (p.title_hi && p.title_hi.toLowerCase().includes(q)) ||
        p.craft_type.toLowerCase().includes(q) ||
        (p.artisan_name && p.artisan_name.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery]);

  // Handle Product Deletion
  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const success = await removeProduct(productToDelete.id);
      if (success) {
        setToastMessage(`उत्पाद "${productToDelete.title_hi || productToDelete.title_en}" सफलतापूर्वक हटा दिया गया है।`);
        setTimeout(() => setToastMessage(null), 4000);
        await loadData();
      }
    } catch (e) {
      console.warn('Failed to remove product:', e);
    } finally {
      setIsDeleting(false);
      setProductToDelete(null);
    }
  };

  // Handle Restore
  const handleRestore = () => {
    restoreAllProducts();
    setToastMessage('सभी मूल उत्पाद कैटलॉग में वापस रीसेट कर दिए गए हैं।');
    setTimeout(() => setToastMessage(null), 4000);
    loadData();
  };

  return (
    <AuthGuard
      allowedRoles={['admin']}
      redirectMessage="Sign in as Administrator to access governance and cluster monitoring."
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-20 right-5 z-50 bg-[#1b4332] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-[#e9a83a]/40 animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-[#e9a83a]" />
            <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Top Banner */}
        <div className="bg-[#141414] text-white rounded-3xl p-6 sm:p-10 border border-[#27272a] flex flex-col md:flex-row justify-between md:items-center gap-6 shadow-md">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#F8C146] text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-[#F5A941]" />
              <span>National Heritage Craft Governance • MoSJE Oversight</span>
            </div>

            <h1 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              प्रशासकीय नियंत्रण व क्लस्टर निगरानी
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 font-light leading-relaxed">
              कारीगर समूहों, न्यूनतम मजदूरी अनुपालन और सार्वजनिक बाज़ार कैटलॉग का केंद्रीय प्रबंधन। यहां से किसी भी अनुचित या अस्वीकृत उत्पाद को हटाया जा सकता है।
            </p>
          </div>

          {/* Protection Badges */}
          <div className="bg-[#1c1917] p-5 rounded-2xl border border-[#2e2e30] text-xs space-y-2 shrink-0">
            <div className="flex items-center gap-2 text-[#34d399] font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Statutory Wage Protection</span>
            </div>
            <div className="text-[11px] text-[#a1a1aa]">
              Cost-Plus Floor Policy Engine [₹650/day Baseline]
            </div>
            <div className="flex items-center gap-2 text-[#F8C146] font-bold pt-2 border-t border-[#2e2e30]">
              <Award className="w-4 h-4" />
              <span>GI Provenance Verification [Prototype]</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-[#e6ded3] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'products'
                ? 'bg-[#c85a32] text-white shadow-sm'
                : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>उत्पाद नियंत्रण व निष्कासन ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clusters')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'clusters'
                ? 'bg-[#1b4332] text-white shadow-sm'
                : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>शिल्प समूह व न्यूनतम मजदूरी ({clusters.length || 5})</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: PRODUCT GOVERNANCE & REMOVAL                                   */}
        {/* ===================================================================== */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e6ded3] bento-shadow space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-[#6f5f58] font-bold flex items-center justify-between">
                  <span>लाइव मार्केटप्लेस उत्पाद</span>
                  <Package className="w-4 h-4 text-[#1b4332]" />
                </div>
                <div className="font-sans text-3xl font-extrabold text-[#231f1e]">
                  {products.length}
                </div>
                <div className="text-[11px] text-[#2d6a4f] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> सार्वजनिक रूप से उपलब्ध
                </div>
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e6ded3] bento-shadow space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-[#6f5f58] font-bold flex items-center justify-between">
                  <span>कारीगरों द्वारा लाइव अपलोड</span>
                  <Sparkles className="w-4 h-4 text-[#e9a83a]" />
                </div>
                <div className="font-sans text-3xl font-extrabold text-[#c85a32]">
                  {products.filter((p) => p.id.startsWith('prod-live-')).length}
                </div>
                <div className="text-[11px] text-[#6f5f58]">
                  Speak. Snap. Sell. अपलोड्स
                </div>
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e6ded3] bento-shadow space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-[#6f5f58] font-bold flex items-center justify-between">
                  <span>हटाए गए उत्पाद (Removed)</span>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <div className="font-sans text-3xl font-extrabold text-red-600">
                  {removedCount}
                </div>
                <div className="text-[11px] text-red-700">
                  मार्केटप्लेस से निष्कासित
                </div>
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e6ded3] bento-shadow space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-[#6f5f58] font-bold flex items-center justify-between">
                  <span>प्रशासनिक अधिकार</span>
                  <ShieldCheck className="w-4 h-4 text-[#1b4332]" />
                </div>
                <div className="font-sans text-2xl font-extrabold text-[#1b4332]">
                  Full Access
                </div>
                <div className="text-[11px] text-[#6f5f58]">
                  उत्पाद जोड़ने व हटाने का अधिकार
                </div>
              </div>
            </div>

            {/* Product Table Card */}
            <div className="bg-white rounded-3xl border border-[#e6ded3] overflow-hidden bento-shadow space-y-4 p-5 sm:p-7">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#e6ded3] pb-4">
                <div>
                  <h3 className="font-sans font-bold text-xl text-[#231f1e]">
                    उत्पाद कैटलॉग प्रशासन (Catalog Governance)
                  </h3>
                  <p className="text-xs text-[#6f5f58] mt-0.5">
                    किसी भी उत्पाद को सीधे मार्केटप्लेस से हटाने के लिए दाईं ओर स्थित &quot;हटाएं&quot; बटन दबाएं।
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {removedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleRestore}
                      className="bg-[#faf7f2] hover:bg-[#e6ded3] text-[#1b4332] border border-[#e6ded3] font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      title="हटाए गए सभी मूल उत्पादों को रीसेट करें"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>मूल कैटलॉग रीसेट करें</span>
                    </button>
                  )}

                  <div className="relative">
                    <Search className="w-4 h-4 text-[#6f5f58] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="उत्पाद या शिल्प खोजें..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#e6ded3] bg-[#faf7f2] focus:outline-none focus:border-[#1b4332] w-48 sm:w-64"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf7f2] text-[#6f5f58] uppercase font-bold border-b border-[#e6ded3]">
                    <tr>
                      <th className="py-3 px-4">उत्पाद (Product)</th>
                      <th className="py-3 px-4">शिल्प व राज्य (Craft & State)</th>
                      <th className="py-3 px-4">प्रमाणित मूल्य (Fair Price)</th>
                      <th className="py-3 px-4">प्रकार (Type)</th>
                      <th className="py-3 px-4 text-right">कार्रवाई (Admin Action)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6ded3] text-[#231f1e]">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-[#faf7f2] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white border border-[#e6ded3] overflow-hidden shrink-0">
                              <img
                                src={p.studio_image_url || '/logo.png'}
                                alt={p.title_en}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = '/logo.png';
                                }}
                              />
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <span className="font-bold text-sm text-[#231f1e] block truncate">
                                {p.title_hi || p.title_en}
                              </span>
                              <span className="text-[11px] text-[#6f5f58] block truncate">
                                {p.title_en}
                              </span>
                              <span className="text-[10px] text-[#2d6a4f] block font-mono">
                                ID: {p.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="bg-[#1b4332]/10 text-[#1b4332] font-semibold px-2.5 py-0.5 rounded-full block w-fit">
                            {p.craft_type}
                          </span>
                          <span className="text-[11px] text-[#6f5f58] block mt-1">
                            📍 {p.artisan_state || 'भारत'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-sans font-extrabold text-base text-[#c85a32]">
                            ₹{(p.recommended_retail_d2c || p.floor_price).toLocaleString('en-IN')}
                          </div>
                          <span className="text-[10px] text-[#2d6a4f]">
                            लागत + ₹650/दिन मजदूरी
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {p.id.startsWith('prod-live-') ? (
                            <span className="bg-[#e8f5e9] text-[#1b4332] text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit border border-[#2d6a4f]/20">
                              <Sparkles className="w-3 h-3 text-[#e9a83a]" />
                              <span>Live Upload</span>
                            </span>
                          ) : (
                            <span className="bg-[#faf7f2] text-[#6f5f58] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#e6ded3] block w-fit">
                              Catalog Seed
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/craft/${p.id}`}
                              target="_blank"
                              className="p-2 rounded-xl bg-white border border-[#e6ded3] text-[#6f5f58] hover:text-[#1b4332] hover:border-[#1b4332] transition-colors"
                              title="मार्केटप्लेस पर देखें"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            <button
                              type="button"
                              onClick={() => setProductToDelete(p)}
                              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border border-red-200 hover:border-red-500 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                              title="उत्पाद को मार्केटप्लेस से हटाएं"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>हटाएं (Remove)</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredProducts.length === 0 && (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#faf7f2] text-[#6f5f58] flex items-center justify-center mx-auto text-xl">
                    📦
                  </div>
                  <p className="text-sm font-bold text-[#231f1e]">कोई उत्पाद नहीं मिला</p>
                  <p className="text-xs text-[#6f5f58]">
                    {removedCount > 0
                      ? 'सभी उत्पाद हटा दिए गए हैं। आप ऊपर दिए गए "मूल कैटलॉग रीसेट करें" बटन से उन्हें वापस ला सकते हैं।'
                      : 'खोज शब्द बदलकर पुनः प्रयास करें।'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: CLUSTERS & STATUTORY WAGES (ORIGINAL TAB)                      */}
        {/* ===================================================================== */}
        {activeTab === 'clusters' && (
          <div className="space-y-6">
            {/* Cluster Table with Wage Baselines */}
            <div className="bg-white rounded-3xl border border-[#e4e4e7] overflow-hidden bento-shadow">
              <div className="p-6 sm:p-7 border-b border-[#f4f4f5] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="font-sans font-bold text-xl text-[#1c1917]">
                    Geographical Clusters & Statutory Minimum Daily Wages
                  </h3>
                  <p className="text-xs text-[#545454] mt-0.5">
                    These daily wage floors serve as minimum cost-plus baselines for the anti-exploitation pricing algorithm.
                  </p>
                </div>

                <div className="text-xs bg-[#f4f4f5] text-[#545454] border border-[#e4e4e7] px-3.5 py-1.5 rounded-full font-semibold flex items-center gap-1.5 w-fit">
                  <ShieldCheck className="w-4 h-4 text-[#059669]" />
                  <span>Wage Floor Enforced</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fafafa] text-[#71717a] uppercase font-bold border-b border-[#e4e4e7]">
                    <tr>
                      <th className="py-4 px-6">Cluster & Origin</th>
                      <th className="py-4 px-6">Heritage Discipline</th>
                      <th className="py-4 px-6">Pilot Artisans</th>
                      <th className="py-4 px-6">Statutory Wage Baseline</th>
                      <th className="py-4 px-6">Provenance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f4f5] text-[#1c1917]">
                    {clusters.map((c) => (
                      <tr key={c.id} className="hover:bg-[#fafafa] transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-sm text-[#1c1917]">{c.name}</div>
                          <div className="text-[11px] text-[#71717a] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-[#F5A941]" /> {c.district}, {c.state}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="bg-[#f4f4f5] text-[#545454] px-2.5 py-1 rounded-md font-medium">
                            {c.craft_type}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-[#1c1917]">
                          {c.active_artisans_count.toLocaleString('en-IN')} [Sample]
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-bold text-[#065f46] bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-1 rounded-md">
                            ₹{c.statutory_minimum_daily_wage}/day floor
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1 text-[#059669] font-semibold">
                            <Award className="w-3.5 h-3.5" /> GI Registry [Demo]
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* DELETE CONFIRMATION MODAL                                             */}
        {/* ===================================================================== */}
        {productToDelete && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 border border-[#e6ded3] shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="font-sans text-xl font-extrabold text-[#231f1e]">
                  उत्पाद हटाएं? (Remove Product)
                </h3>
                <p className="text-xs text-[#6f5f58] leading-relaxed">
                  क्या आप वाकई निम्नलिखित उत्पाद को सार्वजनिक मार्केटप्लेस और कैटलॉग से हटाना चाहते हैं?
                </p>
                <div className="p-3 bg-[#faf7f2] rounded-xl border border-[#e6ded3] text-left mt-2">
                  <span className="font-bold text-xs text-[#231f1e] block">
                    {productToDelete.title_hi || productToDelete.title_en}
                  </span>
                  <span className="text-[11px] text-[#6f5f58] block">
                    शिल्प: {productToDelete.craft_type} • मूल्य: ₹{(productToDelete.recommended_retail_d2c || productToDelete.floor_price).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  disabled={isDeleting}
                  className="py-3 px-4 rounded-xl border border-[#e6ded3] bg-white hover:bg-[#faf7f2] text-[#231f1e] font-bold text-xs transition-all cursor-pointer"
                >
                  रद्द करें (Cancel)
                </button>

                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>हाँ, हटाएं (Yes, Remove)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
