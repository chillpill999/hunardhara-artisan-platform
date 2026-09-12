'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SEED_PRODUCTS, fetchProducts } from '@/lib/api';
import { Product } from '@/lib/types';
import CraftCard from '@/components/CraftCard';
import {
  Search,
  ArrowRight,
  Award,
  ShieldCheck,
  HeartHandshake,
  Mic,
  Camera,
  Building2,
  MapPin,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCraft, setSelectedCraft] = useState('ALL');
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const items = await fetchProducts();
        if (items && items.length > 0) {
          setProducts(items);
        }
      } catch (e) {
        console.warn('Catalog load note:', e);
      }
    };
    loadCatalog();

    const handleProductAdded = () => {
      loadCatalog();
    };
    window.addEventListener('hunardhara_product_published', handleProductAdded);
    return () => {
      window.removeEventListener('hunardhara_product_published', handleProductAdded);
    };
  }, []);

  const craftCategories = [
    'ALL',
    'Varanasi Silk',
    'Bastar Dhokra',
    'Khurja Pottery',
    'Madhubani Painting',
    'Channapatna Wooden Toys',
  ];

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.title_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.title_hi && p.title_hi.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.materials.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.artisan_state && p.artisan_state.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCraft = selectedCraft === 'ALL' || p.craft_type === selectedCraft;

      return matchesSearch && matchesCraft;
    });
  }, [products, searchQuery, selectedCraft]);

  return (
    <div className="space-y-14 sm:space-y-20 pb-20">
      {/* ========================================================================= */}
      {/* 1. CLEAR MISSION & VALUE PROPOSITION                                      */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-14">
        <div className="bg-[#1b4332] text-white rounded-3xl p-8 sm:p-14 relative overflow-hidden shadow-sm">
          <div className="max-w-2xl space-y-5 relative z-10">
            {/* Mission Badge */}
            <div className="inline-flex items-center gap-2 bg-[#2d6a4f] text-[#e8f5e9] text-xs font-bold px-3.5 py-1.5 rounded-full">
              <img
                src="/logo.png"
                alt="Hunardhara"
                className="w-4 h-4 rounded-full object-contain bg-white/20 p-0.5"
              />
              <span>हुनरधारा • Hunardhara Artisan Platform</span>
            </div>

            {/* Clear Mission Headline */}
            <h1 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.2]">
              Your skill deserves a bigger market.
            </h1>
            <p className="text-xl sm:text-2xl font-serif text-[#e9a83a] italic">
              आपके हुनर को मिले सही बाज़ार और पूरा सम्मान।
            </p>

            {/* Subtext */}
            <p className="text-sm sm:text-base text-[#e8f5e9] leading-relaxed font-light">
              Hunardhara helps marginalized Indian artisans turn their craft into a professional digital business. Speak in your own language, take a photo, and sell directly to patrons and bulk buyers worldwide with guaranteed fair-wage protection.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <Link
                href="/#collection"
                className="bg-[#c85a32] hover:bg-[#b84e28] text-white font-bold text-sm sm:text-base py-3.5 px-7 rounded-full transition-all shadow-md text-center"
              >
                Explore Crafts (शिल्प खोजें)
              </Link>
              <Link
                href="/artisan"
                className="bg-white hover:bg-[#faf7f2] text-[#1b4332] font-bold text-sm sm:text-base py-3.5 px-7 rounded-full transition-all shadow-xs text-center flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4 text-[#c85a32]" />
                <span>Start Selling (हुनर बेचें)</span>
              </Link>
            </div>
          </div>

          {/* Decorative Subtle Background Silhouette */}
          <div className="absolute -bottom-10 -right-10 w-96 h-96 rounded-full bg-[#2d6a4f]/30 blur-3xl pointer-events-none" />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SEARCH & DISCOVER CRAFTS                                               */}
      {/* ========================================================================= */}
      <section id="collection" className="max-w-7xl mx-auto px-4 sm:px-8 space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#231f1e]">
              शिल्प खोजें (Discover Crafts)
            </h2>
            <p className="text-xs sm:text-sm text-[#6f5f58] mt-0.5">
              सीधे प्रमाणित कारीगरों द्वारा हस्तनिर्मित उत्कृष्ट कृतियाँ
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#6f5f58] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="सिल्क, पीतल, मिट्टी, पेंटिंग..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#e6ded3] bg-white text-xs sm:text-sm text-[#231f1e] placeholder-[#a1a1aa] shadow-xs focus:outline-hidden focus:border-[#1b4332]"
            />
          </div>
        </div>

        {/* Category Filter Capsules */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {craftCategories.map((craft) => (
            <button
              key={craft}
              onClick={() => setSelectedCraft(craft)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
                selectedCraft === craft
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:border-[#1b4332]'
              }`}
            >
              {craft === 'ALL' ? 'सभी शिल्प (All)' : craft}
            </button>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. FEATURED CRAFTS / PRODUCTS                                             */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {filteredProducts.map((product) => (
            <CraftCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. ARTISAN STORIES & TRADITIONS                                           */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#c85a32] uppercase tracking-wider">
            <Award className="w-3.5 h-3.5" />
            <span>पीढ़ियों की धरोहर • Heritage Masters</span>
          </div>
          <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#231f1e]">
            कारीगरों की अनमोल कहानियां
          </h2>
          <p className="text-xs sm:text-sm text-[#6f5f58]">
            हर शिल्प के पीछे छिपी है दशकों की साधना और समृद्ध भारतीय संस्कृति।
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-3xl border border-[#e6ded3] p-6 bento-shadow space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#1b4332] text-white flex items-center justify-center font-bold text-lg">
                र
              </div>
              <div>
                <h4 className="font-sans font-bold text-base text-[#231f1e]">
                  राधेश्याम अंसारी
                </h4>
                <p className="text-xs text-[#6f5f58]">मास्टर बुनकर • वाराणसी (उत्तर प्रदेश)</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-[#545454] leading-relaxed">
              &quot;चार पीढ़ियों से हमारा परिवार बनारसी कतान सिल्क बुन रहा है। हुनरधारा के माध्यम से अब हमारी साड़ी बिना किसी बिचौलिए के सीधे ग्राहकों तक पहुँचती है।&quot;
            </p>
            <div className="text-xs font-semibold text-[#1b4332]">
              शिल्प: वाराणसी शुद्ध कतान सिल्क
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#e6ded3] p-6 bento-shadow space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#c85a32] text-white flex items-center justify-center font-bold text-lg">
                ब
              </div>
              <div>
                <h4 className="font-sans font-bold text-base text-[#231f1e]">
                  बुधरी बाई
                </h4>
                <p className="text-xs text-[#6f5f58]">ढोकरा शिल्पकार • बस्तर (छत्तीसगढ़)</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-[#545454] leading-relaxed">
              &quot;4000 साल पुरानी लॉस्ट-वैक्स ढलाई तकनीक से हम पीतल की मूर्तियाँ बनाते हैं। मोबाइल ऐप पर बोलकर विवरण देना हमारे लिए बहुत आसान है।&quot;
            </p>
            <div className="text-xs font-semibold text-[#c85a32]">
              शिल्प: बस्तर ढोकरा मेटल कास्टिंग
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#e6ded3] p-6 bento-shadow space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#e9a83a] text-[#1b4332] flex items-center justify-center font-bold text-lg">
                रा
              </div>
              <div>
                <h4 className="font-sans font-bold text-base text-[#231f1e]">
                  रामस्वरूप प्रजापति
                </h4>
                <p className="text-xs text-[#6f5f58]">पारंपरिक कुम्हार • खुर्जा (उत्तर प्रदेश)</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-[#545454] leading-relaxed">
              &quot;चीनी मिट्टी के बर्तन बनाने में समय और धैर्य दोनों लगता है। हुनरधारा पर हमें तय न्यूनतम दैनिक मजदूरी से अधिक मूल्य मिलता है।&quot;
            </p>
            <div className="text-xs font-semibold text-[#e9a83a]">
              शिल्प: खुर्जा हेरिटेज पॉटरी
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. WHY BUY DIRECTLY                                                       */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="bg-[#f4ede4] rounded-3xl p-8 sm:p-12 border border-[#e6ded3] space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#231f1e]">
              सीधे कारीगर से क्यों खरीदें?
            </h2>
            <p className="text-xs sm:text-sm text-[#6f5f58]">
              प्रत्येक खरीद भारतीय सांस्कृतिक धरोहर और कारीगर परिवारों की आजीविका को सशक्त बनाती है।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-[#e6ded3] space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#e8f5e9] text-[#1b4332] flex items-center justify-center">
                <HeartHandshake className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <h4 className="font-sans font-bold text-sm text-[#231f1e]">
                100% सीधी आय (No Trader Cut)
              </h4>
              <p className="text-xs text-[#6f5f58] leading-relaxed">
                आपकी दी गई पूरी राशि बिना किसी बिचौलिये के सीधे कारीगर के बैंक खाते में पहुँचती है।
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#e6ded3] space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#fff7ed] text-[#c85a32] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#c85a32]" />
              </div>
              <h4 className="font-sans font-bold text-sm text-[#231f1e]">
                न्यूनतम मजदूरी सुरक्षा (Fair Wage)
              </h4>
              <p className="text-xs text-[#6f5f58] leading-relaxed">
                मंच का एल्गोरिदम कारीगर को कम से कम ₹650/दिन की सांविधिक मजदूरी सुनिश्चित करता है।
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#e6ded3] space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#fefce8] text-[#b45309] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#d97706]" />
              </div>
              <h4 className="font-sans font-bold text-sm text-[#231f1e]">
                प्रमाणित भौगोलिक पहचान (GI Origin)
              </h4>
              <p className="text-xs text-[#6f5f58] leading-relaxed">
                प्रत्येक शिल्प के साथ डिजिटल क्राफ्ट पासपोर्ट और मूल क्लस्टर की सत्यता प्रमाणित होती है।
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#e6ded3] space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#f4ede4] text-[#1b4332] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#1b4332]" />
              </div>
              <h4 className="font-sans font-bold text-sm text-[#231f1e]">
                हस्तनिर्मित गुणवत्ता (Pure Craft)
              </h4>
              <p className="text-xs text-[#6f5f58] leading-relaxed">
                कारखाने में मशीनों से बनी नकल नहीं, बल्कि हाथों से गढ़ी गई अनूठी और शुद्ध कृतियाँ।
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. SELL YOUR CRAFT (SPEAK. SNAP. SELL.)                                   */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="bg-[#c85a32] text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-sm">
          <div className="max-w-xl space-y-4 relative z-10">
            <span className="text-xs font-bold text-[#faf7f2] uppercase tracking-wider block">
              कारीगरों के लिए विशेष • For Makers
            </span>
            <h2 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
              क्या आप भी एक शिल्पकार हैं?
            </h2>
            <p className="text-sm sm:text-base text-[#faf7f2] font-light leading-relaxed">
              लिखने या टाइप करने की कोई ज़रूरत नहीं। अपने फोन से फोटो लें, अपनी भाषा में बोलकर बताएं, और 2 मिनट में अपने उत्पाद को पूरे देश में बेचें।
            </p>

            <div className="pt-2">
              <Link
                href="/artisan"
                className="bg-white hover:bg-[#faf7f2] text-[#c85a32] font-extrabold text-sm sm:text-base py-4 px-8 rounded-full transition-all shadow-md inline-flex items-center gap-2"
              >
                <Mic className="w-5 h-5 text-[#c85a32]" />
                <span>बोलकर उत्पाद जोड़ें (Start Selling Now)</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. B2B BULK SOURCING                                                      */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-8 sm:p-10 bento-shadow flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1b4332] bg-[#1b4332]/10 px-3 py-1 rounded-full">
              <Building2 className="w-3.5 h-3.5" />
              <span>थोक व कॉर्पोरेट खरीद • B2B Procurement</span>
            </div>
            <h3 className="font-sans text-2xl font-bold text-[#231f1e]">
              कॉर्पोरेट उपहार और बड़ी मात्रा में सीधी खरीद
            </h3>
            <p className="text-xs sm:text-sm text-[#6f5f58]">
              कारीगर क्लस्टरों से सीधे 100 से 5,000+ इकाइयों के ऑर्डर दें। AI मैचमेकिंग आपको सर्वश्रेष्ठ कारीगरों से मिलाती है।
            </p>
          </div>

          <Link
            href="/b2b"
            className="bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs sm:text-sm py-3.5 px-6 rounded-full transition-all shadow-xs shrink-0 flex items-center gap-2"
          >
            <span>थोक आवश्यकता पोस्ट करें</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FOOTER                                                                 */}
      {/* ========================================================================= */}
      <footer className="border-t border-[#e6ded3] bg-[#faf7f2] pt-12 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="Hunardhara" className="w-8 h-8 rounded-full object-contain" />
                <span className="font-sans font-extrabold text-lg text-[#1b4332]">
                  Hunardhara (हुनरधारा)
                </span>
              </div>
              <p className="text-xs text-[#6f5f58] max-w-md">
                शिल्पकारों के लिए AI-संचालित बाज़ार लिंकेज और स्मार्ट कैटलॉगिंग प्लेटफॉर्म।
              </p>
            </div>

            <div className="flex flex-wrap gap-6 text-xs font-semibold text-[#6f5f58]">
              <Link href="/#collection" className="hover:text-[#1b4332]">शिल्प संग्रह</Link>
              <Link href="/artisan" className="hover:text-[#1b4332]">कारीगर स्टूडियो</Link>
              <Link href="/b2b" className="hover:text-[#1b4332]">थोक खरीद</Link>
              <Link href="/login" className="hover:text-[#1b4332]">खाता लॉगिन</Link>
            </div>
          </div>

          <div className="pt-6 border-t border-[#e6ded3] flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#6f5f58]">
            <p>© 2026 Hunardhara Platform. [Prototype Demonstration • Demo data for pilot clusters]</p>
            <p className="text-[11px] text-[#8c7a72]">
              Made with respect for Indian artisans.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
