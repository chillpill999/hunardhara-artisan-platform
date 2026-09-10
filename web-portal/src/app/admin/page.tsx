'use client';

import { useState, useEffect } from 'react';
import { fetchClusters } from '@/lib/api';
import { CraftCluster } from '@/lib/types';
import AuthGuard from '@/components/AuthGuard';
import {
  ShieldCheck,
  Building2,
  Users,
  TrendingUp,
  MapPin,
  Award,
  Compass,
  HeartHandshake
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [clusters, setClusters] = useState<CraftCluster[]>([]);

  useEffect(() => {
    fetchClusters().then((data) => setClusters(data));
  }, []);

  return (
    <AuthGuard
      allowedRoles={['admin']}
      redirectMessage="Sign in as Administrator to access governance and cluster monitoring."
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">
        {/* Top Banner */}
        <div className="bg-[#141414] text-white rounded-3xl p-6 sm:p-10 border border-[#27272a] flex flex-col md:flex-row justify-between md:items-center gap-6 shadow-md">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#F8C146] text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-[#F5A941]" />
              <span>National Heritage Craft Governance • [SIH Prototype]</span>
            </div>

            <h1 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              Artisan Clusters & Welfare Registry
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 font-light leading-relaxed">
              Administrative oversight for state craft clusters. Validates statutory wage baselines, verifiable craft provenance, and fair marketplace transactions.
            </p>
          </div>

          {/* Protection Badges */}
          <div className="bg-[#1c1917] p-5 rounded-2xl border border-[#2e2e30] text-xs space-y-2 flex-shrink-0">
            <div className="flex items-center gap-2 text-[#34d399] font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Statutory Wage Protection</span>
            </div>
            <div className="text-[11px] text-[#a1a1aa]">
              Cost-Plus Floor Policy Engine [Sample Baseline]
            </div>
            <div className="flex items-center gap-2 text-[#F8C146] font-bold pt-2 border-t border-[#2e2e30]">
              <Award className="w-4 h-4" />
              <span>GI Provenance Verification [Prototype]</span>
            </div>
          </div>
        </div>

        {/* KPI Cards (Clearly labeled as Demo / Prototype Data) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-6 rounded-3xl border border-[#e4e4e7] bento-shadow space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-[#71717a] font-bold flex items-center justify-between">
              <span>Active Pilot Clusters</span>
              <Building2 className="w-4 h-4 text-[#F5A941]" />
            </div>
            <div className="font-sans text-3xl font-extrabold text-[#1c1917]">{clusters.length || 5}</div>
            <div className="text-[11px] text-[#059669] font-semibold flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Sample Data: 5 Pilot Clusters
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#e4e4e7] bento-shadow space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-[#71717a] font-bold flex items-center justify-between">
              <span>Sample Enrolled Artisans</span>
              <Users className="w-4 h-4 text-[#0284c7]" />
            </div>
            <div className="font-sans text-3xl font-extrabold text-[#1c1917]">128 Active</div>
            <div className="text-[11px] text-[#71717a]">
              Pilot Cohort • [Demonstration]
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#e4e4e7] bento-shadow space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-[#71717a] font-bold flex items-center justify-between">
              <span>Projected Direct Uplift</span>
              <TrendingUp className="w-4 h-4 text-[#059669]" />
            </div>
            <div className="font-sans text-3xl font-extrabold text-[#065f46]">~35% to 45%</div>
            <div className="text-[11px] text-[#71717a]">
              Estimated via Middleman Disintermediation
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#e4e4e7] bento-shadow space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-[#71717a] font-bold flex items-center justify-between">
              <span>Direct Payout Pipeline</span>
              <HeartHandshake className="w-4 h-4 text-[#d97706]" />
            </div>
            <div className="font-sans text-3xl font-extrabold text-[#1c1917]">100% P2P</div>
            <div className="text-[11px] text-[#71717a]">
              UPI / Bank Direct Transfer Architecture
            </div>
          </div>
        </div>

        {/* Cluster Table with Wage Baselines */}
        <div className="bg-white rounded-3xl border border-[#e4e4e7] overflow-hidden bento-shadow">
          <div className="p-6 sm:p-7 border-b border-[#f4f4f5] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-sans font-bold text-xl text-[#1c1917]">
                Geographical Clusters & Statutory Minimum Daily Wages
              </h3>
              <p className="text-xs text-[#545454] mt-0.5">
                These daily wage floors serve as minimum cost-plus baselines for the anti-exploitation pricing algorithm.
              </p>
            </div>

            <div className="text-xs bg-[#f4f4f5] text-[#545454] border border-[#e4e4e7] px-3.5 py-1.5 rounded-full font-semibold flex items-center gap-1.5 w-fit">
              <ShieldCheck className="w-4 h-4 text-[#059669]" />
              <span>Wage Floor Enforced</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fafafa] text-[#71717a] uppercase font-bold border-b border-[#e4e4e7]">
                <tr>
                  <th className="py-4 px-6">Cluster & Origin</th>
                  <th className="py-4 px-6">Heritage Discipline</th>
                  <th className="py-4 px-6">Pilot Artisans</th>
                  <th className="py-4 px-6">Statutory Wage Baseline</th>
                  <th className="py-4 px-6">Provenance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f4f5] text-[#1c1917]">
                {clusters.map((c) => (
                  <tr key={c.id} className="hover:bg-[#fafafa] transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-sm text-[#1c1917]">{c.name}</div>
                      <div className="text-[11px] text-[#71717a] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#F5A941]" /> {c.district}, {c.state}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-[#f4f4f5] text-[#545454] px-2.5 py-1 rounded-md font-medium">
                        {c.craft_type}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-[#1c1917]">
                      {c.active_artisans_count.toLocaleString('en-IN')} [Sample]
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-bold text-[#065f46] bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-1 rounded-md">
                        ₹{c.statutory_minimum_daily_wage}/day floor
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 text-[#059669] font-semibold">
                        <Award className="w-3.5 h-3.5" /> GI Registry [Demo]
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
