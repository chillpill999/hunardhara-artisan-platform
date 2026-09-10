'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@/context/AuthContext';
import { ShieldAlert, Lock, ArrowLeft, LogOut, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  redirectMessage?: string;
}

export default function AuthGuard({
  children,
  allowedRoles,
  redirectMessage = 'Sign in to continue. Access your Artisan Studio, products, AI cataloging tools and earnings.',
}: AuthGuardProps) {
  const { user, role, isLoading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      const redirectUrl = `/login?redirect=${encodeURIComponent(pathname || '/')}&msg=${encodeURIComponent(redirectMessage)}`;
      router.replace(redirectUrl);
    }
  }, [user, isLoading, pathname, redirectMessage, router]);

  // While checking auth, do not render children
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-10 h-10 rounded-full border-3 border-[#F5A941] border-t-transparent animate-spin" />
        <p className="text-xs text-[#545454] font-medium tracking-wide uppercase">
          Verifying credentials & cryptographic session...
        </p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#fef2f2] text-[#ef4444] flex items-center justify-center shadow-xs">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#1c1917]">Authentication Required</h2>
        <p className="text-xs text-[#545454] max-w-sm">{redirectMessage}</p>
        <Link
          href={`/login?redirect=${encodeURIComponent(pathname || '/')}`}
          className="bg-[#F5A941] hover:bg-[#e09432] text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all"
        >
          Sign In Now
        </Link>
      </div>
    );
  }

  // Check Role Authorization
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const isCustomerAccessingArtisan = role === 'customer' && allowedRoles.includes('artisan');

    if (isCustomerAccessingArtisan) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-5 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-[#c85a32] flex items-center justify-center shadow-xs border border-amber-200">
            <ShoppingBag className="w-8 h-8 text-[#c85a32]" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#c85a32] bg-amber-50 px-3.5 py-1 rounded-full border border-amber-200">
              कारीगर विक्रय विंडो • Artisan Selling Window
            </span>
            <h2 className="text-2xl font-extrabold text-[#1c1917] tracking-tight">
              Customer Account (ग्राहक खाता)
            </h2>
            <p className="text-xs sm:text-sm text-[#545454] leading-relaxed max-w-sm mx-auto">
              यह विंडो केवल पंजीकृत कारीगरों के लिए है जहां वे हस्तशिल्प फोटो अपलोड और बेच सकते हैं। आपके पास ग्राहक के रूप में ई-कॉमर्स बाज़ार का पूर्ण उपयोग है।
            </p>
            <p className="text-[11px] text-[#71717a]">
              Customer accounts have direct access to purchasing and browsing. Craft uploading is reserved for registered artisans.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 w-full">
            <Link
              href="/"
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-full bg-[#1b4332] hover:bg-[#2d6a4f] text-white transition-all shadow-xs"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>ई-कॉमर्स बाज़ार देखें</span>
            </Link>
            <Link
              href="/artisan/apply"
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-full bg-[#c85a32] hover:bg-[#b84e28] text-white transition-all shadow-xs"
            >
              <span>कारीगर बनें (Apply to Sell)</span>
            </Link>
            <button
              onClick={() => signOut()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-full border border-[#e4e4e7] hover:bg-[#f4f4f5] text-[#545454] transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>स्विच खाता</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-5 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-full bg-[#fef2f2] text-[#ef4444] flex items-center justify-center shadow-sm border border-red-200">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
            प्रशासनिक सुरक्षा • Administrative Privilege Required
          </span>
          <h2 className="text-2xl font-extrabold text-[#1c1917] mt-3">
            Permission Required
          </h2>
          <p className="text-xs text-[#545454] mt-2 leading-relaxed">
            This administrative area requires elevated credentials ({allowedRoles.join(' or ')}). Your account is currently authenticated as <strong className="capitalize text-[#1c1917]">{role}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border border-[#e4e4e7] hover:bg-[#f4f4f5] text-[#545454] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Marketplace</span>
          </Link>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-[#1c1917] hover:bg-[#27272a] text-white transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Switch Account</span>
          </button>
        </div>
      </div>
    );
  }

  // Authenticated and authorized
  return <>{children}</>;
}
