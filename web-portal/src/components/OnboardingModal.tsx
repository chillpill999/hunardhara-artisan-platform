'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/context/AuthContext';
import {
  Sparkles,
  AlertCircle,
  Phone,
  User as UserIcon,
  MapPin,
  Languages,
  Palette,
  ShoppingBag,
  ArrowRight,
  LogOut,
} from 'lucide-react';

export default function OnboardingModal() {
  const { user, needsOnboarding, completeOnboarding, signOut } = useAuth();
  const router = useRouter();

  // Explicit role selection required: starts as null so user cannot skip or be auto-assigned
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('Uttar Pradesh');
  const [craftCategory, setCraftCategory] = useState('Varanasi Silk Brocade');
  const [preferredLanguage, setPreferredLanguage] = useState('Hindi (हिंदी)');
  const [customerInterest, setCustomerInterest] = useState('All Heritage Crafts');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock body scroll while onboarding modal is active
  useEffect(() => {
    if (user && needsOnboarding) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [user, needsOnboarding]);

  // Prepopulate details from Google metadata if available
  useEffect(() => {
    if (user) {
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      if (metaName && !fullName) {
        setFullName(metaName);
      }
      const metaPhone = user.user_metadata?.phone || '';
      if (metaPhone && !phone) {
        setPhone(metaPhone);
      }
      const metaRole = user.user_metadata?.role;
      if (metaRole === 'artisan' || metaRole === 'customer') {
        setSelectedRole(metaRole);
      }
      const metaCraft = user.user_metadata?.craft_category;
      if (metaCraft) {
        setCraftCategory(metaCraft);
      }
    }
  }, [user]);

  if (!user || !needsOnboarding) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedRole) {
      setErrorMsg('कृपया अपना खाता प्रकार चुनें: क्या आप "कारीगर / शिल्पकार" हैं या "खरीदार / ग्राहक"? (Please choose your account role to continue).');
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg('कृपया अपना पूरा नाम दर्ज करें (Please enter your full name).');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('कृपया एक वैध 10-अंकीय मोबाइल / व्हाट्सएप नंबर दर्ज करें (Please enter a valid 10-digit mobile/WhatsApp number).');
      return;
    }

    setIsSubmitting(true);
    const { error } = await completeOnboarding({
      role: selectedRole,
      fullName: fullName.trim(),
      phone: phone.trim(),
      state: selectedRole === 'artisan' ? state : undefined,
      craft_category: selectedRole === 'artisan' ? craftCategory : undefined,
      preferred_language: selectedRole === 'artisan' ? preferredLanguage : undefined,
      interest: selectedRole === 'customer' ? customerInterest : undefined,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMsg(error.message || 'विवरण सहेजने में विफल। कृपया पुनः प्रयास करें।');
    } else {
      if (selectedRole === 'artisan') {
        router.push('/artisan?tab=studio');
      } else {
        router.push('/');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-[#e6ded3] max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-[#faf7f2] border border-[#e6ded3] text-[#c85a32] text-[11px] font-bold px-3.5 py-1 rounded-full shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#e9a83a]" />
            <span>Google Sign-in • पहला लॉगिन सेटअप</span>
          </div>

          <h2 className="font-sans text-2xl font-extrabold text-[#231f1e]">
            हुनरधारा में आपका स्वागत है!
          </h2>

          <p className="text-xs text-[#6f5f58] leading-relaxed">
            आपका Google खाता <strong className="text-[#231f1e] font-mono">{user.email}</strong> सफलतापूर्वक जुड़ गया है। कृपया अपना खाता प्रकार और विवरण पूरा करें:
          </p>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-2xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Choice */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6f5f58] mb-2">
              खाता प्रकार चुनें (Choose Account Role)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Artisan Choice */}
              <button
                type="button"
                onClick={() => setSelectedRole('artisan')}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer ${
                  selectedRole === 'artisan'
                    ? 'border-[#c85a32] bg-[#fdf8f6] shadow-sm ring-2 ring-[#c85a32]/20'
                    : 'border-[#e6ded3] bg-white hover:border-[#c85a32]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-[#c85a32] text-white shadow-2xs">
                    🎨
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    selectedRole === 'artisan' ? 'bg-[#c85a32] text-white' : 'bg-[#faf7f2] text-[#6f5f58]'
                  }`}>
                    कारीगर / शिल्पकार
                  </span>
                </div>
                <div>
                  <span className="block text-sm font-extrabold text-[#231f1e]">I am an Artisan</span>
                  <p className="text-[11px] text-[#6f5f58] mt-0.5 leading-snug">
                    अपने हस्तशिल्प सूचीबद्ध करें, AI कैटलॉग बनाएं और सीधे बेचें।
                  </p>
                </div>
              </button>

              {/* Customer / Patron Choice */}
              <button
                type="button"
                onClick={() => setSelectedRole('customer')}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer ${
                  selectedRole === 'customer'
                    ? 'border-[#1b4332] bg-[#f4f8f5] shadow-sm ring-2 ring-[#1b4332]/20'
                    : 'border-[#e6ded3] bg-white hover:border-[#1b4332]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-[#1b4332] text-white shadow-2xs">
                    🛍️
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    selectedRole === 'customer' ? 'bg-[#1b4332] text-white' : 'bg-[#faf7f2] text-[#6f5f58]'
                  }`}>
                    खरीदार / संरक्षक
                  </span>
                </div>
                <div>
                  <span className="block text-sm font-extrabold text-[#231f1e]">I am a Buyer</span>
                  <p className="text-[11px] text-[#6f5f58] mt-0.5 leading-snug">
                    सत्यापित शिल्प खरीदें या थोक B2B मांग कारीगरों से सीधे पूछें।
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Full Name Input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6f5f58] mb-1.5">
              पूरा नाम (Full Name)
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Radheshyam Ansari"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e6ded3] bg-[#faf7f2] text-xs sm:text-sm text-[#231f1e] focus:outline-hidden focus:border-[#c85a32] focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Mobile / WhatsApp Number Input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6f5f58] mb-1.5">
              मोबाइल / व्हाट्सएप नंबर (Mobile / WhatsApp)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e6ded3] bg-[#faf7f2] text-xs sm:text-sm text-[#231f1e] focus:outline-hidden focus:border-[#c85a32] focus:bg-white transition-colors"
              />
            </div>
            <p className="text-[10.5px] text-[#6f5f58] mt-1">
              {selectedRole === 'artisan'
                ? 'खरीदारों से सीधे पूछताछ व ऑर्डर सूचनाएं प्राप्त करने के लिए आवश्यक।'
                : 'ऑर्डर डिलीवरी व कारीगर संचार के लिए प्रयुक्त।'}
            </p>
          </div>

          {/* Role Specific Fields */}
          {selectedRole === null ? (
            <div className="bg-[#fdfaf6] border-2 border-dashed border-[#e6ded3] p-4 rounded-2xl text-center space-y-1">
              <span className="text-xs font-bold text-[#c85a32]">👆 कृपया ऊपर दिए गए विकल्पों में से अपना खाता प्रकार चुनें</span>
              <p className="text-[11px] text-[#6f5f58]">
                कारीगर (Artisan) या खरीदार (Buyer) चुनें ताकि हम आपके लिए प्रासंगिक सेटअप तैयार कर सकें।
              </p>
            </div>
          ) : selectedRole === 'artisan' ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Craft Category */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6f5f58] mb-1.5 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5 text-[#c85a32]" />
                    <span>शिल्प श्रेणी (Craft Type)</span>
                  </label>
                  <select
                    value={craftCategory}
                    onChange={(e) => setCraftCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#e6ded3] bg-[#faf7f2] text-xs text-[#231f1e] focus:outline-hidden focus:border-[#c85a32] focus:bg-white"
                  >
                    <option value="Varanasi Silk Brocade">Varanasi Silk Brocade (वाराणसी रेशम)</option>
                    <option value="Bastar Dhokra Bell Metal">Bastar Dhokra (बस्तर ढोकरा धातु)</option>
                    <option value="Khurja Studio Pottery">Khurja Pottery (खुरजा पॉटरी)</option>
                    <option value="Madhubani Painting">Madhubani Painting (मधुबनी चित्रकला)</option>
                    <option value="Channapatna Lacquer Toys">Channapatna Toys (चन्नापटना खिलौने)</option>
                    <option value="Traditional Handloom">Traditional Handloom (पारंपरिक हथकरघा)</option>
                    <option value="Terracotta & Clay Art">Terracotta & Clay (टेराकोटा व मिट्टी)</option>
                    <option value="Other Regional Craft">Other Craft (अन्य पारंपरिक शिल्प)</option>
                  </select>
                </div>

                {/* State of Origin */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6f5f58] mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#c85a32]" />
                    <span>राज्य (Workshop State)</span>
                  </label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#e6ded3] bg-[#faf7f2] text-xs text-[#231f1e] focus:outline-hidden focus:border-[#c85a32] focus:bg-white"
                  >
                    <option value="Uttar Pradesh">Uttar Pradesh (उत्तर प्रदेश)</option>
                    <option value="Bihar">Bihar (बिहार)</option>
                    <option value="Chhattisgarh">Chhattisgarh (छत्तीसगढ़)</option>
                    <option value="Karnataka">Karnataka (कर्नाटक)</option>
                    <option value="Rajasthan">Rajasthan (राजस्थान)</option>
                    <option value="West Bengal">West Bengal (पश्चिम बंगाल)</option>
                    <option value="Odisha">Odisha (ओडिशा)</option>
                    <option value="Gujarat">Gujarat (गुजरात)</option>
                    <option value="Madhya Pradesh">Madhya Pradesh (मध्य प्रदेश)</option>
                    <option value="Assam">Assam (असम)</option>
                    <option value="Other State">Other State (अन्य राज्य)</option>
                  </select>
                </div>
              </div>

              {/* Preferred Language */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6f5f58] mb-1.5 flex items-center gap-1">
                  <Languages className="w-3.5 h-3.5 text-[#c85a32]" />
                  <span>संवाद भाषा (Preferred Language)</span>
                </label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#e6ded3] bg-[#faf7f2] text-xs text-[#231f1e] focus:outline-hidden focus:border-[#c85a32] focus:bg-white"
                >
                  <option value="Hindi (हिंदी)">हिंदी (Hindi)</option>
                  <option value="English">English</option>
                  <option value="Bengali (বাংলা)">বাংলা (Bengali)</option>
                  <option value="Tamil (தமிழ்)">தமிழ் (Tamil)</option>
                  <option value="Telugu (తెలుగు)">తెలుగు (Telugu)</option>
                  <option value="Marathi (मराठी)">मराठी (Marathi)</option>
                  <option value="Gujarati (ગુજરાતી)">ગુજરાતી (Gujarati)</option>
                  <option value="Kannada (ಕನ್ನಡ)">ಕನ್ನಡ (Kannada)</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6f5f58] mb-1.5 flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-[#1b4332]" />
                <span>प्राथमिक रुचि (Sourcing Interest)</span>
              </label>
              <select
                value={customerInterest}
                onChange={(e) => setCustomerInterest(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#e6ded3] bg-[#faf7f2] text-xs text-[#231f1e] focus:outline-hidden focus:border-[#1b4332] focus:bg-white"
              >
                <option value="All Heritage Crafts">All Traditional Crafts (सभी पारंपरिक शिल्प)</option>
                <option value="Home & Living">Home Decor & Living (गृह सज्जा व वस्त्र)</option>
                <option value="Heritage Fashion">Heritage Fashion (रेशम व हथकरघा परिधान)</option>
                <option value="Art & Collectibles">Art & Metal Figurines (कला संग्रह व मूर्तियां)</option>
                <option value="Handmade Toys & Gifts">Toys & Gifting (पारंपरिक खिलौने व उपहार)</option>
                <option value="Bulk & Corporate Gifting">Bulk & Corporate Sourcing (थोक व संस्थागत खरीद)</option>
              </select>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-3 space-y-2.5">
            <button
              type="submit"
              disabled={isSubmitting || !selectedRole}
              className={`w-full text-white font-bold text-xs sm:text-sm py-3.5 rounded-full transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                !selectedRole
                  ? 'bg-neutral-400 cursor-not-allowed'
                  : selectedRole === 'artisan'
                  ? 'bg-[#c85a32] hover:bg-[#b54f2a]'
                  : 'bg-[#1b4332] hover:bg-[#2d6a4f]'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {!selectedRole
                      ? 'पहले खाता प्रकार चुनें (Select Role to Continue)'
                      : selectedRole === 'artisan'
                      ? 'कारीगर खाता पूरा करें व स्टूडियो जाएं (Save & Open Studio)'
                      : 'खरीदार खाता पूरा करें व बाज़ार देखें (Save & View Marketplace)'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => signOut()}
              className="w-full text-center text-[11px] text-[#6f5f58] hover:text-red-600 transition-colors flex items-center justify-center gap-1 py-1 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>दूसरे खाते से लॉगिन करें (Sign in with a different account)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
