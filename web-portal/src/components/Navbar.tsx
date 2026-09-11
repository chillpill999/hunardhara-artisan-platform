'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  User,
  LogOut,
  ShieldCheck,
  Building2,
  LogIn,
  Camera,
  Globe,
  ShoppingBag,
  ShoppingCart,
  Package
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, role, profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[#faf7f2]/95 backdrop-blur-md border-b border-[#e6ded3] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex justify-between items-center">
        {/* Brand Logo & Wordmark */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-[#e6ded3] bg-white p-0.5 shadow-2xs group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Hunardhara"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <span className="font-sans text-xl font-extrabold text-[#1b4332] tracking-tight block">
              Hunardhara
            </span>
            <span className="text-[10px] font-bold text-[#c85a32] -mt-1 block tracking-wider uppercase">
              हुनरधारा • कारीगर बाज़ार
            </span>
          </div>
        </Link>

        {/* Center Desktop Navigation Links (Role-Aware) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#6f5f58]">
          <Link
            href="/"
            className={`transition-colors hover:text-[#1b4332] ${
              pathname === '/' ? 'text-[#1b4332] font-bold' : ''
            }`}
          >
            होम (Home)
          </Link>

          <Link
            href="/#collection"
            className="transition-colors hover:text-[#1b4332]"
          >
            शिल्प संग्रह (Explore)
          </Link>

          {role === 'customer' && (
            <>
              <Link
                href="/cart"
                className={`transition-colors hover:text-[#1b4332] flex items-center gap-1.5 ${
                  pathname.startsWith('/cart') ? 'text-[#1b4332] font-bold' : ''
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 text-[#c85a32]" />
                <span>कार्ट</span>
              </Link>
              <Link
                href="/orders"
                className={`transition-colors hover:text-[#1b4332] flex items-center gap-1.5 ${
                  pathname.startsWith('/orders') ? 'text-[#1b4332] font-bold' : ''
                }`}
              >
                <Package className="w-3.5 h-3.5 text-[#1b4332]" />
                <span>मेरे ऑर्डर</span>
              </Link>
            </>
          )}

          {(role === 'artisan' || role === 'admin') && (
            <Link
              href="/artisan"
              className={`transition-colors hover:text-[#1b4332] flex items-center gap-1.5 ${
                pathname.startsWith('/artisan') ? 'text-[#1b4332] font-bold' : ''
              }`}
            >
              <span>कारीगर स्टूडियो</span>
              {role === 'artisan' && (
                <span className="w-2 h-2 rounded-full bg-[#c85a32]" />
              )}
            </Link>
          )}

          <Link
            href="/b2b"
            className={`transition-colors hover:text-[#1b4332] ${
              pathname.startsWith('/b2b') ? 'text-[#1b4332] font-bold' : ''
            }`}
          >
            थोक मांग (B2B)
          </Link>

          {role === 'admin' && (
            <Link
              href="/admin"
              className={`transition-colors hover:text-[#1b4332] flex items-center gap-1.5 ${
                pathname.startsWith('/admin') ? 'text-[#1b4332] font-bold' : ''
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#c85a32]" />
              <span>क्लस्टर प्रशासन</span>
            </Link>
          )}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Language Indicator */}
          <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-[#6f5f58] bg-white px-2.5 py-1.5 rounded-full border border-[#e6ded3]">
            <Globe className="w-3.5 h-3.5 text-[#1b4332]" />
            <span>हिंदी / EN</span>
          </div>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* User Badge linking to role dashboard/account */}
              <Link
                href={role === 'customer' ? '/account' : role === 'admin' ? '/admin' : '/artisan'}
                className="flex items-center gap-2 bg-white border border-[#e6ded3] hover:border-[#1b4332] px-3 py-1.5 rounded-full shadow-2xs transition-colors"
                title="खाता विवरण देखें"
              >
                <div className="w-6 h-6 rounded-full bg-[#1b4332] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : (role === 'admin' ? 'A' : role === 'artisan' ? 'K' : 'U')}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-bold text-[#231f1e] truncate max-w-[140px] block">
                    {profile?.full_name || (role === 'admin' ? 'Administrator' : role === 'artisan' ? 'Master Artisan' : 'Valued Patron')}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-[#c85a32] block -mt-0.5">
                    {role}
                  </span>
                </div>
              </Link>

              {role === 'artisan' && (
                <Link
                  href="/artisan"
                  className="bg-[#c85a32] hover:bg-[#b84e28] text-white font-bold text-xs px-4 py-2 rounded-full transition-all shadow-xs hidden sm:flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>मेरा स्टूडियो</span>
                </Link>
              )}

              {role === 'customer' && (
                <Link
                  href="/cart"
                  className="bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs px-4 py-2 rounded-full transition-all shadow-xs hidden sm:flex items-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>कार्ट देखें</span>
                </Link>
              )}

              {role === 'admin' && (
                <Link
                  href="/admin"
                  className="bg-[#1c1917] hover:bg-[#27272a] text-white font-bold text-xs px-4 py-2 rounded-full transition-all shadow-xs hidden sm:flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#F5A941]" />
                  <span>प्रशासन</span>
                </Link>
              )}

              <button
                onClick={() => signOut()}
                className="w-9 h-9 rounded-full border border-[#e6ded3] bg-white hover:bg-red-50 hover:border-red-200 text-[#6f5f58] hover:text-red-600 flex items-center justify-center transition-colors"
                title="साइन आउट करें"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/login?redirect=/artisan"
                className="bg-[#c85a32] hover:bg-[#b84e28] text-white font-bold text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>हुनर बेचें</span>
              </Link>

              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 border border-[#e6ded3] bg-white hover:bg-[#f4ede4] text-[#231f1e] font-bold text-xs sm:text-sm px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full transition-all"
              >
                <LogIn className="w-3.5 h-3.5 text-[#1b4332]" />
                <span>लॉगिन</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
