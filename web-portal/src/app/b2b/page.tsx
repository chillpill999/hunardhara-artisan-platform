"use client";

import { useState } from "react";
import Link from "next/link";
import { matchB2BRFQ } from "@/lib/api";
import { B2BMatchResponse } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import MatchResultCard from "@/components/MatchResultCard";
import {
  Building2,
  CheckCircle2,
  Users,
  Search,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Compass
} from "lucide-react";

export default function B2BMatchmakerPage() {
  const { user, session } = useAuth();
  const [craftType, setCraftType] = useState("Bastar Dhokra");
  const [quantity, setQuantity] = useState(150);
  const [budgetPerUnit, setBudgetPerUnit] = useState(1800);
  const [deadlineDays, setDeadlineDays] = useState(45);
  const [deliveryState, setDeliveryState] = useState("Delhi");
  const [companyName, setCompanyName] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<B2BMatchResponse | null>(null);
  const [errorState, setErrorState] = useState<{ status: number; message: string } | null>(null);

  const handleExecuteMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorState(null);

    if (!user || !session) {
      setErrorState({
        status: 401,
        message: "Authentication Required: Please sign in to submit B2B procurement RFQs and link with verified artisans.",
      });
      return;
    }

    setIsMatching(true);

    try {
      const idempotencyKey = `rfq-${user.id.substring(0, 8)}-${Date.now()}`;
      const result = await matchB2BRFQ(
        {
          required_craft_type: craftType,
          quantity: Number(quantity),
          budget_per_unit: Number(budgetPerUnit),
          delivery_days_deadline: Number(deadlineDays),
          delivery_state: deliveryState,
          buyer_company_name: companyName || user.user_metadata?.full_name || "Institutional Buyer",
          buyer_contact_email: user.email || undefined,
          idempotency_key: idempotencyKey,
        },
        session.access_token
      );

      if (!result.success) {
        setErrorState({
          status: result.statusCode || 500,
          message: result.error || "Failed to execute B2B matching.",
        });
        setMatchResult(null);
      } else {
        setErrorState(null);
        setMatchResult(result.data || null);
      }
    } catch (err: any) {
      setErrorState({
        status: 500,
        message: `Network error: ${err.message || String(err)}`,
      });
      setMatchResult(null);
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-12">
      {/* Header Banner */}
      <div className="bg-[#1c1917] text-white rounded-3xl p-8 sm:p-12 border border-[#292524] relative overflow-hidden">
        <div className="max-w-3xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 text-[#fef3c7] text-[11px] font-medium px-3.5 py-1 rounded-full uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>Corporate & Institutional Procurement</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Direct Artisan Sourcing at Scale
          </h1>

          <p className="text-xs sm:text-sm text-[#d6d3d1] font-light leading-relaxed max-w-2xl">
            Sourcing for hospitality, luxury retail, or corporate gifting? Connect directly with verified master artisan cooperatives. Our platform evaluates workshop capacity, cluster pooling, and fair wholesale wage baselines to deliver authentic heritage quality.
          </p>

          <div className="flex flex-wrap gap-5 pt-2 text-xs text-[#a8a29e]">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#34d399]" /> Verified Workshop Provenance</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#34d399]" /> Guaranteed Lead Times</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#34d399]" /> Zero Middleman Markup</span>
          </div>
        </div>
      </div>

      {/* Sourcing Form & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Sourcing Specification Form */}
        <div className="lg:col-span-5 bg-white p-7 sm:p-9 rounded-3xl border border-[#e7e2d9] shadow-xs space-y-6">
          <div>
            <h3 className="font-serif font-bold text-xl text-[#1c1917]">
              Submit Sourcing Request
            </h3>
            <p className="text-xs text-[#78716c] mt-1">
              Specify your craft requirement, target unit budget, and delivery timeline.
            </p>
          </div>

          <form onSubmit={handleExecuteMatch} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[#44403c] mb-1.5">
                Heritage Craft Discipline
              </label>
              <select
                value={craftType}
                onChange={(e) => setCraftType(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#faf8f5] border border-[#e7e2d9] font-medium text-[#1c1917] focus:outline-none focus:border-[#9a3412]"
              >
                <option value="Bastar Dhokra">Bastar Dhokra (Lost-Wax Bell Metal)</option>
                <option value="Varanasi Silk">Varanasi Silk (Handloom Kadwa Brocade)</option>
                <option value="Khurja Pottery">Khurja Pottery (High-Fire Glazed Ceramic)</option>
                <option value="Madhubani Painting">Madhubani Painting (Mithila Folk Scroll)</option>
                <option value="Channapatna Wooden Toys">Channapatna Wooden Toys (Natural Lacquer)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block font-medium text-[#44403c] mb-1.5">
                  Required Volume (Units)
                </label>
                <input
                  type="number"
                  min="5"
                  max="5000"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full p-3 rounded-xl bg-[#faf8f5] border border-[#e7e2d9] font-medium text-[#1c1917] focus:outline-none focus:border-[#9a3412]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#44403c] mb-1.5">
                  Budget / Unit (INR)
                </label>
                <input
                  type="number"
                  min="100"
                  step="50"
                  value={budgetPerUnit}
                  onChange={(e) => setBudgetPerUnit(Number(e.target.value))}
                  className="w-full p-3 rounded-xl bg-[#faf8f5] border border-[#e7e2d9] font-medium text-[#1c1917] focus:outline-none focus:border-[#9a3412]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block font-medium text-[#44403c] mb-1.5">
                  Target Deadline (Days)
                </label>
                <input
                  type="number"
                  min="5"
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(Number(e.target.value))}
                  className="w-full p-3 rounded-xl bg-[#faf8f5] border border-[#e7e2d9] font-medium text-[#1c1917] focus:outline-none focus:border-[#9a3412]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#44403c] mb-1.5">
                  Delivery Destination
                </label>
                <input
                  type="text"
                  value={deliveryState}
                  onChange={(e) => setDeliveryState(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#faf8f5] border border-[#e7e2d9] font-medium text-[#1c1917] focus:outline-none focus:border-[#9a3412]"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-[#44403c] mb-1.5">
                Organization / Client Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#faf8f5] border border-[#e7e2d9] font-medium text-[#1c1917] focus:outline-none focus:border-[#9a3412]"
              />
            </div>

            <button
              type="submit"
              disabled={isMatching}
              className="w-full py-3.5 bg-[#1c1917] hover:bg-[#9a3412] text-white font-medium rounded-full transition-all shadow-sm flex items-center justify-center gap-2 mt-4 text-xs sm:text-sm"
            >
              {isMatching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Matching Artisan Workshops...</span>
                </>
              ) : (
                <>
                  <span>Find Matched Artisan Partners</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="p-4 rounded-2xl bg-[#faf8f5] border border-[#e7e2d9] text-[#57534e] text-xs leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />
            <span>
              All wholesale partner rates align with statutory artisan wage baselines to guarantee genuine ethical craftsmanship and reliable fulfillment.
            </span>
          </div>
        </div>

        {/* Right Column: Artisan Matches */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-xl text-[#1c1917]">
              Matched Artisan Workshops
            </h3>

            {matchResult?.cluster_consortium_recommended && (
              <span className="text-[11px] bg-[#fef3c7] text-[#92400e] border border-[#fde68a] px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Consortium Sourcing Available
              </span>
            )}
          </div>

          {/* 1. Error States */}
          {errorState && (
            errorState.status === 401 ? (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-3xl p-8 text-center space-y-4 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-[#fee2e2] text-[#dc2626] flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-base text-[#991b1b]">
                    Buyer Authentication Required
                  </h4>
                  <p className="text-xs text-[#7f1d1d] mt-1 max-w-md mx-auto leading-relaxed">
                    Institutional procurement and direct artisan bulk RFQs require a verified buyer account to ensure genuine transactions.
                  </p>
                </div>
                <Link
                  href="/login?redirect=/b2b"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#991b1b] hover:bg-[#7f1d1d] text-white text-xs font-semibold rounded-full shadow-sm transition-colors cursor-pointer"
                >
                  <span>Sign In as Verified Buyer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : errorState.status === 422 ? (
              <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-3xl p-6 text-xs text-[#92400e] flex items-start gap-3 shadow-xs">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#d97706]" />
                <div>
                  <span className="font-bold text-sm block mb-1">Invalid Sourcing Specification</span>
                  <span className="text-xs text-[#78350f]">{errorState.message}</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-3xl p-6 text-xs text-[#991b1b] flex items-start justify-between gap-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#dc2626]" />
                  <div>
                    <span className="font-bold text-sm block mb-1">Matchmaker Service Notice</span>
                    <span className="text-xs text-[#7f1d1d]">{errorState.message}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExecuteMatch}
                  className="px-3.5 py-1.5 bg-[#dc2626] text-white rounded-full font-medium hover:bg-[#b91c1c] text-xs transition-colors flex-shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )
          )}

          {/* 2. Success Result Display */}
          {matchResult ? (
            <div className="space-y-4">
              {/* Authoritative RFQ Status Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#faf8f5] border border-[#e7e2d9] p-3.5 rounded-2xl text-xs">
                <div className="flex items-center gap-2 text-[#44403c]">
                  <span className="font-bold">RFQ Reference:</span>
                  <code className="bg-white px-2 py-0.5 rounded-lg border border-[#e7e2d9] text-[#1c1917] font-mono text-[11px] font-semibold">
                    {matchResult.rfq_id || "Persisted"}
                  </code>
                  <span className="text-[10px] text-[#059669] font-medium bg-[#ecfdf5] px-2 py-0.5 rounded-full border border-[#a7f3d0] inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[#059669]" /> Audited in Database
                  </span>
                </div>
                <span className="text-[#78716c] font-medium">
                  {matchResult.total_matches_found} candidate{matchResult.total_matches_found === 1 ? "" : "s"} found
                </span>
              </div>

              {matchResult.total_matches_found === 0 || matchResult.matched_artisans.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#e7e2d9] p-10 text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-[#f5f2eb] text-[#78716c] flex items-center justify-center mx-auto text-xl">
                    🔍
                  </div>
                  <h4 className="font-serif font-bold text-base text-[#1c1917]">
                    No Active Artisans Match Current Parameters
                  </h4>
                  <p className="text-xs text-[#78716c] max-w-md mx-auto leading-relaxed">
                    We could not find active verified workshops currently offering <span className="font-semibold text-[#1c1917]">{matchResult.required_craft}</span> within your target budget of ₹{matchResult.buyer_budget.toLocaleString("en-IN")}/unit for {matchResult.quantity} units. Consider adjusting your unit budget or lead time.
                  </p>
                </div>
              ) : (
                matchResult.matched_artisans.map((match, index) => (
                  <MatchResultCard key={match.artisan_id} match={match} rank={index + 1} />
                ))
              )}
            </div>
          ) : !errorState && (
            <div className="bg-white rounded-3xl border border-dashed border-[#d6cebf] p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#f5f2eb] text-[#9a3412] flex items-center justify-center mx-auto text-xl">
                ⚖️
              </div>
              <h4 className="font-serif font-bold text-base text-[#1c1917]">
                Ready to match your sourcing requirements
              </h4>
              <p className="text-xs text-[#78716c] max-w-sm mx-auto">
                Fill in your parameters on the left and submit to view certified artisan workshops evaluated for capacity, price, and craft excellence.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
