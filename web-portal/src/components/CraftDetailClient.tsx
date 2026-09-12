'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchProductById, removeProduct } from '@/lib/api';
import { Product } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import CraftPassport from '@/components/CraftPassport';
import InquiryModal from '@/components/InquiryModal';
import {
  ArrowLeft,
  Award,
  Clock,
  CheckCircle2,
  Share2,
  HeartHandshake,
  ShieldCheck,
  Lock,
  MapPin,
  User,
  Trash2,
  MessageSquareQuote
} from 'lucide-react';

interface CraftDetailClientProps {
  initialProduct: Product | null;
  id: string;
}

export default function CraftDetailClient({ initialProduct, id }: CraftDetailClientProps) {
  const router = useRouter();
  const { user, role } = useAuth();
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [showOriginal, setShowOriginal] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

  useEffect(() => {
    if (!product) {
      fetchProductById(id).then((data) => setProduct(data));
    }
  }, [id, product]);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto py-28 px-4 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-[#c85a32] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-[#6f5f58]">कारीगर कार्यशाला से संपर्क हो रहा है...</p>
      </div>
    );
  }

  // Security Rule: Draft / Unpublished products are strictly blocked for unauthorized visitors
  const isDraft = product.is_published === false || (product as any).status === 'draft';
  const isOwnerOrAdmin = user && (role === 'admin' || user.id === product.artisan_id);

  if (isDraft && !isOwnerOrAdmin) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-[#231f1e]">Craft Listing Unpublished</h2>
        <p className="text-xs text-[#6f5f58]">
          यह उत्पाद अभी कार्यशाला में ड्राफ्ट स्थिति में है और कारीगर द्वारा सार्वजनिक बाज़ार में प्रकाशित नहीं किया गया है।
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-5 py-2.5 rounded-full bg-[#1b4332] text-white hover:bg-[#2d6a4f] transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>वापस बाज़ार जाएं (Return to Marketplace)</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-14 space-y-10">
      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-medium text-[#6f5f58] hover:text-[#1b4332] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>वापस शिल्प संग्रह जाएं (Return to Collection)</span>
      </Link>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Left Column: Visual Presentation */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full rounded-3xl bg-[#faf7f2] border border-[#e6ded3] overflow-hidden p-4 sm:p-6 flex items-center justify-center bento-shadow">
            <div className={`w-full h-full rounded-2xl flex items-center justify-center p-3 transition-all duration-500 relative overflow-hidden ${showOriginal ? 'bg-[#f4ede4]' : 'bg-white'}`}>
              <img
                src={product.studio_image_url || '/logo.png'}
                alt={product.title_en}
                className={`max-w-full max-h-full object-contain rounded-xl transition-all duration-500 ${
                  showOriginal ? 'filter sepia-[0.25] contrast-[0.95] brightness-[0.95]' : 'drop-shadow-md'
                }`}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo.png';
                }}
              />

              {/* View Perspective Badge */}
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs text-[#231f1e] border border-[#e6ded3] text-[11px] font-semibold px-3 py-1 rounded-full shadow-xs">
                {showOriginal ? 'कार्यशाला दृश्य (Workshop View)' : 'स्टूडियो प्रस्तुति (Studio Presentation)'}
              </div>
            </div>

            {/* Subtle GI Provenance Badge */}
            {product.gi_certified && (
              <div className="absolute top-5 left-5 bg-white/95 backdrop-blur-xs text-[#1b4332] border border-[#e6ded3] text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                <Award className="w-3.5 h-3.5 text-[#c85a32]" />
                <span>GI Heritage Verified</span>
              </div>
            )}
          </div>

          {/* Clean View Toggle */}
          <div className="bg-white p-3 rounded-2xl border border-[#e6ded3] flex items-center justify-between shadow-xs">
            <span className="text-xs font-semibold text-[#6f5f58]">दृश्य विकल्प (Perspective):</span>
            <div className="flex bg-[#faf7f2] p-1 rounded-xl border border-[#e6ded3]">
              <button
                onClick={() => setShowOriginal(false)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${!showOriginal ? 'bg-white text-[#1b4332] shadow-xs' : 'text-[#6f5f58] hover:text-[#1b4332]'}`}
              >
                स्टूडियो दृश्य
              </button>
              <button
                onClick={() => setShowOriginal(true)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${showOriginal ? 'bg-white text-[#1b4332] shadow-xs' : 'text-[#6f5f58] hover:text-[#1b4332]'}`}
              >
                कार्यशाला दृश्य
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Narrative, Direct Price & Inquire */}
        <div className="space-y-6">
          <div>
            <div className="text-[11px] font-bold text-[#c85a32] uppercase tracking-wider mb-2 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              <span>{product.craft_type}</span>
              <span>•</span>
              <span>{product.artisan_state || 'India'}</span>
            </div>

            <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#231f1e] leading-tight">
              {product.title_en}
            </h1>

            <p className="text-sm sm:text-base font-serif text-[#6f5f58] mt-1.5 italic">
              {product.title_hi}
            </p>
          </div>

          {/* Transparent Direct Pricing Card */}
          <div className="bg-white border border-[#e6ded3] rounded-3xl p-6 space-y-4 bento-shadow">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6f5f58] tracking-wider">
                  सीधा कारीगर मूल्य (Direct Price)
                </span>
                <div className="font-sans text-3xl font-extrabold text-[#c85a32] mt-0.5">
                  ₹{product.recommended_retail_d2c.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold bg-[#faf7f2] text-[#1b4332] border border-[#e6ded3] px-2.5 py-1 rounded-md">
                  थोक: ₹{product.wholesale_b2b.toLocaleString('en-IN')}
                </span>
                <button
                  type="button"
                  onClick={() => setIsInquiryModalOpen(true)}
                  className="text-[10.5px] font-bold text-[#c85a32] hover:underline mt-1 cursor-pointer"
                >
                  थोक मांग पूछें →
                </button>
              </div>
            </div>

            <div className="text-xs text-[#1b4332] bg-[#e8f5e9] border border-[#c8e6c9] p-3 rounded-2xl flex items-start gap-2.5">
              <HeartHandshake className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
              <span>
                <strong>न्यायसंगत आजीविका मॉडल:</strong> यह मूल्य सामग्री और निर्माण दिनों की उचित मजदूरी (₹650/दिन न्यूनतम) के आधार पर सुरक्षित है।
              </span>
            </div>
          </div>

          {/* Narrative Craft Story */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6f5f58]">
              कारीगर कथा एवं शिल्प परिचय
            </h3>
            <p className="text-xs sm:text-sm text-[#231f1e] leading-relaxed bg-[#faf7f2] p-4 rounded-2xl border border-[#e6ded3]">
              {product.description_en}
            </p>
            {product.description_hi && (
              <p className="text-xs sm:text-sm text-[#6f5f58] leading-relaxed bg-[#faf7f2] p-4 rounded-2xl border border-[#e6ded3] font-serif italic">
                &quot;{product.description_hi}&quot;
              </p>
            )}
          </div>

          {/* Detailed Attributes Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#faf7f2] p-3.5 rounded-2xl border border-[#e6ded3]">
              <span className="text-[#6f5f58] block text-[10px] uppercase font-bold">सामग्री (Materials)</span>
              <span className="font-semibold text-[#231f1e] mt-0.5 block">{product.materials.join(', ')}</span>
            </div>

            <div className="bg-[#faf7f2] p-3.5 rounded-2xl border border-[#e6ded3]">
              <span className="text-[#6f5f58] block text-[10px] uppercase font-bold">निर्माण समय (Duration)</span>
              <span className="font-semibold text-[#231f1e] mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#6f5f58]" />
                {product.production_time_days} दिन की मेहनत
              </span>
            </div>

            <div className="bg-[#faf7f2] p-3.5 rounded-2xl border border-[#e6ded3]">
              <span className="text-[#6f5f58] block text-[10px] uppercase font-bold">माप (Dimensions)</span>
              <span className="font-semibold text-[#231f1e] mt-0.5 block">{product.dimensions || 'पारंपरिक मानक'}</span>
            </div>

            <div className="bg-[#faf7f2] p-3.5 rounded-2xl border border-[#e6ded3]">
              <span className="text-[#6f5f58] block text-[10px] uppercase font-bold">उपलब्ध शिल्प (Stock)</span>
              <span className="font-semibold text-[#231f1e] mt-0.5 block">{product.available_stock} तैयार इकाइयाँ</span>
            </div>
          </div>

          {/* Direct Order Request */}
          <div className="pt-3 border-t border-[#e6ded3] space-y-3">
            {orderSent ? (
              <div className="bg-[#e8f5e9] border border-[#c8e6c9] text-[#1b4332] p-5 rounded-2xl flex items-center gap-3.5">
                <CheckCircle2 className="w-6 h-6 text-[#2d6a4f] shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">मांग सीधे कार्यशाला को भेजी गई</h4>
                  <p className="text-xs text-[#2d6a4f] mt-0.5">
                    कारीगर {product.artisan_name || 'राधेश्याम जी'} को सूचना प्रेषित कर दी गई है।
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center justify-between sm:justify-center border border-[#e6ded3] rounded-full bg-white px-4 py-2 sm:py-0">
                  <span className="text-[11px] font-bold text-[#6f5f58] sm:hidden">इकाइयाँ (Quantity):</span>
                  <div className="flex items-center">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-2 py-1 text-[#6f5f58] font-bold hover:text-[#231f1e]"
                    >
                      -
                    </button>
                    <span className="px-3 text-xs font-bold text-[#231f1e]">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="px-2 py-1 text-[#6f5f58] font-bold hover:text-[#231f1e]"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setOrderSent(true)}
                  className="flex-1 bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-sm py-4 px-6 rounded-full transition-all shadow-xs flex items-center justify-center gap-2 active:scale-98"
                >
                  <span>कारीगर से सीधे खरीदें (₹{(product.recommended_retail_d2c * quantity).toLocaleString('en-IN')})</span>
                </button>

                <button
                  onClick={() => alert('सत्यापित शिल्प लिंक कॉपी हो गया')}
                  className="p-3.5 rounded-full border border-[#e6ded3] bg-white text-[#6f5f58] hover:bg-[#faf7f2] self-center sm:self-auto cursor-pointer"
                  title="साझा करें"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Direct Inquiry with Artisan CTA */}
            <button
              type="button"
              onClick={() => setIsInquiryModalOpen(true)}
              className="w-full bg-[#faf7f2] hover:bg-[#f4ede4] text-[#1b4332] border border-[#1b4332]/25 font-bold text-xs py-3 px-5 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
            >
              <MessageSquareQuote className="w-4 h-4 text-[#c85a32]" />
              <span>कारीगर से सीधा सवाल पूछें (Ask Artisan / Inquire)</span>
            </button>

            <p className="text-[11px] text-[#6f5f58] text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2d6a4f]" /> 100% सुरक्षित एस्क्रो लिंकेज • सीधे कारीगर को भुगतान
            </p>

            {/* Admin Governance Box */}
            {role === 'admin' && (
              <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-800 uppercase flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-red-600" />
                    <span>प्रशासकीय नियंत्रण (Admin Moderation)</span>
                  </span>
                  <span className="text-[10px] bg-red-200 text-red-800 font-bold px-2 py-0.5 rounded-full">
                    Admin Active
                  </span>
                </div>
                <p className="text-[11px] text-red-700">
                  प्रशासक के रूप में, आप इस उत्पाद को सीधे सार्वजनिक बाज़ार से हटा सकते हैं।
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const confirmed = window.confirm(`[Admin] क्या आप वाकई "${product.title_hi || product.title_en}" को हटाना चाहते हैं?`);
                    if (confirmed) {
                      await removeProduct(product.id);
                      alert('उत्पाद सफलतापूर्वक हटा दिया गया है।');
                      router.push('/admin');
                    }
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>मार्केटप्लेस से यह उत्पाद हटाएं (Remove Product)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Certificate of Provenance */}
      <section className="pt-6">
        <CraftPassport product={product} />
      </section>

      {/* Direct Artisan Inquiry Modal */}
      <InquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
        productId={product.id}
        productTitle={product.title_en}
        productTitleHi={product.title_hi}
        productImage={product.studio_image_url || '/logo.png'}
        artisanId={product.artisan_id || '11111111-1111-1111-1111-111111111111'}
        artisanName={product.artisan_name || 'राधेश्याम अंसारी (Radheshyam Ansari)'}
        artisanCluster={product.craft_type ? `${product.craft_type} • ${product.artisan_state || 'भारत'}` : undefined}
      />
    </div>
  );
}
