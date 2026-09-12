'use client';

import React, { useState, Suspense } from 'react';
import { useAuth, UserRole } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  ShoppingBag,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Send,
  Crown,
  Camera
} from 'lucide-react';
import Link from 'next/link';
import { PRIMARY_ADMIN_EMAIL } from '@/lib/adminAuth';

function maskEmailDisplay(raw: string): string {
  if (!raw || !raw.includes('@')) return 'your email';
  const [name, domain] = raw.split('@');
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

function LoginFormContent() {
  const {
    signIn,
    signInWithMagicLink,
    verifyOtp,
    signUp,
    loginWithDemoAccount,
    user,
    role
  } = useAuth();

  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTarget = searchParams.get('redirect') || '/artisan';
  const isBlockedDirectAccess = searchParams.get('blocked') === 'direct_admin_link' || searchParams.get('blocked') === 'direct_admin_access';
  const customMessage = isBlockedDirectAccess
    ? 'Direct access to the Admin Panel is blocked. Only the authorized administrator email can enter.'
    : (searchParams.get('msg') || 'Access your Artisan Studio, products, AI cataloging tools and earnings.');

  const [mode, setMode] = useState<'magiclink' | 'password' | 'signup'>('magiclink');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('artisan');
  const [artisanLanguage, setArtisanLanguage] = useState('Hindi (हिंदी)');
  const [artisanCraftCategory, setArtisanCraftCategory] = useState('Varanasi Silk Brocade');
  const [customerInterest, setCustomerInterest] = useState('All Heritage Crafts');

  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect based on role-specific window
  React.useEffect(() => {
    if (user && role) {
      if (role === 'customer') {
        const dest = searchParams.get('redirect');
        if (dest && !dest.startsWith('/artisan') && !dest.startsWith('/admin')) {
          router.push(dest);
        } else {
          router.push('/');
        }
      } else if (role === 'admin') {
        router.push(searchParams.get('redirect') || '/admin');
      } else {
        // Artisan has window of selling and uploading
        router.push(searchParams.get('redirect') || '/artisan');
      }
    }
  }, [user, role, searchParams, router]);

  // Handle URL hash fragments & query errors from Magic Link redirect
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const errorDesc = params.get('error_description');
      const errorCode = params.get('error_code');
      const accessToken = params.get('access_token');

      if (errorDesc || errorCode) {
        setErrorMsg(decodeURIComponent(errorDesc || 'Magic link verification failed. Please enter the 6-digit code or request a new link.'));
      } else if (accessToken) {
        setSuccessMsg('Verifying session... Redirecting to dashboard (सत्यापन हो रहा है...).');
      }
    }

    const queryError = searchParams.get('error_description');
    if (queryError) {
      setErrorMsg(decodeURIComponent(queryError));
    }
  }, [searchParams]);

  // Handle Magic Link Request
  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/login`
      : undefined;

    const { error } = await signInWithMagicLink(email, redirectUrl);

    setIsSubmitting(false);
    if (error) {
      setErrorMsg(error.message || 'Failed to send magic link. Please check your email.');
    } else {
      setMagicLinkSent(true);
      const masked = maskEmailDisplay(email);
      setSuccessMsg(
        `Magic login link and OTP code dispatched to ${masked}! Enter the 6-digit code below or click the email link.`
      );
    }
  };

  // Handle OTP Code Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!otpCode.trim()) {
      setErrorMsg('Please enter the verification code received in your email.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await verifyOtp(email, otpCode);
    setIsSubmitting(false);

    if (error) {
      setErrorMsg(error.message || 'Invalid or expired code. Please try again or request a new link.');
    } else {
      router.push(redirectTarget);
    }
  };

  // Handle Standard Password Login / Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    if (mode === 'password') {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorMsg(error.message || 'Invalid email or password. Please try again.');
        setIsSubmitting(false);
      } else {
        router.push(redirectTarget);
      }
    } else if (mode === 'signup') {
      if (!fullName.trim()) {
        setErrorMsg('Please enter your full name (कृपया अपना नाम दर्ज करें).');
        setIsSubmitting(false);
        return;
      }
      const extraMeta = selectedRole === 'artisan'
        ? { preferred_language: artisanLanguage, craft_category: artisanCraftCategory }
        : { interest: customerInterest };
      const { error } = await signUp(email, password, fullName, selectedRole, extraMeta);
      if (error) {
        setErrorMsg(error.message || 'Failed to create account.');
        setIsSubmitting(false);
      } else {
        if (selectedRole === 'artisan') {
          router.push('/artisan');
        } else {
          const dest = searchParams.get('redirect');
          if (dest && !dest.startsWith('/artisan') && !dest.startsWith('/admin')) {
            router.push(dest);
          } else {
            router.push('/');
          }
        }
      }
    }
  };

  // Fast Demo Logins
  const handleFastDemoLogin = async (targetRole: UserRole) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    const { error } = await loginWithDemoAccount(targetRole);
    if (error) {
      setErrorMsg(error.message || 'Failed to authenticate with demo account.');
      setIsSubmitting(false);
    } else {
      router.push(redirectTarget);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12 px-4">
      {/* Brand Header */}
      <div className="text-center space-y-3 mb-8">
        <div className="w-14 h-14 rounded-full bg-white p-1 shadow-md mx-auto border border-[#e4e4e7] overflow-hidden flex items-center justify-center">
          <img src="/logo.png" alt="Hunardhara" className="w-full h-full object-contain" />
        </div>
        <div className="inline-flex items-center gap-1.5 bg-[#1b4332]/10 text-[#1b4332] text-[11px] font-bold px-3 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1b4332]" />
          <span>Hunardhara Auth • हुनरधारा प्रमाणीकरण</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1c1917] tracking-tight">
          Sign in to continue
        </h1>
        <p className="text-xs sm:text-sm text-[#545454] max-w-sm mx-auto leading-relaxed">
          {customMessage}
        </p>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-3xl border border-[#e4e4e7] p-6 sm:p-8 bento-shadow space-y-6">
        {/* Direct Admin Access Blocked Security Banner */}
        {isBlockedDirectAccess && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 text-left">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-bold text-red-800 uppercase tracking-wider block">
                प्रशासकीय लिंक अवरोधित • Direct Admin Access Blocked
              </span>
              <p className="text-red-700 leading-relaxed">
                Direct URL navigation to the Admin Panel has been blocked. Only the verified administrator (<strong className="font-mono">{PRIMARY_ADMIN_EMAIL}</strong>) is authorized. Please sign in below with the authorized email.
              </p>
            </div>
          </div>
        )}

        {/* 3-Way Mode Toggle */}
        <div className="grid grid-cols-3 bg-[#f4f4f5] p-1 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => {
              setMode('magiclink');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${mode === 'magiclink' ? 'bg-white shadow-xs text-[#1c1917]' : 'text-[#71717a] hover:text-[#1c1917]'}`}
          >
            <Send className="w-3 h-3 text-[#F5A941]" />
            <span>Magic Link</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('password');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${mode === 'password' ? 'bg-white shadow-xs text-[#1c1917]' : 'text-[#71717a] hover:text-[#1c1917]'}`}
          >
            <Lock className="w-3 h-3 text-[#71717a]" />
            <span>Password</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${mode === 'signup' ? 'bg-white shadow-xs text-[#1c1917]' : 'text-[#71717a] hover:text-[#1c1917]'}`}
          >
            <span>Register</span>
          </button>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-2xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-2xl flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODE 1: MAGIC LINK & OTP (PASSWORDLESS) */}
        {mode === 'magiclink' && (
          <div className="space-y-4">
            {!magicLinkSent ? (
              <form onSubmit={handleSendMagicLink} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#545454] mb-1.5">
                    Your Email Address (ईमेल पता)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="artisan@hunardhara.gov.in"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] text-xs sm:text-sm text-[#1c1917] focus:outline-hidden focus:border-[#F5A941] focus:bg-white transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-[#71717a] mt-1.5 leading-normal">
                    We will dispatch a secure passwordless login link and a 6-digit verification code directly to your email.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#F5A941] hover:bg-[#e09432] disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 rounded-full transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Magic Link & OTP (जादुई लिंक भेजें)</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#545454]">
                      Enter 6-Digit Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={() => setMagicLinkSent(false)}
                      className="text-[11px] text-[#F5A941] hover:underline font-semibold"
                    >
                      Change Email
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] text-sm font-mono tracking-widest text-[#1c1917] focus:outline-hidden focus:border-[#F5A941] focus:bg-white transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-[#71717a] mt-1.5">
                    Alternatively, click the direct sign-in button inside the email we sent to <strong>{maskEmailDisplay(email)}</strong>.
                  </p>
                  <div className="bg-amber-50/80 border border-amber-200/80 text-amber-900 rounded-xl p-2.5 mt-2.5 flex items-start gap-2 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Instant Sign-in:</strong> If the email link redirects to localhost:3000, simply copy the 6-digit code from your email and enter it here to sign in immediately without leaving this page!
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#1c1917] hover:bg-[#27272a] disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 rounded-full transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#F5A941]" />
                      <span>Verify Code & Sign In (सत्यापित करें)</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* MODE 2 & 3: PASSWORD LOGIN & REGISTRATION */}
        {mode !== 'magiclink' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="text-center space-y-1 mb-4 pb-2 border-b border-[#f4f4f5]">
                  <div className="inline-flex items-center gap-1.5 bg-[#c85a32]/10 text-[#c85a32] text-[11px] font-bold px-3 py-1 rounded-full">
                    <span>Welcome to Hunardhara • हुनरधारा</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#1c1917]">
                    How will you use Hunardhara?
                  </h2>
                  <p className="text-xs text-[#545454]">
                    आप हुनरधारा का उपयोग कैसे करेंगे? खाता प्रकार चुनें
                  </p>
                </div>

                {/* 2 Large Mobile-First Role Selection Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('artisan')}
                    className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between gap-3 transition-all ${
                      selectedRole === 'artisan'
                        ? 'border-[#c85a32] bg-[#fdf8f6] shadow-sm ring-2 ring-[#c85a32]/20'
                        : 'border-[#e4e4e7] bg-white hover:border-[#c85a32]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${selectedRole === 'artisan' ? 'bg-[#c85a32] text-white shadow-xs' : 'bg-neutral-100 text-[#545454]'}`}>
                          🎨
                        </div>
                        <div>
                          <span className="block text-sm font-extrabold text-[#1c1917]">I&apos;m an Artisan</span>
                          <span className="text-xs font-bold text-[#c85a32]">Sell my products</span>
                        </div>
                      </div>
                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${selectedRole === 'artisan' ? 'bg-[#c85a32] text-white' : 'bg-neutral-100 text-[#71717a]'}`}>
                        कारीगर
                      </span>
                    </div>
                    <p className="text-xs text-[#545454] leading-relaxed">
                      अपने हस्तशिल्प उत्पाद अपलोड करें, AI कैटलॉग बनाएं और सीधे ग्राहकों को उचित मूल्य पर बेचें।
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('customer')}
                    className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between gap-3 transition-all ${
                      selectedRole === 'customer'
                        ? 'border-[#1b4332] bg-[#f4f8f5] shadow-sm ring-2 ring-[#1b4332]/20'
                        : 'border-[#e4e4e7] bg-white hover:border-[#1b4332]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${selectedRole === 'customer' ? 'bg-[#1b4332] text-white shadow-xs' : 'bg-neutral-100 text-[#545454]'}`}>
                          🛍
                        </div>
                        <div>
                          <span className="block text-sm font-extrabold text-[#1c1917]">I&apos;m a Customer</span>
                          <span className="text-xs font-bold text-[#1b4332]">Discover & buy crafts</span>
                        </div>
                      </div>
                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${selectedRole === 'customer' ? 'bg-[#1b4332] text-white' : 'bg-neutral-100 text-[#71717a]'}`}>
                        ग्राहक
                      </span>
                    </div>
                    <p className="text-xs text-[#545454] leading-relaxed">
                      प्रमाणित भारतीय हस्तशिल्प खोजें, सीधे मास्टर कारीगरों से प्रामाणिक उत्पाद ऑर्डर करें व खरीदें।
                    </p>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#545454] mb-1.5">
                    Full Name (पूरा नाम)
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Radheshyam Ansari"
                    className="w-full px-4 py-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] text-xs sm:text-sm text-[#1c1917] focus:outline-hidden focus:border-[#F5A941] focus:bg-white transition-colors"
                  />
                </div>

                {/* Role-Specific Progressive Essential Fields */}
                {selectedRole === 'artisan' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#545454] mb-1.5">
                        Preferred Language (भाषा)
                      </label>
                      <select
                        value={artisanLanguage}
                        onChange={(e) => setArtisanLanguage(e.target.value)}
                        className="w-full px-3.5 py-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] text-xs sm:text-sm text-[#1c1917] focus:outline-hidden focus:border-[#c85a32] focus:bg-white transition-colors"
                      >
                        <option value="Hindi (हिंदी)">हिंदी (Hindi)</option>
                        <option value="English">English</option>
                        <option value="Bengali (বাংলা)">বাংলা (Bengali)</option>
                        <option value="Tamil (தமிழ்)">தமிழ் (Tamil)</option>
                        <option value="Telugu (తెలుగు)">తెలుగు (Telugu)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#545454] mb-1.5">
                        Craft Category (शिल्प श्रेणी)
                      </label>
                      <select
                        value={artisanCraftCategory}
                        onChange={(e) => setArtisanCraftCategory(e.target.value)}
                        className="w-full px-3.5 py-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] text-xs sm:text-sm text-[#1c1917] focus:outline-hidden focus:border-[#c85a32] focus:bg-white transition-colors"
                      >
                        <option value="Varanasi Silk Brocade">Varanasi Silk Brocade (वाराणसी रेशम)</option>
                        <option value="Bastar Dhokra Bell Metal">Bastar Dhokra (बस्तर ढोकरा पीतल)</option>
                        <option value="Khurja Studio Pottery">Khurja Pottery (खुरजा पॉटरी)</option>
                        <option value="Madhubani Painting">Madhubani Painting (मधुबनी चित्रकला)</option>
                        <option value="Channapatna Lacquer Toys">Channapatna Toys (चन्नापटना खिलौने)</option>
                        <option value="Traditional Handloom">Traditional Handloom (पारंपरिक हथकरघा)</option>
                        <option value="Other Heritage Craft">Other Craft (अन्य हस्तशिल्प)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#545454] mb-1.5">
                      Craft Interests (शिल्प रुचि - ऐच्छिक)
                    </label>
                    <select
                      value={customerInterest}
                      onChange={(e) => setCustomerInterest(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] text-xs sm:text-sm text-[#1c1917] focus:outline-hidden focus:border-[#1b4332] focus:bg-white transition-colors"
                    >
                      <option value="All Heritage Crafts">All Traditional Crafts (सभी पारंपरिक शिल्प)</option>
                      <option value="Home & Living">Home Decor & Living (गृह सज्जा व वस्त्र)</option>
                      <option value="Heritage Fashion">Heritage Fashion (रेशम व हथकरघा परिधान)</option>
                      <option value="Art & Collectibles">Art & Metal Figurines (कला संग्रह व मूर्तियां)</option>
                      <option value="Handmade Toys & Gifts">Toys & Gifting (पारंपरिक खिलौने व उपहार)</option>
                    </select>
                  </div>
                )}
              </>
            )}

            {mode !== 'signup' && (
              <div className="p-3 bg-[#faf7f2] rounded-2xl border border-[#e6ded3] text-center mb-1">
                <p className="text-xs font-bold text-[#1b4332]">
                  {role === 'artisan'
                    ? 'Welcome back 👋 Ready to grow your craft?'
                    : role === 'customer'
                    ? 'Welcome back 👋 Ready to discover something handcrafted?'
                    : 'Sign in to access your Hunardhara workspace'}
                </p>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#545454] mb-1.5">
                Email Address (ईमेल)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="artisan@hunardhara.gov.in"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] text-xs sm:text-sm text-[#1c1917] focus:outline-hidden focus:border-[#F5A941] focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#545454] mb-1.5">
                Password (पासवर्ड)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] text-xs sm:text-sm text-[#1c1917] focus:outline-hidden focus:border-[#F5A941] focus:bg-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#F5A941] hover:bg-[#e09432] disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 rounded-full transition-all shadow-xs flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'password' ? 'Sign In Securely' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* FAST EVALUATOR & ADMIN DEMO LOGINS */}
        <div className="pt-4 border-t border-[#e4e4e7] space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#71717a]">
            <span>Fast Logins (Click to Test)</span>
            <span className="bg-amber-100 text-[#b45309] px-2 py-0.5 rounded-md text-[10px]">Instant Access</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleFastDemoLogin('admin')}
              disabled={isSubmitting}
              className="p-3 rounded-xl border-2 border-[#F5A941] bg-[#fffbeb] hover:bg-[#fef3c7] text-left transition-all group col-span-1 sm:col-span-2 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#b45309]">
                  <Crown className="w-4 h-4 text-[#d97706]" />
                  <span>Lead Platform Administrator (Aryan)</span>
                </div>
                <span className="text-[9px] uppercase font-bold bg-[#F5A941] text-white px-2 py-0.5 rounded-full">
                  Authorised Admin
                </span>
              </div>
              <p className="text-[10px] text-[#71717a] mt-1 font-mono">
                {PRIMARY_ADMIN_EMAIL} • Exclusive Admin Clearance
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleFastDemoLogin('artisan')}
              disabled={isSubmitting}
              className="p-2.5 rounded-xl border border-[#e4e4e7] hover:border-[#F5A941] hover:bg-[#fafafa] text-left transition-all group"
            >
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#1c1917] group-hover:text-[#b45309]">
                <UserCheck className="w-3.5 h-3.5 text-[#F5A941]" />
                <span>Verified Master Artisan</span>
              </div>
              <p className="text-[10px] text-[#71717a] mt-0.5 truncate">Varanasi Silk Cluster</p>
            </button>

            <button
              type="button"
              onClick={() => handleFastDemoLogin('customer')}
              disabled={isSubmitting}
              className="p-2.5 rounded-xl border border-[#e4e4e7] hover:border-[#1c1917] hover:bg-[#fafafa] text-left transition-all group"
            >
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#1c1917]">
                <ShoppingBag className="w-3.5 h-3.5 text-[#1c1917]" />
                <span>Institutional Patron</span>
              </div>
              <p className="text-[10px] text-[#71717a] mt-0.5 truncate">TRIFED Bulk Procurement</p>
            </button>
          </div>
        </div>
      </div>

      <div className="text-center mt-6 text-xs text-[#71717a]">
        <Link href="/" className="hover:text-[#1c1917] transition-colors">
          ← Return to Public Marketplace
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#F5A941] border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
