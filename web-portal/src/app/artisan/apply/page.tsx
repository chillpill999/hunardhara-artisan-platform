'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Palette,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Send,
  Building2,
  FileCheck
} from 'lucide-react';

import { submitArtisanApplication, fetchMyApplications, ArtisanApplicationItem } from '@/lib/api';

const CRAFT_OPTIONS = [
  'Varanasi Silk Brocade (वाराणसी रेशम)',
  'Bastar Dhokra Brass (बस्तर ढोकरा)',
  'Khurja Ceramic Pottery (खुर्जा पॉटरी)',
  'Madhubani Mithila Painting (मधुबनी चित्रकला)',
  'Channapatna Lacquerware Toys (चनापटना खिलौने)',
  'Kashmir Pashmina & Carpet (कश्मीर पश्मीना)',
  'Rajasthani Blue Pottery (राजस्थानी ब्लू पॉटरी)',
  'Other Traditional Indian Craft (अन्य पारंपरिक शिल्प)'
];

export default function ArtisanApplyPage() {
  return (
    <AuthGuard allowedRoles={['customer', 'artisan', 'admin', 'super_admin']}>
      <ArtisanApplyContent />
    </AuthGuard>
  );
}

function ArtisanApplyContent() {
  const { user, profile, role, refreshSession } = useAuth();
  const router = useRouter();

  const [craftType, setCraftType] = useState(CRAFT_OPTIONS[0]);
  const [craftExperienceYears, setCraftExperienceYears] = useState('5');
  const [clusterLocation, setClusterLocation] = useState(profile?.state || '');
  const [productionCapacityMonthly, setProductionCapacityMonthly] = useState('20');
  const [sampleDescription, setSampleDescription] = useState('');
  const [maskedAadhaarLast4, setMaskedAadhaarLast4] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [existingApp, setExistingApp] = useState<ArtisanApplicationItem | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [isRefreshingRole, setIsRefreshingRole] = useState(false);

  // Load existing application if any
  useEffect(() => {
    async function checkExisting() {
      try {
        const apps = await fetchMyApplications();
        if (apps && apps.length > 0) {
          setExistingApp(apps[0]);
        }
      } catch (e) {
        console.warn('Could not load existing applications', e);
      } finally {
        setIsLoadingExisting(false);
      }
    }
    if (user) {
      checkExisting();
    } else {
      setIsLoadingExisting(false);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await submitArtisanApplication({
        craft_category: craftType,
        experience_years: parseInt(craftExperienceYears, 10) || 1,
        state: clusterLocation || 'Uttar Pradesh',
        district: clusterLocation || 'Varanasi',
        full_name: profile?.full_name || user?.user_metadata?.full_name || '',
        phone: profile?.phone || '',
        workshop_info: `Capacity: ${productionCapacityMonthly} units/month, Location: ${clusterLocation}`,
        craft_description: sampleDescription,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'आवेदन सबमिट करने में विफल। कृपया पुनः प्रयास करें।');
        return;
      }

      setIsSubmitted(true);
      if (res.data) setExistingApp(res.data);
    } catch (err: any) {
      console.error('Artisan application submission error:', err);
      setErrorMessage(err.message || 'सर्वर से संपर्क नहीं हो सका। कृपया पुनः प्रयास करें।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshAndOpen = async () => {
    setIsRefreshingRole(true);
    try {
      await refreshSession();
      router.push('/artisan');
    } catch {
      router.push('/artisan');
    } finally {
      setIsRefreshingRole(false);
    }
  };

  if (role === 'artisan' || existingApp?.status === 'approved') {
    return (
      <main className="min-h-screen bg-[#faf7f2] py-12 px-4 flex items-center justify-center">
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-8 max-w-md text-center space-y-4 shadow-2xs">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#1b4332] flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-[#1c1917]">
            आप प्रमाणित कारीगर हैं!
          </h2>
          <p className="text-xs text-[#545454]">
            आपका खाता मास्टर कारीगर के रूप में स्वीकृत है। नया टोकन सक्रिय करने और स्टूडियो खोलने के लिए नीचे क्लिक करें।
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleRefreshAndOpen}
              disabled={isRefreshingRole}
              className="inline-flex items-center justify-center gap-2 bg-[#c85a32] hover:bg-[#b84e28] text-white text-xs font-bold px-6 py-3 rounded-full transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <span>{isRefreshingRole ? 'सत्र अपडेट हो रहा है...' : 'कारीगर स्टूडियो खोलें (Open Studio)'}</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (existingApp?.status === 'rejected') {
    return (
      <main className="min-h-screen bg-[#faf7f2] py-16 px-4 flex items-center justify-center">
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-8 sm:p-10 max-w-lg text-center space-y-6 shadow-2xs">
          <div className="w-20 h-20 rounded-full bg-red-50 text-red-700 flex items-center justify-center mx-auto border border-red-200 shadow-sm">
            <AlertCircle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-800 bg-red-50 px-3.5 py-1 rounded-full border border-red-200 inline-block">
              आवेदन अस्वीकृत • Application Rejected
            </span>
            <h2 className="text-2xl font-extrabold text-[#1c1917] tracking-tight">
              कारीगर आवेदन अस्वीकृत
            </h2>
            <p className="text-xs sm:text-sm text-[#545454] leading-relaxed max-w-sm mx-auto">
              प्रशासकीय समीक्षा के अनुसार आपका आवेदन अस्वीकृत कर दिया गया है।
            </p>
          </div>

          <div className="bg-[#faf7f2] rounded-2xl p-4 border border-[#e6ded3] text-left space-y-2">
            <div className="text-xs text-[#6f5f58]">
              <strong>अस्वीकृति का कारण (Administrative Reason):</strong>
            </div>
            <div className="text-xs text-red-800 bg-red-50 p-3 rounded-xl border border-red-200 font-medium">
              {existingApp.rejection_reason || 'दस्तावेज़ या शिल्प विवरण अपूर्ण था।'}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setExistingApp(null)}
              className="inline-flex items-center gap-2 bg-[#c85a32] hover:bg-[#b84e28] text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all shadow-xs cursor-pointer"
            >
              <span>नया आवेदन जमा करें (Re-apply)</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (isSubmitted || existingApp?.status === 'pending') {
    return (
      <main className="min-h-screen bg-[#faf7f2] py-16 px-4 flex items-center justify-center">
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-8 sm:p-10 max-w-lg text-center space-y-6 shadow-2xs">
          <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
            <Clock className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3.5 py-1 rounded-full border border-amber-200 inline-block">
              आवेदन समीक्षाधीन • Under Review
            </span>
            <h2 className="text-2xl font-extrabold text-[#1c1917] tracking-tight">
              आपका कारीगर आवेदन दर्ज है
            </h2>
            <p className="text-xs sm:text-sm text-[#545454] leading-relaxed max-w-sm mx-auto">
              प्रशासक द्वारा आपके शिल्प विवरण की समीक्षा की जा रही है। स्वीकृति मिलते ही आपका खाता कारीगर स्टूडियो में अपग्रेड कर दिया जाएगा।
            </p>
          </div>

          <div className="bg-[#faf7f2] rounded-2xl p-4 border border-[#e6ded3] text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6f5f58]">शिल्प विधा:</span>
              <span className="font-bold text-[#1c1917]">{existingApp?.craft_category || craftType}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6f5f58]">स्थान / राज्य:</span>
              <span className="font-bold text-[#1c1917]">{existingApp?.state || clusterLocation || 'प्रस्तुत'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6f5f58]">समीक्षा स्थिति:</span>
              <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">समीक्षाधीन (Pending Admin Review)</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/account"
              className="inline-flex items-center gap-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all shadow-xs"
            >
              <span>खाता पृष्ठ पर वापस जाएं</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] py-8 sm:py-12 px-4 sm:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Back Link */}
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6f5f58] hover:text-[#1b4332] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>खाता विवरण पर लौटें (Back to Account)</span>
        </Link>

        {/* Header */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#c85a32] bg-white px-3 py-1 rounded-full border border-[#e6ded3] inline-block">
            कारीगर पंजीकरण • Artisan Onboarding
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1c1917] tracking-tight">
            हुनरधारा कारीगर आवेदन (Become an Artisan)
          </h1>
          <p className="text-xs sm:text-sm text-[#545454] leading-relaxed">
            अपने पारंपरिक शिल्प को सीधे राष्ट्रीय बाज़ार से जोड़ें। बिना कमीशन, निष्पक्ष मूल्य निर्धारण और सीधे बैंक खाते में भुगतान।
          </p>
        </div>

        {/* Application Form Card */}
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-6 sm:p-8 shadow-2xs">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Field 1: Craft Type */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#1c1917]">
                शिल्प प्रकार (Primary Craft Discipline) *
              </label>
              <select
                value={craftType}
                onChange={(e) => setCraftType(e.target.value)}
                className="w-full bg-[#faf7f2] border border-[#e6ded3] rounded-2xl px-4 py-3 text-xs sm:text-sm text-[#1c1917] font-medium focus:ring-2 focus:ring-[#c85a32] focus:outline-hidden"
              >
                {CRAFT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Field 2: Cluster & Location */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#1c1917]">
                शिल्प क्लस्टर / स्थान (Cluster, District & State) *
              </label>
              <input
                type="text"
                required
                placeholder="उदा. वाराणसी (उत्तर प्रदेश) या कोण्डागांव (छत्तीसगढ़)"
                value={clusterLocation}
                onChange={(e) => setClusterLocation(e.target.value)}
                className="w-full bg-[#faf7f2] border border-[#e6ded3] rounded-2xl px-4 py-3 text-xs sm:text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c85a32] focus:outline-hidden placeholder:text-[#a89e96]"
              />
            </div>

            {/* Two Column: Experience & Monthly Capacity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1c1917]">
                  कारीगरी का अनुभव (वर्षों में) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="70"
                  required
                  value={craftExperienceYears}
                  onChange={(e) => setCraftExperienceYears(e.target.value)}
                  className="w-full bg-[#faf7f2] border border-[#e6ded3] rounded-2xl px-4 py-3 text-xs sm:text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c85a32] focus:outline-hidden"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1c1917]">
                  मासिक निर्माण क्षमता (इकाइयों में) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  required
                  value={productionCapacityMonthly}
                  onChange={(e) => setProductionCapacityMonthly(e.target.value)}
                  className="w-full bg-[#faf7f2] border border-[#e6ded3] rounded-2xl px-4 py-3 text-xs sm:text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c85a32] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Field 4: Description */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#1c1917]">
                शिल्प व निर्माण तकनीक का संक्षिप्त विवरण (Craft Description & Technique)
              </label>
              <textarea
                rows={3}
                placeholder="उदा. हम शुद्ध रेशम और जरी से पारंपरिक कढ़ुआ बुनाई करते हैं, प्रत्येक साड़ी बनाने में 15 दिन लगते हैं।"
                value={sampleDescription}
                onChange={(e) => setSampleDescription(e.target.value)}
                className="w-full bg-[#faf7f2] border border-[#e6ded3] rounded-2xl px-4 py-3 text-xs sm:text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c85a32] focus:outline-hidden placeholder:text-[#a89e96]"
              />
            </div>

            {/* Field 5: Masked Aadhaar (Last 4 digits - DPDP 2023 compliant) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#1c1917]">
                  आधार के अंतिम 4 अंक (Masked Aadhaar Last 4 Digits) *
                </label>
                <span className="text-[10px] text-[#8f8179]">DPDP 2023 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#6f5f58] bg-[#faf7f2] px-3 py-3 rounded-2xl border border-[#e6ded3]">
                  XXXX-XXXX-
                </span>
                <input
                  type="text"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  required
                  placeholder="8941"
                  value={maskedAadhaarLast4}
                  onChange={(e) => setMaskedAadhaarLast4(e.target.value.replace(/\D/g, ''))}
                  className="w-24 bg-[#faf7f2] border border-[#e6ded3] rounded-2xl px-4 py-3 text-xs sm:text-sm text-center font-mono font-bold text-[#1c1917] focus:ring-2 focus:ring-[#c85a32] focus:outline-hidden"
                />
              </div>
              <p className="text-[11px] text-[#6f5f58]">
                सुरक्षा के लिए केवल अंतिम 4 अंक संग्रहीत किए जाते हैं ताकि कारीगर की विशिष्ट पहचान सुनिश्चित हो सके।
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#c85a32] hover:bg-[#b84e28] text-white font-extrabold text-xs sm:text-sm py-3.5 rounded-full transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSubmitting ? 'आवेदन भेजा जा रहा है...' : 'कारीगर आवेदन जमा करें (Submit Application)'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
