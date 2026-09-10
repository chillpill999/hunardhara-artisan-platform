"use client";

import { Product } from "@/lib/types";
import { Award, MapPin, QrCode, CheckCircle2 } from "lucide-react";

interface CraftPassportProps {
  product: Product;
}

export default function CraftPassport({ product }: CraftPassportProps) {
  const simulatedHash = `HN-${product.id.replace(/-/g, "").substring(0, 8).toUpperCase()}-${product.artisan_id.substring(0, 4).toUpperCase()}`;

  return (
    <div className="bg-[#fcfaf7] border border-[#e7e2d9] rounded-3xl p-8 sm:p-10 relative overflow-hidden shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#e7e2d9] pb-6">
        <div className="flex items-center gap-3.5">
          <img
            src="/logo.png"
            alt="Hunardhara Seal"
            className="w-12 h-12 rounded-full object-contain bg-white border border-[#e7e2d9] p-0.5 shadow-xs shrink-0"
          />
          <div>
            <h3 className="font-serif font-bold text-xl text-[#1c1917] tracking-tight">
              Certificate of Provenance
            </h3>
            <p className="text-xs text-[#78716c] mt-0.5">
              Verified record of authentic handloom & handicraft origin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white border border-[#e7e2d9] px-3.5 py-1.5 rounded-full shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-[#059669]" />
          <span className="text-xs font-mono font-medium text-[#44403c]">REG: {simulatedHash}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        <div className="md:col-span-2 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-[#e7e2d9]">
              <div className="text-[11px] text-[#a8a29e] uppercase tracking-wider font-medium">Master Craftsman</div>
              <div className="font-serif font-bold text-[#1c1917] text-base mt-1">{product.artisan_name || "Recognized Artisan"}</div>
              <div className="text-[11px] text-[#78716c] mt-0.5">Workshop Registered</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#e7e2d9]">
              <div className="text-[11px] text-[#a8a29e] uppercase tracking-wider font-medium">Geographical Origin</div>
              <div className="font-serif font-bold text-[#1c1917] text-base mt-1 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#9a3412] inline" />
                {product.artisan_state || "India"}
              </div>
              <div className="text-[11px] text-[#78716c] mt-0.5">{product.craft_type} Cluster</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#e7e2d9] space-y-2">
            <div className="text-[11px] font-semibold text-[#a8a29e] uppercase tracking-wider">
              Traditional Craft Technique
            </div>
            <p className="text-xs text-[#44403c] leading-relaxed italic font-serif">
              &quot;{product.technique || "Traditional handmade craft technique"} crafted patiently using authentic raw materials and historic techniques.&quot;
            </p>
          </div>
        </div>

        {/* QR Verification Box */}
        <div className="bg-white p-6 rounded-2xl border border-[#e7e2d9] flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-32 h-32 bg-[#faf8f5] border border-[#e7e2d9] p-3 rounded-2xl flex items-center justify-center">
            <QrCode className="w-24 h-24 text-[#1c1917]" />
          </div>
          <div className="text-xs font-bold text-[#1c1917] mt-3">Scan to Verify</div>
          <p className="text-[11px] text-[#78716c] mt-0.5 max-w-[180px]">
            Confirms direct remuneration to the craftsman and certified authenticity.
          </p>
        </div>
      </div>
    </div>
  );
}
