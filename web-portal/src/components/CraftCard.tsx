'use client';

import Link from 'next/link';
import { Product } from '@/lib/types';
import { ArrowUpRight, MapPin, User } from 'lucide-react';

interface CraftCardProps {
  product: Product;
}

export default function CraftCard({ product }: CraftCardProps) {
  return (
    <div className="group bg-white rounded-3xl border border-[#e6ded3] bento-shadow hover:border-[#c85a32] transition-all duration-300 flex flex-col overflow-hidden">
      {/* Product Image */}
      <Link
        href={`/craft/${product.id}`}
        className="block relative aspect-square w-full bg-[#faf7f2] overflow-hidden border-b border-[#e6ded3]"
      >
        <img
          src={product.studio_image_url || '/logo.png'}
          alt={product.title_en}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/logo.png';
          }}
        />

        {/* Craft Badge */}
        <div className="absolute top-3.5 left-3.5">
          <span className="text-[10px] font-bold text-[#1b4332] uppercase tracking-wider bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full border border-[#e6ded3] shadow-xs">
            {product.craft_type}
          </span>
        </div>

        {/* GI Tag Badge if certified */}
        {product.gi_certified && (
          <div className="absolute top-3.5 right-3.5">
            <span className="text-[10px] font-bold text-[#c85a32] uppercase tracking-wider bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full border border-[#e6ded3] shadow-xs">
              GI Tagged
            </span>
          </div>
        )}
      </Link>

      {/* Card Content - Clean & Focused */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          {/* Craft & Location */}
          <div className="flex items-center gap-1.5 text-xs text-[#6f5f58]">
            <MapPin className="w-3.5 h-3.5 text-[#c85a32] shrink-0" />
            <span className="truncate">{product.artisan_state || 'India'}</span>
          </div>

          {/* Product Name */}
          <Link href={`/craft/${product.id}`} className="block group-hover:text-[#c85a32] transition-colors">
            <h3 className="font-sans font-bold text-base text-[#231f1e] leading-snug line-clamp-1">
              {product.title_en}
            </h3>
          </Link>

          {/* Artisan Name */}
          <div className="flex items-center gap-1.5 text-xs text-[#6f5f58]">
            <User className="w-3.5 h-3.5 text-[#1b4332] shrink-0" />
            <span className="truncate">कारीगर: {product.artisan_name || 'मास्टर शिल्पकार'}</span>
          </div>
        </div>

        {/* Price & Action */}
        <div className="pt-3 border-t border-[#e6ded3] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#6f5f58] block">सीधा मूल्य</span>
            <div className="font-sans text-xl font-extrabold text-[#c85a32]">
              ₹{product.recommended_retail_d2c.toLocaleString('en-IN')}
            </div>
          </div>

          <Link
            href={`/craft/${product.id}`}
            className="w-9 h-9 rounded-full bg-[#1b4332] hover:bg-[#2d6a4f] text-white flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs"
            title="शिल्प देखें"
          >
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
