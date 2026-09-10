"use client";

import { B2BMatchRecordItem } from "@/lib/types";
import { CheckCircle2, Users, MapPin, ArrowRight } from "lucide-react";

interface MatchResultCardProps {
  match: B2BMatchRecordItem;
  rank: number;
}

export default function MatchResultCard({ match, rank }: MatchResultCardProps) {
  return (
    <div className="bg-white rounded-3xl border border-[#e7e2d9] p-6 sm:p-7 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#f0ece3] pb-5 mb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-[#f5f2eb] text-[#9a3412] font-serif font-bold flex items-center justify-center text-sm border border-[#e7e2d9]">
            #{rank}
          </div>
          <div>
            <h4 className="font-serif font-bold text-lg text-[#1c1917]">{match.artisan_name}</h4>
            <div className="text-xs text-[#78716c] flex items-center gap-2 mt-0.5">
              <span className="font-medium text-[#44403c]">{match.cluster_name}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#9a3412]" /> {match.state}
              </span>
            </div>
          </div>
        </div>

        {/* Compatibility Score */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-[#a8a29e]">
              Match Alignment
            </div>
            <div className="text-lg font-bold font-serif text-[#065f46]">
              {match.overall_match_percentage.toFixed(0)}% Fit
            </div>
          </div>
        </div>
      </div>

      {/* Production Capacity & Pricing Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 py-1 mb-5">
        <div className="bg-[#faf8f5] p-3 rounded-2xl border border-[#f0ece3]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-semibold block">Wholesale Rate</span>
          <span className="font-serif font-bold text-[#1c1917] text-base mt-0.5 block">
            ₹{match.artisan_wholesale_rate.toLocaleString("en-IN")}<span className="text-xs font-normal text-[#78716c]">/unit</span>
          </span>
        </div>

        <div className="bg-[#faf8f5] p-3 rounded-2xl border border-[#f0ece3]">
          <span className="text-[10px] text-[#a8a29e] uppercase font-semibold block">Workshop Capacity</span>
          <span className="font-serif font-bold text-[#1c1917] text-base mt-0.5 block">
            {match.artisan_monthly_capacity} units<span className="text-xs font-normal text-[#78716c]">/month</span>
          </span>
        </div>

        <div className="bg-[#faf8f5] p-3 rounded-2xl border border-[#f0ece3] col-span-2 sm:col-span-1">
          <span className="text-[10px] text-[#a8a29e] uppercase font-semibold block">Fulfillment Model</span>
          <span className="text-xs font-semibold text-[#065f46] mt-1 block flex items-center gap-1">
            {match.solo_capacity_feasible ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" /> Direct Workshop
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-[#d97706]" /> SHG Consortium
              </>
            )}
          </span>
        </div>
      </div>

      {/* Narrative Note */}
      <p className="text-xs text-[#57534e] bg-[#faf8f5] p-3.5 rounded-2xl border border-[#f0ece3] leading-relaxed">
        {match.match_rationale}
      </p>

      {/* Action CTA */}
      <div className="mt-5 pt-4 border-t border-[#f0ece3] flex items-center justify-between">
        <span className="text-xs text-[#78716c]">Direct workshop purchase agreement</span>
        <button className="bg-[#9a3412] hover:bg-[#b45309] text-white font-medium text-xs px-5 py-2.5 rounded-full transition-colors flex items-center gap-1.5 shadow-xs">
          <span>Inquire with Artisan</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
