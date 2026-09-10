'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Home,
  ShoppingBag,
  ShoppingCart,
  Package,
  Clock,
  User,
  Building2,
  LogIn,
  ShieldCheck,
  Camera
} from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, role } = useAuth();

  // 1. CUSTOMER MOBILE NAVIGATION (5 Dedicated Tabs)
  if (role === 'customer') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/95 backdrop-blur-md border-t border-[#e6ded3] px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-lg">
        <div className="flex items-center justify-around">
          {/* TAB 1: HOME */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              pathname === '/' ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">होम</span>
          </Link>

          {/* TAB 2: EXPLORE COLLECTION */}
          <Link
            href="/#collection"
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              pathname === '/#collection' ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px]">संग्रह</span>
          </Link>

          {/* TAB 3: ELEVATED CENTER CART */}
          <Link
            href="/cart"
            className="flex flex-col items-center -mt-5 group"
          >
            <div className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-transform group-hover:scale-105 active:scale-95 ${
              pathname.startsWith('/cart') ? 'bg-[#1b4332] text-white' : 'bg-[#c85a32] text-white'
            }`}>
              <ShoppingCart className="w-6 h-6 text-[#faf7f2]" />
            </div>
            <span className="text-[10px] font-bold text-[#1b4332] mt-0.5">
              कार्ट
            </span>
          </Link>

          {/* TAB 4: ORDERS */}
          <Link
            href="/orders"
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              pathname.startsWith('/orders') ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">ऑर्डर</span>
          </Link>

          {/* TAB 5: ACCOUNT */}
          <Link
            href="/account"
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              pathname.startsWith('/account') ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">खाता</span>
          </Link>
        </div>
      </nav>
    );
  }

  // 2. ARTISAN MOBILE NAVIGATION (5 Dedicated Tabs)
  if (role === 'artisan') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/95 backdrop-blur-md border-t border-[#e6ded3] px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-lg">
        <div className="flex items-center justify-around">
          {/* TAB 1: HOME */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              pathname === '/' ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">होम</span>
          </Link>

          {/* TAB 2: MY PRODUCTS */}
          <Link
            href="/artisan"
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              pathname === '/artisan' ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px]">शिल्प</span>
          </Link>

          {/* TAB 3: ELEVATED CENTER ADD BUTTON */}
          <Link
            href="/artisan"
            className="flex flex-col items-center -mt-5 group"
          >
            <div className="w-13 h-13 rounded-full bg-[#c85a32] hover:bg-[#b84e28] text-white flex items-center justify-center shadow-lg border-2 border-white transition-transform group-hover:scale-105 active:scale-95">
              <Camera className="w-6 h-6 text-[#faf7f2]" />
            </div>
            <span className="text-[10px] font-bold text-[#c85a32] mt-0.5">
              जोड़ें
            </span>
          </Link>

          {/* TAB 4: ORDERS */}
          <Link
            href="/artisan"
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[#6f5f58] hover:text-[#1b4332] transition-all"
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">ऑर्डर</span>
          </Link>

          {/* TAB 5: STUDIO / ACCOUNT */}
          <Link
            href="/account"
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              pathname.startsWith('/account') ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">खाता</span>
          </Link>
        </div>
      </nav>
    );
  }

  // 3. ADMIN & ANONYMOUS NAVIGATION
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/95 backdrop-blur-md border-t border-[#e6ded3] px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-lg">
      <div className="flex items-center justify-around">
        {/* TAB 1: HOME */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
            pathname === '/' ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">होम</span>
        </Link>

        {/* TAB 2: EXPLORE / COLLECTION */}
        <Link
          href="/#collection"
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[#6f5f58] hover:text-[#1b4332] transition-all"
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[10px]">संग्रह</span>
        </Link>

        {/* TAB 3: ELEVATED CENTER ACTION */}
        <Link
          href={user ? '/artisan' : '/login?redirect=/artisan'}
          className="flex flex-col items-center -mt-5 group"
        >
          <div className="w-13 h-13 rounded-full bg-[#c85a32] hover:bg-[#b84e28] text-white flex items-center justify-center shadow-lg border-2 border-white transition-transform group-hover:scale-105 active:scale-95">
            <Camera className="w-6 h-6 text-[#faf7f2]" />
          </div>
          <span className="text-[10px] font-bold text-[#c85a32] mt-0.5">
            {role === 'admin' ? 'स्टूडियो' : 'बेचें'}
          </span>
        </Link>

        {/* TAB 4: B2B */}
        <Link
          href="/b2b"
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
            pathname.startsWith('/b2b') ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
          }`}
        >
          <Building2 className="w-5 h-5" />
          <span className="text-[10px]">थोक (B2B)</span>
        </Link>

        {/* TAB 5: ADMIN / LOGIN */}
        {user ? (
          role === 'admin' ? (
            <Link
              href="/admin"
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
                pathname.startsWith('/admin') ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[10px]">प्रशासन</span>
            </Link>
          ) : (
            <Link
              href="/account"
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
                pathname.startsWith('/account') ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-[10px]">खाता</span>
            </Link>
          )
        ) : (
          <Link
            href="/login"
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              pathname.startsWith('/login') ? 'text-[#1b4332] font-bold' : 'text-[#6f5f58]'
            }`}
          >
            <LogIn className="w-5 h-5" />
            <span className="text-[10px]">लॉगिन</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
