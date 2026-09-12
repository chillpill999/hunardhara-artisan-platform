import Link from "next/link";
import { Compass, ShieldCheck, HeartHandshake, Award, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#1c1917] text-[#d6d3d1] border-t border-[#292524] mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand & Manifesto */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Hunardhara"
                className="w-10 h-10 rounded-full object-contain bg-white p-0.5 border border-[#44403c]"
              />
              <span className="font-serif text-2xl font-bold text-white tracking-tight">Hunardhara</span>
            </div>
            <p className="text-xs text-[#a8a29e] leading-relaxed">
              Bridging traditional Indian master craftsmen directly with discerning patrons worldwide. Every creation tells a generational story of heritage, soil, and human hands.
            </p>
            <div className="text-[11px] text-[#fbbf24] font-medium tracking-wide">
              BRIDGING ARTISANS TO A BRIGHTER TOMORROW
            </div>
          </div>

          {/* Pillars */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#e7e2d9] mb-4">Our Commitments</h4>
            <ul className="space-y-2.5 text-xs text-[#a8a29e]">
              <li className="flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-[#fbbf24]" /> Zero Middleman Exploitation</li>
              <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#fbbf24]" /> Guaranteed Minimum Wage Floors</li>
              <li className="flex items-center gap-2"><Award className="w-4 h-4 text-[#fbbf24]" /> Certified GI Provenance</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#fbbf24]" /> Direct Workshop Traceability</li>
            </ul>
          </div>

          {/* Heritage Clusters */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#e7e2d9] mb-4">Featured Clusters</h4>
            <ul className="space-y-2 text-xs text-[#a8a29e]">
              <li>Varanasi Silk Brocade • Uttar Pradesh</li>
              <li>Bastar Dhokra Bell Metal • Chhattisgarh</li>
              <li>Khurja Studio Pottery • Uttar Pradesh</li>
              <li>Madhubani Natural Art • Bihar</li>
              <li>Channapatna Lacquer Toys • Karnataka</li>
            </ul>
          </div>

          {/* Sourcing & Support */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#e7e2d9] mb-4">Sourcing & Collaboration</h4>
            <p className="text-xs text-[#a8a29e] leading-relaxed mb-4">
              Looking for customized corporate gifting, hospitality decor, or retail consignment directly from artisan cooperatives?
            </p>
            <Link
              href="/b2b"
              className="inline-block text-xs font-semibold bg-[#9a3412] hover:bg-[#b45309] text-white px-4 py-2 rounded-full transition-all"
            >
              Inquire for Bulk Orders →
            </Link>
          </div>
        </div>

        <div className="border-t border-[#292524] mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center text-xs text-[#78716c] gap-4">
          <div>
            © 2026 Hunardhara (हुनरधारा) • Honoring India&apos;s Living Traditions
          </div>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-white transition-colors">Catalog</Link>
            <Link href="/b2b" className="hover:text-white transition-colors">Bulk Sourcing</Link>
            <Link href="/#collection" className="hover:text-white transition-colors">Artisan Clusters</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
