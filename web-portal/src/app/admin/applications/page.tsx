'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  fetchAdminApplications,
  approveAdminApplication,
  rejectAdminApplication,
  ArtisanApplicationItem
} from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import {
  ShieldCheck,
  KeyRound,
  UserCheck,
  UserX,
  Clock,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Calendar,
  Lock,
  X
} from 'lucide-react';

export default function AdminApplicationsPage() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [applications, setApplications] = useState<ArtisanApplicationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Rejection modal state
  const [rejectModalApp, setRejectModalApp] = useState<ArtisanApplicationItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAdminApplications();
      setApplications(data);
    } catch (e) {
      console.warn('Failed to load artisan applications:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadApplications();
    }
  }, [isAdmin]);

  const handleApprove = async (appId: string) => {
    if (!isSuperAdmin) {
      setToastMessage('त्रुटि: केवल सुपर एडमिन ही कारीगर आवेदन स्वीकृत कर सकते हैं (Super Admin clearance required)।');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    setIsActionPending(true);
    try {
      const res = await approveAdminApplication(appId);
      if (res.success) {
        setToastMessage(`आवेदन #${appId} सफलतापूर्वक स्वीकृत! कारीगर की भूमिका अपडेट कर दी गई।`);
        await loadApplications();
      } else {
        setToastMessage(`त्रुटि: ${res.error || 'अनुमोदन विफल'}`);
      }
    } catch (e: any) {
      setToastMessage(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const openRejectModal = (app: ArtisanApplicationItem) => {
    if (!isSuperAdmin) {
      setToastMessage('त्रुटि: केवल सुपर एडमिन ही कारीगर आवेदन अस्वीकृत कर सकते हैं (Super Admin clearance required)।');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    setRejectModalApp(app);
    setRejectReason('');
    setRejectError('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalApp) return;
    if (!rejectReason.trim()) {
      setRejectError('कृपया अस्वीकृति का कारण अनिवार्य रूप से दर्ज करें (Rejection reason is required)।');
      return;
    }
    setIsActionPending(true);
    try {
      const res = await rejectAdminApplication(rejectModalApp.id, rejectReason.trim());
      if (res.success) {
        setToastMessage(`आवेदन #${rejectModalApp.id} अस्वीकृत कर दिया गया।`);
        setRejectModalApp(null);
        await loadApplications();
      } else {
        setRejectError(res.error || 'अस्वीकृति विफल');
      }
    } catch (e: any) {
      setRejectError(e.message || 'त्रुटि हुई');
    } finally {
      setIsActionPending(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const pendingApps = applications.filter((a) => a.status === 'pending');
  const pastApps = applications.filter((a) => a.status !== 'pending');

  return (
    <AuthGuard
      allowedRoles={['admin', 'super_admin']}
      redirectMessage="Sign in as Administrator or Super Admin to review artisan applications."
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-20 right-5 z-50 bg-[#1b4332] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-[#e9a83a]/40 animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-[#e9a83a]" />
            <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Back link */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6f5f58] hover:text-[#1b4332] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>मुख्य प्रशासन नियंत्रण पर वापस जाएं (Back to Admin Dashboard)</span>
        </Link>

        {/* Top Header */}
        <div className="bg-[#141414] text-white rounded-3xl p-6 sm:p-10 border border-[#27272a] flex flex-col md:flex-row justify-between md:items-center gap-6 shadow-md">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-300 text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider border border-purple-500/30">
              <KeyRound className="w-3.5 h-3.5 text-purple-300" />
              <span>Super Admin Exclusive Clearances • MoSJE Artisan Review</span>
            </div>

            <h1 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              कारीगर सत्यापन व आवेदन समीक्षा (Artisan Applications Queue)
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 font-light leading-relaxed">
              पारंपरिक भारतीय शिल्पकारों द्वारा प्रस्तुत आवेदन। आवेदनों की समीक्षा करें, शिल्प विधा व कार्यशाला विवरण सत्यापित करें, और सुपर एडमिन अधिकार के साथ स्वीकृति अथवा कारण सहित अस्वीकृति दें।
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={loadApplications}
              disabled={isLoading}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>रिफ्रेश आवेदन</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#e6ded3] bento-shadow space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>लंबित आवेदन (Pending Review)</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="font-sans text-3xl font-black text-amber-700">{pendingApps.length}</div>
            <div className="text-[11px] text-[#6f5f58]">कार्रवाई की प्रतीक्षा में</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#e6ded3] bento-shadow space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>स्वीकृत कारीगर (Approved)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-sans text-3xl font-black text-emerald-700">
              {applications.filter((a) => a.status === 'approved').length}
            </div>
            <div className="text-[11px] text-[#2d6a4f]">सक्रिय कारीगर खाता</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#e6ded3] bento-shadow space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>अस्वीकृत आवेदन (Rejected)</span>
              <UserX className="w-4 h-4 text-red-600" />
            </div>
            <div className="font-sans text-3xl font-black text-red-700">
              {applications.filter((a) => a.status === 'rejected').length}
            </div>
            <div className="text-[11px] text-red-700">कारण सहित अस्वीकृत</div>
          </div>
        </div>

        {/* PENDING APPLICATIONS QUEUE */}
        <div className="bg-white rounded-3xl border border-[#e6ded3] overflow-hidden bento-shadow p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-[#e6ded3] pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#1c1917]">
                लंबित आवेदन कतार ({pendingApps.length})
              </h2>
              <p className="text-xs text-[#6f5f58] mt-0.5">
                नीचे दिए गए आवेदनों को केवल सुपर एडमिन द्वारा ही स्वीकृत या अस्वीकृत किया जा सकता है।
              </p>
            </div>
          </div>

          {pendingApps.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-[#faf7f2] rounded-2xl border border-dashed border-[#e6ded3]">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-[#1c1917]">कोई लंबित आवेदन नहीं है</p>
              <p className="text-xs text-[#545454]">सभी प्राप्त आवेदन संसाधित किए जा चुके हैं।</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApps.map((app) => (
                <div
                  key={app.id}
                  className="p-5 sm:p-6 bg-[#faf7f2] rounded-2xl border border-[#e6ded3] hover:border-[#c85a32]/40 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e6ded3]/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#e6ded3] flex items-center justify-center font-bold text-[#c85a32]">
                        {app.craft_category[0]}
                      </div>
                      <div>
                        <span className="font-extrabold text-sm sm:text-base text-[#1c1917] block">
                          {app.full_name || `आवेदक (${app.user_id.slice(0, 10)})`}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-[#6f5f58] font-mono">
                          <span>ID: {app.id}</span>
                          <span>•</span>
                          <span>User: {app.user_id}</span>
                          {app.phone && (
                            <>
                              <span>•</span>
                              <span>📞 {app.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> समीक्षाधीन (Pending)
                      </span>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-[#e6ded3]">
                      <span className="text-[10px] uppercase font-bold text-[#6f5f58] block">शिल्प श्रेणी</span>
                      <span className="font-bold text-[#1c1917] text-sm">{app.craft_category}</span>
                      <span className="text-[11px] text-[#6f5f58] block mt-0.5">{app.experience_years} वर्ष का अनुभव</span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-[#e6ded3]">
                      <span className="text-[10px] uppercase font-bold text-[#6f5f58] block">स्थान / राज्य</span>
                      <span className="font-bold text-[#1c1917] text-sm">
                        {app.state || 'उत्तर प्रदेश'}{app.district ? `, ${app.district}` : ''}
                      </span>
                      <span className="text-[11px] text-[#6f5f58] block mt-0.5">
                        जमा तिथि: {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('hi-IN') : app.created_at ? new Date(app.created_at).toLocaleDateString('hi-IN') : 'हाल ही में'}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-[#e6ded3]">
                      <span className="text-[10px] uppercase font-bold text-[#6f5f58] block">कार्यशाला जानकारी</span>
                      <p className="text-[#1c1917] line-clamp-2 mt-0.5">
                        {app.workshop_info || 'सामान्य कारीगर कार्यशाला'}
                      </p>
                    </div>
                  </div>

                  {/* Craft description if available */}
                  {app.craft_description && (
                    <div className="bg-white p-3.5 rounded-xl border border-[#e6ded3] text-xs space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#6f5f58] block">
                        शिल्प व निर्माण तकनीक विवरण:
                      </span>
                      <p className="text-[#1c1917] leading-relaxed">
                        {app.craft_description}
                      </p>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-[#e6ded3]/60">
                    <div className="text-[11px] text-[#6f5f58]">
                      अनुमोदन पर Supabase Auth <code>app_metadata.role</code> स्वतः <strong>artisan</strong> में अपग्रेड हो जाएगी।
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {isSuperAdmin ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(app.id)}
                            disabled={isActionPending}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                          >
                            <UserCheck className="w-4 h-4" />
                            <span>स्वीकार करें (Approve)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openRejectModal(app)}
                            disabled={isActionPending}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <UserX className="w-4 h-4" />
                            <span>अस्वीकार करें (Reject)</span>
                          </button>
                        </>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
                          <Lock className="w-3.5 h-3.5 text-amber-700" />
                          <span>स्वीकृति केवल सुपर एडमिन द्वारा मान्य है</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PROCESSED APPLICATIONS HISTORY */}
        {pastApps.length > 0 && (
          <div className="bg-white rounded-3xl border border-[#e6ded3] overflow-hidden bento-shadow p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-extrabold text-[#1c1917] border-b border-[#e6ded3] pb-3">
              संसाधित आवेदन इतिहास (Processed Applications History)
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e6ded3] text-[#6f5f58] uppercase text-[10px] font-bold">
                    <th className="py-3 px-3">आवेदक / ID</th>
                    <th className="py-3 px-3">शिल्प</th>
                    <th className="py-3 px-3">स्थान</th>
                    <th className="py-3 px-3">समीक्षा तिथि</th>
                    <th className="py-3 px-3">समीक्षक ID</th>
                    <th className="py-3 px-3">स्थिति</th>
                    <th className="py-3 px-3">कारण / टिप्पणी</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f0ea]">
                  {pastApps.map((app) => (
                    <tr key={app.id} className="hover:bg-[#faf7f2] transition-colors">
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-[#1c1917] block">
                          {app.full_name || app.user_id.slice(0, 10)}
                        </span>
                        <span className="text-[10px] font-mono text-[#6f5f58]">ID: {app.id}</span>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-[#1c1917]">
                        {app.craft_category} ({app.experience_years} वर्ष)
                      </td>
                      <td className="py-3.5 px-3 text-[#545454]">
                        {app.state || 'N/A'}
                      </td>
                      <td className="py-3.5 px-3 text-[#545454]">
                        {app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString('hi-IN') : '-'}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[10px] text-[#6f5f58]">
                        {app.reviewed_by ? app.reviewed_by.slice(0, 12) : '-'}
                      </td>
                      <td className="py-3.5 px-3">
                        {app.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> स्वीकृत (Approved)
                          </span>
                        )}
                        {app.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full bg-red-50 text-red-800 border border-red-200">
                            <UserX className="w-3 h-3" /> अस्वीकृत (Rejected)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-[#6f5f58] max-w-xs">
                        {app.rejection_reason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REJECTION REASON MODAL */}
        {rejectModalApp && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 border border-[#e6ded3] shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-3">
                <div className="flex items-center gap-2 text-red-600 font-extrabold text-base">
                  <UserX className="w-5 h-5" />
                  <span>आवेदन अस्वीकार करें (Reject Application)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectModalApp(null)}
                  className="text-[#6f5f58] hover:text-[#1c1917] p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-[#545454]">
                <p>
                  आवेदक: <strong>{rejectModalApp.full_name || rejectModalApp.user_id}</strong>
                </p>
                <p>
                  शिल्प: <strong>{rejectModalApp.craft_category}</strong>
                </p>
                <p className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  अस्वीकृति का कारण अनिवार्य है। यह कारण आवेदक को उनके आवेदन पृष्ठ पर प्रदर्शित किया जाएगा ताकि वे सुधार कर पुनः आवेदन कर सकें।
                </p>
              </div>

              {rejectError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{rejectError}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1c1917]">
                  अस्वीकृति का कारण (Reason for Rejection) *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="उदा. कार्यशाला का विवरण अपूर्ण है, अथवा शिल्प का प्रमाण पत्र संलग्न नहीं किया गया।"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-[#faf7f2] border border-[#e6ded3] rounded-2xl p-3 text-xs text-[#1c1917] focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalApp(null)}
                  disabled={isActionPending}
                  className="py-2.5 px-4 rounded-xl border border-[#e6ded3] bg-white hover:bg-[#faf7f2] text-[#1c1917] font-bold text-xs transition-all cursor-pointer"
                >
                  रद्द करें
                </button>

                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={isActionPending || !rejectReason.trim()}
                  className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isActionPending ? 'प्रक्रिया जारी...' : 'अस्वीकार करें (Confirm Reject)'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
