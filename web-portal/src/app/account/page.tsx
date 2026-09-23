'use client';

import React from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import {
  User,
  ShoppingBag,
  Package,
  ShieldCheck,
  LogOut,
  MapPin,
  Languages,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Heart,
  Palette
} from 'lucide-react';

export default function AccountPage() {
  return (
    <AuthGuard allowedRoles={['customer', 'artisan', 'admin']}>
      <AccountContent />
    </AuthGuard>
  );
}

function AccountContent() {
  const { user, role, profile, signOut } = useAuth();

  // Privacy-preserving masking for authenticated user's view
  const maskedEmail = user?.email
    ? user.email.replace(/(?<=.{2}).(?=[^@]*?@)/g, '*')
    : 'Verified Account';

  return (
    <main className="min-h-screen bg-[#faf7f2] py-8 sm:py-12 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Profile Card */}
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-6 sm:p-8 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#1b4332] text-white flex items-center justify-center text-2xl font-black shadow-inner shrink-0">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : (role === 'admin' ? 'A' : role === 'artisan' ? 'K' : 'U')}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#1c1917] tracking-tight">
                    {profile?.full_name || (role === 'admin' ? 'Administrator' : role === 'artisan' ? 'Master Artisan' : 'Valued Patron')}
                  </h1>
                  <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                    role === 'admin'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : role === 'artisan'
                      ? 'bg-amber-50 text-[#c85a32] border-amber-200'
                      : 'bg-emerald-50 text-[#1b4332] border-emerald-200'
                  }`}>
                    {role === 'customer' ? 'ग्राहक • Patron' : role === 'artisan' ? 'कारीगर • Artisan' : 'व्यवस्थापक • Admin'}
                  </span>
                </div>
                <p className="text-xs text-[#6f5f58] mt-1 font-mono">
                  {maskedEmail}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-[#545454]">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#c85a32]" />
                    {profile?.state || 'भारत (India)'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Languages className="w-3.5 h-3.5 text-[#1b4332]" />
                    {profile?.preferred_language ? profile.preferred_language.toUpperCase() : 'हिंदी / HINDI'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>साइन आउट (Sign Out)</span>
            </button>
          </div>
        </div>

        {/* CUSTOMER UPGRADE BANNER: "Become an Artisan" */}
        {role === 'customer' && (
          <div className="bg-gradient-to-br from-[#fbf0ea] to-[#fff8f0] rounded-3xl border-2 border-[#f2d3c2] p-6 sm:p-8 relative overflow-hidden shadow-2xs">
            <div className="relative z-10 max-w-xl space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#c85a32] bg-white px-3 py-1 rounded-full border border-[#f2d3c2] inline-block">
                कारीगर अवसर • Artisan Upgrade
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1c1917] tracking-tight">
                क्या आप हस्तशिल्प निर्माता हैं? अपना हुनर बेचें!
              </h2>
              <p className="text-xs sm:text-sm text-[#545454] leading-relaxed">
                हस्तशिल्प, हथकरघा या पारंपरिक कला बनाते हैं? हुनरधारा कारीगर नेटवर्क से जुड़ें। बिना बिचौलियों के सीधे खरीदारों को बेचें और 100% वैधानिक पारिश्रमिक प्राप्त करें।
              </p>
              <div className="pt-2">
                <Link
                  href="/artisan"
                  className="inline-flex items-center gap-2 bg-[#c85a32] hover:bg-[#b84e28] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-full transition-all shadow-xs"
                >
                  <Palette className="w-4 h-4" />
                  <span>कारीगर कार्यशाला खोलें (Open Artisan Studio)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="hidden md:block absolute right-6 bottom-4 opacity-15 pointer-events-none">
              <Palette className="w-36 h-36 text-[#c85a32]" />
            </div>
          </div>
        )}

        {/* Quick Nav Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/orders"
            className="group bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-6 transition-all hover:border-[#1b4332] hover:shadow-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1b4332] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1c1917]">मेरे ऑर्डर (My Orders)</h3>
                <p className="text-xs text-[#6f5f58] mt-0.5">ऑर्डर ट्रैकिंग व डिजिटल शिल्प पासपोर्ट</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#8f8179] group-hover:text-[#1b4332] transition-colors" />
          </Link>

          <Link
            href="/cart"
            className="group bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-6 transition-all hover:border-[#1b4332] hover:shadow-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#c85a32] flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1c1917]">शॉपिंग कार्ट (My Cart)</h3>
                <p className="text-xs text-[#6f5f58] mt-0.5">चयनित हस्तशिल्प और पारिश्रमिक विवरण</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#8f8179] group-hover:text-[#c85a32] transition-colors" />
          </Link>

          <Link
            href="/#collection"
            className="group bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-6 transition-all hover:border-[#1b4332] hover:shadow-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1c1917]">शिल्प बाज़ार (Explore Crafts)</h3>
                <p className="text-xs text-[#6f5f58] mt-0.5">भारत भर के 5 प्रमुख शिल्प क्लस्टर</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#8f8179] group-hover:text-blue-700 transition-colors" />
          </Link>

          <Link
            href="/b2b"
            className="group bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-6 transition-all hover:border-[#1b4332] hover:shadow-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1c1917]">थोक मांग (B2B Bulk Procurement)</h3>
                <p className="text-xs text-[#6f5f58] mt-0.5">थोक ऑर्डर और सीधी कारीगर साझेदारी</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#8f8179] group-hover:text-purple-700 transition-colors" />
          </Link>
        </div>

        {/* DPDP 2023 Compliance & Security Notice */}
        <div className="bg-[#faf7f2] rounded-2xl p-4 border border-[#e6ded3] flex items-center gap-3 text-xs text-[#6f5f58]">
          <ShieldCheck className="w-5 h-5 text-[#1b4332] shrink-0" />
          <span>
            डिजिटल व्यक्तिगत डेटा संरक्षण (DPDP) अधिनियम 2023 के तहत आपका खाता एवं व्यक्तिगत डेटा एन्क्रिप्टेड और सुरक्षित है। निजी ईमेल कभी सार्वजनिक नहीं किए जाते।
          </span>
        </div>
      </div>
    </main>
  );
}
