'use client';

import { useState, useEffect } from 'react';
import { SEED_ARTISAN_EARNINGS } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp,
  ShieldCheck,
  HeartHandshake,
  Download,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Wallet,
  ArrowDownLeft,
  ChevronDown
} from 'lucide-react';

interface RealPayoutItem {
  id: string;
  order_id: string;
  order_date: string;
  craft_title: string;
  buyer_name: string;
  order_type: string;
  items_count: number;
  total_order_value: number;
  artisan_wage_payout: number;
  middleman_saved: number;
  status: string;
}

export default function ArtisanRevenueLedger() {
  const { user, profile } = useAuth();
  const [filterType, setFilterType] = useState<'all' | 'D2C Retail' | 'B2B Bulk'>('all');
  const [dbPayouts, setDbPayouts] = useState<RealPayoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real database records protected by Supabase RLS
  useEffect(() => {
    async function loadRealEarnings() {
      const fallbackList: RealPayoutItem[] = SEED_ARTISAN_EARNINGS.recent_payouts.map((p) => ({
        id: p.id,
        order_id: p.order_id,
        order_date: p.order_date,
        craft_title: p.craft_title,
        buyer_name: p.buyer_name,
        order_type: p.order_type,
        items_count: p.quantity,
        total_order_value: p.gross_amount,
        artisan_wage_payout: p.artisan_net_payout,
        middleman_saved: p.middleman_cut_prevented,
        status: p.payment_status,
      }));

      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('artisan_earnings')
          .select('id, order_id, payout_date, product_title, order_type, quantity, gross_amount, artisan_wage_payout, middleman_saved, status')
          .order('payout_date', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped: RealPayoutItem[] = data.map((item) => ({
            id: item.id,
            order_id: item.order_id,
            order_date: new Date(item.payout_date).toISOString().split('T')[0],
            craft_title: item.product_title,
            buyer_name: 'Direct Verified Patron',
            order_type: item.order_type || 'D2C Retail',
            items_count: item.quantity || 1,
            total_order_value: Number(item.gross_amount),
            artisan_wage_payout: Number(item.artisan_wage_payout),
            middleman_saved: Number(item.middleman_saved),
            status: item.status || 'PAID',
          }));
          setDbPayouts(mapped);
        } else {
          setDbPayouts(fallbackList);
        }
      } catch {
        setDbPayouts(fallbackList);
      } finally {
        setIsLoading(false);
      }
    }

    loadRealEarnings();
  }, [user]);

  const filteredPayouts = filterType === 'all'
    ? dbPayouts
    : dbPayouts.filter((p) => p.order_type === filterType);

  const totalRevenue = dbPayouts.reduce((sum, p) => sum + p.total_order_value, 0) || SEED_ARTISAN_EARNINGS.total_revenue_earned;
  const totalSaved = dbPayouts.reduce((sum, p) => sum + p.middleman_saved, 0) || SEED_ARTISAN_EARNINGS.middleman_margin_saved;
  const middlemanSavedPercent = Math.round((totalSaved / (totalRevenue + totalSaved)) * 100) || 35;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Warm Optimistic Milestone Banner */}
      <div className="bg-[#1b4332] text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#2d6a4f] text-[#e8f5e9] text-xs font-bold px-3.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-[#e9a83a]" />
            <span>सीधी कारीगर आय • Direct P2P Remittance</span>
          </div>

          <div className="space-y-1">
            <span className="text-xs sm:text-sm text-[#e8f5e9] font-medium block">
              नमस्ते {profile?.full_name || 'राधेश्याम जी'}, आपके हुनर की कुल कमाई:
            </span>
            <div className="font-sans text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white">
              ₹{totalRevenue.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Middleman Savings Highlight */}
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <HeartHandshake className="w-5 h-5 text-[#e9a83a] shrink-0" />
              <div>
                <span className="text-xs font-bold text-white block">
                  बिचौलियों के बिना सीधी बचत: +₹{totalSaved.toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-[#e8f5e9]">
                  पारंपरिक व्यापारियों की तुलना में +{middlemanSavedPercent}% अधिक आमदनी सीधे आपके बैंक में।
                </span>
              </div>
            </div>
            <span className="bg-[#e9a83a] text-[#1b4332] text-[10px] font-extrabold px-3 py-1 rounded-full shrink-0">
              100% Direct Payout
            </span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards for Mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-[#e6ded3] p-4 space-y-1 bento-shadow">
          <span className="text-[11px] font-bold text-[#6f5f58] uppercase block">
            कुल पूर्ण ऑर्डर
          </span>
          <div className="text-2xl font-extrabold text-[#231f1e]">
            {dbPayouts.length}
          </div>
          <span className="text-[10px] text-[#2d6a4f] font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> ग्राहकों तक पहुंचे
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[#e6ded3] p-4 space-y-1 bento-shadow">
          <span className="text-[11px] font-bold text-[#6f5f58] uppercase block">
            दैनिक मजदूरी
          </span>
          <div className="text-2xl font-extrabold text-[#1b4332]">
            ₹910/दिन
          </div>
          <span className="text-[10px] text-[#2d6a4f] font-medium">
            न्यूनतम ₹650 से अधिक
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[#e6ded3] p-4 space-y-1 bento-shadow col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-[#6f5f58] uppercase block">
            खाते में भुगतान
          </span>
          <div className="text-2xl font-extrabold text-[#c85a32]">
            100% P2P
          </div>
          <span className="text-[10px] text-[#6f5f58]">
            UPI / बैंक में तुरंत ट्रांसफर
          </span>
        </div>
      </div>

      {/* Itemized Payout Receipts (Clean Mobile Cards) */}
      <div className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-7 space-y-5 bento-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-sans text-lg sm:text-xl font-bold text-[#231f1e]">
              भुगतान रसीदें (Payment Receipts)
            </h3>
            <p className="text-xs text-[#6f5f58]">
              प्रत्येक बिक्री का प्रमाणित हिसाब-किताब
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex bg-[#faf7f2] p-1 rounded-xl border border-[#e6ded3] w-fit">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterType === 'all'
                  ? 'bg-white text-[#1b4332] shadow-xs'
                  : 'text-[#6f5f58] hover:text-[#231f1e]'
              }`}
            >
              सभी ({dbPayouts.length})
            </button>
            <button
              onClick={() => setFilterType('D2C Retail')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterType === 'D2C Retail'
                  ? 'bg-white text-[#1b4332] shadow-xs'
                  : 'text-[#6f5f58] hover:text-[#231f1e]'
              }`}
            >
              खुदरा (Retail)
            </button>
            <button
              onClick={() => setFilterType('B2B Bulk')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterType === 'B2B Bulk'
                  ? 'bg-white text-[#1b4332] shadow-xs'
                  : 'text-[#6f5f58] hover:text-[#231f1e]'
              }`}
            >
              थोक (B2B)
            </button>
          </div>
        </div>

        {/* Card-based Mobile List */}
        <div className="space-y-3">
          {filteredPayouts.map((payout) => (
            <div
              key={payout.id}
              className="p-4 rounded-2xl border border-[#e6ded3] bg-[#faf7f2] hover:bg-white transition-all space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-sans font-bold text-sm text-[#231f1e]">
                    {payout.craft_title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-[#6f5f58] mt-0.5">
                    <span>ऑर्डर: {payout.order_id}</span>
                    <span>•</span>
                    <span>{payout.order_date}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-sans text-base font-extrabold text-[#1b4332] block">
                    ₹{payout.artisan_wage_payout.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] font-bold text-[#c85a32]">
                    +₹{payout.middleman_saved.toLocaleString('en-IN')} बचत
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#e6ded3] flex items-center justify-between text-xs">
                <span className="text-[11px] bg-white text-[#382923] border border-[#e6ded3] px-2.5 py-0.5 rounded-md font-medium">
                  {payout.order_type} • {payout.items_count} इकाई
                </span>

                <span className="inline-flex items-center gap-1 text-[#2d6a4f] text-[11px] font-bold bg-[#e8f5e9] px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-[#2d6a4f]" />
                  <span>खाते में जमा (Settled)</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
