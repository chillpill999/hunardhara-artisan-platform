'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  fetchAdminOverviewMetrics,
  fetchAdminArtisans,
  verifyArtisanGI,
  suspendArtisan,
  reactivateArtisan,
  fetchAdminProducts,
  moderateAdminProduct,
  restoreAdminProduct,
  fetchAdminClusters,
  updateClusterWage,
  fetchAdminOrders,
  updateAdminOrderStatus,
  fetchAdminB2BRFQs,
  updateAdminB2BStatus,
  fetchPlatformUsers,
  suspendPlatformUser,
  reactivatePlatformUser,
  fetchAdminApplications,
  approveAdminApplication,
  rejectAdminApplication,
  fetchAdminUsers,
  grantAdminRole,
  revokeAdminRole,
  fetchAuditLogs,
} from '@/lib/api';
import {
  PlatformSettings,
  PlatformOverviewMetrics,
  AdminArtisanItem,
  AdminProductItem,
  AdminClusterItem,
  AdminOrderItem,
  AdminB2BRFQItem,
  AdminPlatformUserItem,
  AdminAuditLogItem,
  ArtisanApplicationItem,
  AdminUserItem,
} from '@/lib/types';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import {
  ShieldCheck,
  Building2,
  Users,
  TrendingUp,
  MapPin,
  Award,
  Compass,
  HeartHandshake,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Search,
  CheckCircle2,
  Eye,
  Package,
  Upload,
  ExternalLink,
  X,
  MessageSquare,
  Phone,
  Mail,
  FileText,
  Lock,
  ShieldAlert,
  Edit3,
  Sliders,
  Briefcase,
  Check,
  Clock,
  Send,
  Plus,
  UserCheck,
  UserX,
  History,
  KeyRound,
  Shield,
  Power,
  AlertCircle,
  Ban,
  RefreshCw,
  DollarSign,
  ShoppingCart,
  ChevronRight,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, role, isAdmin, isSuperAdmin } = useAuth();

  type TabKey =
    | 'overview'
    | 'switches'
    | 'applications'
    | 'artisans'
    | 'products'
    | 'clusters'
    | 'orders'
    | 'b2b'
    | 'admin_management'
    | 'audit_logs';

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Authoritative State from Backend
  const [overview, setOverview] = useState<PlatformOverviewMetrics | null>(null);
  const [switches, setSwitches] = useState<PlatformSettings>({
    marketplace_enabled: true,
    artisan_onboarding_enabled: true,
    product_publishing_enabled: true,
    b2b_enabled: true,
    orders_enabled: true,
    ai_catalog_enabled: true,
    voice_catalog_enabled: true,
    maintenance_mode: false,
    maintenance_message: 'Platform maintenance in progress.',
  });
  const [applications, setApplications] = useState<ArtisanApplicationItem[]>([]);
  const [artisans, setArtisans] = useState<AdminArtisanItem[]>([]);
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [clusters, setClusters] = useState<AdminClusterItem[]>([]);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [b2bRFQs, setB2bRFQs] = useState<AdminB2BRFQItem[]>([]);
  const [platformUsers, setPlatformUsers] = useState<AdminPlatformUserItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);

  // Local UI State
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Maintenance Message Editor
  const [editingMaintMsg, setEditingMaintMsg] = useState(false);
  const [maintMsgDraft, setMaintMsgDraft] = useState('');

  // Editable Wage Baseline
  const [editingWageClusterId, setEditingWageClusterId] = useState<string | null>(null);
  const [tempDailyWage, setTempDailyWage] = useState<number>(650);
  const [tempHourlyWage, setTempHourlyWage] = useState<number>(81.25);

  // User Role Appointment
  const [newAdminUserId, setNewAdminUserId] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const [
        metricsData,
        settingsData,
        appList,
        artList,
        prodList,
        clusterList,
        orderList,
        rfqList,
        logList,
      ] = await Promise.all([
        fetchAdminOverviewMetrics(),
        fetchPlatformSettings(),
        fetchAdminApplications(),
        fetchAdminArtisans(),
        fetchAdminProducts(100),
        fetchAdminClusters(),
        fetchAdminOrders(100),
        fetchAdminB2BRFQs(),
        fetchAuditLogs(50),
      ]);

      if (metricsData) setOverview(metricsData);
      setSwitches(settingsData);
      setMaintMsgDraft(settingsData.maintenance_message);
      setApplications(appList || []);
      setArtisans(artList || []);
      setProducts(prodList || []);
      setClusters(clusterList || []);
      setOrders(orderList || []);
      setB2bRFQs(rfqList || []);
      setAuditLogs(logList || []);

      if (isSuperAdmin) {
        const [users, pUsers] = await Promise.all([
          fetchAdminUsers(),
          fetchPlatformUsers(),
        ]);
        setAdminUsers(users || []);
        setPlatformUsers(pUsers || []);
      }
    } catch (err) {
      console.warn('Super Admin load data error:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin, isSuperAdmin]);

  // -------------------------------------------------------------------------
  // Handlers: Platform Switches
  // -------------------------------------------------------------------------
  const handleToggleSwitch = async (key: keyof PlatformSettings, currentVal: boolean) => {
    if (!isSuperAdmin) {
      showToast('केवल सुपर एडमिन ही प्लेटफ़ॉर्म स्विच बदल सकते हैं (Super Admin clearance required)।');
      return;
    }
    setIsActionPending(true);
    try {
      const newVal = !currentVal;
      const res = await updatePlatformSettings({ [key]: newVal });
      if (res.success && res.settings) {
        setSwitches(res.settings);
        showToast(`स्विच "${key}" सफलतापूर्वक ${newVal ? 'सक्रिय (ON)' : 'निष्क्रिय (OFF)'} किया गया।`);
        // Refresh metrics
        const updatedMetrics = await fetchAdminOverviewMetrics();
        if (updatedMetrics) setOverview(updatedMetrics);
      } else {
        showToast(`त्रुटि: ${res.message || 'अपडेट विफल'}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSaveMaintenanceMessage = async () => {
    if (!isSuperAdmin) return;
    setIsActionPending(true);
    try {
      const res = await updatePlatformSettings({ maintenance_message: maintMsgDraft.trim() });
      if (res.success && res.settings) {
        setSwitches(res.settings);
        setEditingMaintMsg(false);
        showToast('रखरखाव संदेश (Maintenance Message) अद्यतन किया गया।');
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Artisan Application Lifecycle
  // -------------------------------------------------------------------------
  const handleApproveApp = async (appId: string) => {
    if (!isSuperAdmin) {
      showToast('केवल सुपर एडमिन ही कारीगर आवेदन स्वीकृत कर सकते हैं।');
      return;
    }
    setIsActionPending(true);
    try {
      const res = await approveAdminApplication(appId);
      if (res.success) {
        showToast(`आवेदन #${appId} स्वीकृत! कारीगर खाता सक्रिय कर दिया गया।`);
        await loadData();
      } else {
        showToast(`त्रुटि: ${res.error || 'अनुमोदन विफल'}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRejectApp = async (appId: string) => {
    if (!isSuperAdmin) {
      showToast('केवल सुपर एडमिन ही कारीगर आवेदन अस्वीकृत कर सकते हैं।');
      return;
    }
    const reason = window.prompt('कारीगर आवेदन अस्वीकृत करने का कारण दर्ज करें (Reason):');
    if (!reason || !reason.trim()) {
      showToast('त्रुटि: अस्वीकृति का कारण अनिवार्य है।');
      return;
    }
    setIsActionPending(true);
    try {
      const res = await rejectAdminApplication(appId, reason.trim());
      if (res.success) {
        showToast(`आवेदन #${appId} अस्वीकृत किया गया।`);
        await loadData();
      } else {
        showToast(`त्रुटि: ${res.error || 'अस्वीकृति विफल'}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Artisan Governance (GI & Suspension)
  // -------------------------------------------------------------------------
  const handleToggleArtisanGI = async (artisanId: string, currentVerified: boolean) => {
    if (!isSuperAdmin) {
      showToast('केवल सुपर एडमिन ही आधिकारिक GI प्रमाणन बदल सकते हैं।');
      return;
    }
    setIsActionPending(true);
    try {
      const newStatus = !currentVerified;
      const res = await verifyArtisanGI(artisanId, newStatus);
      if (res.success) {
        setArtisans((prev) =>
          prev.map((a) => (a.id === artisanId ? { ...a, gi_verified: newStatus } : a))
        );
        showToast(`कारीगर GI प्रमाणन ${newStatus ? 'सत्यापित (Certified)' : 'हटाया गया'}।`);
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSuspendArtisan = async (artisanId: string) => {
    if (!isSuperAdmin) return;
    const reason = window.prompt('कारीगर खाता निलंबित करने का कारण दर्ज करें (Reason for suspension):', 'Administrative review');
    if (reason === null) return;

    setIsActionPending(true);
    try {
      const res = await suspendArtisan(artisanId, reason);
      if (res.success) {
        setArtisans((prev) =>
          prev.map((a) => (a.id === artisanId ? { ...a, is_active: false } : a))
        );
        showToast('कारीगर खाता सफलतापूर्वक निलंबित कर दिया गया।');
        const updated = await fetchAdminOverviewMetrics();
        if (updated) setOverview(updated);
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleReactivateArtisan = async (artisanId: string) => {
    if (!isSuperAdmin) return;
    setIsActionPending(true);
    try {
      const res = await reactivateArtisan(artisanId);
      if (res.success) {
        setArtisans((prev) =>
          prev.map((a) => (a.id === artisanId ? { ...a, is_active: true } : a))
        );
        showToast('कारीगर खाता पुनः सक्रिय (Reactivated) कर दिया गया।');
        const updated = await fetchAdminOverviewMetrics();
        if (updated) setOverview(updated);
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Product Moderation Lifecycle
  // -------------------------------------------------------------------------
  const handleModerateProduct = async (
    productId: string,
    action: 'publish' | 'unpublish' | 'flag' | 'remove'
  ) => {
    const reason = window.prompt(`उत्पाद कार्रवाई '${action}' का कारण दर्ज करें (Reason):`, 'Administrative review');
    if (reason === null || !reason.trim()) {
      showToast('कार्रवाई का कारण अनिवार्य है।');
      return;
    }
    setIsActionPending(true);
    try {
      const res = await moderateAdminProduct(productId, action, reason.trim());
      if (res.success) {
        showToast(`उत्पाद कार्रवाई '${action}' सफलतापूर्वक लागू की गई।`);
        await loadData();
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRestoreProduct = async (productId: string) => {
    if (!isSuperAdmin) return;
    setIsActionPending(true);
    try {
      const res = await restoreAdminProduct(productId);
      if (res.success) {
        showToast('उत्पाद को सर्वर पर पुनः सक्रिय (Restored) कर दिया गया।');
        await loadData();
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Clusters & Wage Governance
  // -------------------------------------------------------------------------
  const handleSaveWage = async (clusterId: string) => {
    if (!isSuperAdmin) {
      showToast('केवल सुपर एडमिन ही वैधानिक मजदूरी दर अद्यतन कर सकते हैं।');
      return;
    }
    setIsActionPending(true);
    try {
      const res = await updateClusterWage(clusterId, tempDailyWage, tempHourlyWage);
      if (res.success) {
        setClusters((prev) =>
          prev.map((c) =>
            c.id === clusterId
              ? { ...c, statutory_daily_wage: tempDailyWage, statutory_hourly_wage: tempHourlyWage }
              : c
          )
        );
        setEditingWageClusterId(null);
        showToast(`क्लस्टर वैधानिक न्यूनतम मजदूरी ₹${tempDailyWage}/दिन पर अद्यतन की गई।`);
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Order Oversight
  // -------------------------------------------------------------------------
  const handleUpdateOrderStatus = async (orderId: string, status: string, paymentStatus?: string) => {
    if (!isSuperAdmin) return;
    setIsActionPending(true);
    try {
      const res = await updateAdminOrderStatus(orderId, status, paymentStatus);
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status,
                  payment_status: paymentStatus || o.payment_status,
                }
              : o
          )
        );
        showToast(`ऑर्डर #${orderId} की स्थिति अद्यतन की गई।`);
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: B2B RFQs
  // -------------------------------------------------------------------------
  const handleUpdateB2BStatus = async (rfqId: string, newStatus: string) => {
    if (!isSuperAdmin) return;
    setIsActionPending(true);
    try {
      const res = await updateAdminB2BStatus(rfqId, newStatus);
      if (res.success) {
        setB2bRFQs((prev) =>
          prev.map((r) => (r.id === rfqId ? { ...r, status: newStatus } : r))
        );
        showToast(`थोक मांग #${rfqId} की स्थिति '${newStatus}' अद्यतन की गई।`);
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: User & Administrator Management
  // -------------------------------------------------------------------------
  const handleSuspendUser = async (userId: string) => {
    if (!isSuperAdmin) return;
    const reason = window.prompt('खाता निलंबित करने का कारण दर्ज करें (Reason):', 'Administrative review');
    if (reason === null) return;

    setIsActionPending(true);
    try {
      const res = await suspendPlatformUser(userId, reason);
      if (res.success) {
        setPlatformUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, is_suspended: true } : u))
        );
        showToast('उपयोगकर्ता खाता निलंबित किया गया।');
        const updated = await fetchAdminOverviewMetrics();
        if (updated) setOverview(updated);
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleReactivateUser = async (userId: string) => {
    if (!isSuperAdmin) return;
    setIsActionPending(true);
    try {
      const res = await reactivatePlatformUser(userId);
      if (res.success) {
        setPlatformUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, is_suspended: false } : u))
        );
        showToast('उपयोगकर्ता खाता पुनः सक्रिय किया गया।');
        const updated = await fetchAdminOverviewMetrics();
        if (updated) setOverview(updated);
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleGrantAdmin = async (userId: string) => {
    if (!isSuperAdmin) return;
    setIsActionPending(true);
    try {
      const res = await grantAdminRole(userId);
      if (res.success) {
        showToast(res.message || 'प्रशासक पद प्रदान किया गया।');
        setNewAdminUserId('');
        await loadData();
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRevokeAdmin = async (userId: string) => {
    if (!isSuperAdmin) return;
    if (!window.confirm('क्या आप निश्चित हैं कि आप इस प्रशासक का पद वापस लेना चाहते हैं?')) return;
    setIsActionPending(true);
    try {
      const res = await revokeAdminRole(userId);
      if (res.success) {
        showToast(res.message || 'प्रशासक पद वापस ले लिया गया।');
        await loadData();
      } else {
        showToast(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      showToast(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p) return false;
      const q = (searchQuery || '').toLowerCase().trim();
      const title = (p.title || '').toLowerCase();
      const craftType = (p.craft_type || '').toLowerCase();
      const artisanName = (p.artisan_name || '').toLowerCase();
      return !q || title.includes(q) || craftType.includes(q) || artisanName.includes(q);
    });
  }, [products, searchQuery]);

  return (
    <AuthGuard allowedRoles={['admin', 'super_admin']}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#1c1917] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-amber-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
            <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* 👑 SUPER ADMIN EMERGENCY QUICK CONTROL BAR */}
        {isSuperAdmin && (
          <div className="bg-gradient-to-r from-amber-950/80 via-neutral-900 to-amber-950/80 text-white rounded-3xl p-5 border-2 border-amber-500/50 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">👑</span>
                <div>
                  <div className="text-xs font-black tracking-wider uppercase text-amber-400">
                    सुपर एडमिन अधिकार सक्रिय • Super Admin Authority Active
                  </div>
                  <div className="text-[11px] text-neutral-300 font-mono">
                    प्राथमिक पहचान: aryanrockstar2007@gmail.com {user?.email ? `(${user.email})` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  disabled={isLoadingData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                  <span>रिफ्रेश (Sync)</span>
                </button>
                <div className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">
                  ● सर्वर प्राधिकृत (Server Authoritative)
                </div>
              </div>
            </div>

            {/* Emergency Toggle Switches */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {/* Maintenance Mode */}
              <button
                onClick={() => handleToggleSwitch('maintenance_mode', switches.maintenance_mode)}
                disabled={isActionPending}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  switches.maintenance_mode
                    ? 'bg-red-950/80 border-red-500 text-red-200'
                    : 'bg-black/40 border-neutral-700 hover:border-neutral-500 text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider">रखरखाव (Maint)</span>
                  <Power className={`w-3.5 h-3.5 ${switches.maintenance_mode ? 'text-red-400' : 'text-neutral-500'}`} />
                </div>
                <div className="text-xs font-extrabold mt-1">
                  {switches.maintenance_mode ? '🚨 LOCKDOWN ON' : 'सामान्य (OFF)'}
                </div>
              </button>

              {/* Marketplace Active */}
              <button
                onClick={() => handleToggleSwitch('marketplace_enabled', switches.marketplace_enabled)}
                disabled={isActionPending}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  switches.marketplace_enabled
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-red-950/60 border-red-500 text-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider">मार्केटप्लेस</span>
                  <ShoppingCart className={`w-3.5 h-3.5 ${switches.marketplace_enabled ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <div className="text-xs font-extrabold mt-1">
                  {switches.marketplace_enabled ? 'सक्रिय (Active)' : 'रोक (Paused)'}
                </div>
              </button>

              {/* Product Publishing */}
              <button
                onClick={() => handleToggleSwitch('product_publishing_enabled', switches.product_publishing_enabled)}
                disabled={isActionPending}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  switches.product_publishing_enabled
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-red-950/60 border-red-500 text-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider">उत्पाद प्रकाशन</span>
                  <Package className={`w-3.5 h-3.5 ${switches.product_publishing_enabled ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <div className="text-xs font-extrabold mt-1">
                  {switches.product_publishing_enabled ? 'सक्रिय (Active)' : 'रोक (Paused)'}
                </div>
              </button>

              {/* Artisan Onboarding */}
              <button
                onClick={() => handleToggleSwitch('artisan_onboarding_enabled', switches.artisan_onboarding_enabled)}
                disabled={isActionPending}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  switches.artisan_onboarding_enabled
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-red-950/60 border-red-500 text-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider">कारीगर ऑनबोर्डिंग</span>
                  <Users className={`w-3.5 h-3.5 ${switches.artisan_onboarding_enabled ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <div className="text-xs font-extrabold mt-1">
                  {switches.artisan_onboarding_enabled ? 'सक्रिय (Active)' : 'रोक (Paused)'}
                </div>
              </button>

              {/* B2B Procurement */}
              <button
                onClick={() => handleToggleSwitch('b2b_enabled', switches.b2b_enabled)}
                disabled={isActionPending}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  switches.b2b_enabled
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-red-950/60 border-red-500 text-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider">थोक मांग (B2B)</span>
                  <Briefcase className={`w-3.5 h-3.5 ${switches.b2b_enabled ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <div className="text-xs font-extrabold mt-1">
                  {switches.b2b_enabled ? 'सक्रिय (Active)' : 'रोक (Paused)'}
                </div>
              </button>

              {/* Orders Active */}
              <button
                onClick={() => handleToggleSwitch('orders_enabled', switches.orders_enabled)}
                disabled={isActionPending}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  switches.orders_enabled
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-red-950/60 border-red-500 text-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider">ऑर्डर खरीद</span>
                  <DollarSign className={`w-3.5 h-3.5 ${switches.orders_enabled ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <div className="text-xs font-extrabold mt-1">
                  {switches.orders_enabled ? 'सक्रिय (Active)' : 'रोक (Paused)'}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Top Header Banner */}
        <div className="bg-[#141414] text-white rounded-3xl p-6 sm:p-8 border border-[#27272a] flex flex-col md:flex-row justify-between md:items-center gap-6 shadow-md">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 text-amber-400 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>MoSJE National Craft Governance • Central Control Console</span>
            </div>

            <h1 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {isSuperAdmin ? 'सुपर एडमिन नियंत्रण कक्ष (Super Admin Control Center)' : 'प्रशासकीय नियंत्रण कक्ष (Admin Console)'}
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 font-light leading-relaxed">
              प्लेटफ़ॉर्म के सभी महत्वपूर्ण तंत्रों पर पूर्ण अधिकार — आपातकालीन स्विच, कारीगर आवेदन स्वीकृति, GI प्रमाणन, उत्पाद मॉडरेशन, वैधानिक न्यूनतम मजदूरी और ऑडिट ट्रेल।
            </p>
          </div>

          {/* User Badge */}
          <div className="bg-[#1c1917] p-4 rounded-2xl border border-[#2e2e30] text-xs space-y-2 shrink-0">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isSuperAdmin ? '👑 सुपर एडमिनिस्ट्रेटर' : 'प्रमाणित प्रशासक (Admin)'}</span>
            </div>
            <div className="text-[11px] font-mono text-amber-400 bg-black/40 px-2.5 py-1 rounded-lg border border-[#3e3e42] truncate max-w-xs">
              {user?.email || 'aryanrockstar2007@gmail.com'}
            </div>
            <div className="flex items-center gap-2 text-neutral-400 text-[10px] pt-1 border-t border-[#2e2e30]">
              <span>DPDP Act 2023 Compliant • UIDAI Vault Guard</span>
            </div>
          </div>
        </div>

        {/* Key Metric Snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] shadow-xs space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>लाइव उत्पाद</span>
              <Package className="w-3.5 h-3.5 text-[#1b4332]" />
            </div>
            <div className="font-sans text-2xl font-black text-[#231f1e]">
              {overview?.active_products ?? products.length}
            </div>
            <div className="text-[10px] text-[#2d6a4f] font-semibold">मार्केटप्लेस पर सक्रिय</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] shadow-xs space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>कारीगर आवेदन</span>
              <Users className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="font-sans text-2xl font-black text-amber-600">
              {applications.filter((a) => a.status === 'pending').length}
            </div>
            <div className="text-[10px] text-[#6f5f58]">समीक्षा प्रतीक्षारत</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] shadow-xs space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>सक्रिय कारीगर</span>
              <Award className="w-3.5 h-3.5 text-[#c85a32]" />
            </div>
            <div className="font-sans text-2xl font-black text-[#c85a32]">
              {overview?.active_artisans ?? artisans.filter((a) => a.is_active).length}
            </div>
            <div className="text-[10px] text-[#2d6a4f] font-semibold">पंजीकृत व सत्यापित</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] shadow-xs space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>शिल्प क्लस्टर</span>
              <Building2 className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="font-sans text-2xl font-black text-neutral-800">
              {clusters.length}
            </div>
            <div className="text-[10px] text-[#6f5f58]">वैधानिक मजदूरी लागू</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] shadow-xs space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>कुल ऑर्डर</span>
              <ShoppingCart className="w-3.5 h-3.5 text-[#1b4332]" />
            </div>
            <div className="font-sans text-2xl font-black text-[#1b4332]">
              {overview?.total_orders ?? orders.length}
            </div>
            <div className="text-[10px] text-[#2d6a4f] font-semibold">₹{overview?.total_revenue?.toLocaleString('en-IN') || '0'} बिक्री</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] shadow-xs space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>प्लेटफ़ॉर्म स्थिति</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="font-sans text-lg font-black text-emerald-700">
              {switches.maintenance_mode ? 'MAINTENANCE' : 'OPERATIONAL'}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold">सर्वर सुरक्षित</div>
          </div>
        </div>

        {/* 9 PRODUCTION NAVIGATION TABS */}
        <div className="flex items-center gap-1.5 border-b border-[#e6ded3] pb-3 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#6f5f58] hover:text-[#1b4332] border border-[#e6ded3]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>प्लेटफ़ॉर्म समीक्षा (Overview)</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('switches')}
              className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'switches'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              <Power className="w-3.5 h-3.5 text-amber-700" />
              <span>👑 आपातकालीन नियंत्रण (Switches)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('applications')}
            className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'applications'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#6f5f58] hover:text-[#1b4332] border border-[#e6ded3]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>कारीगर आवेदन (Applications)</span>
            {applications.filter((a) => a.status === 'pending').length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {applications.filter((a) => a.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('artisans')}
            className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'artisans'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#6f5f58] hover:text-[#1b4332] border border-[#e6ded3]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>कारीगर व GI प्रमाणन (Artisans)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'products'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#6f5f58] hover:text-[#1b4332] border border-[#e6ded3]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>उत्पाद मॉडरेशन (Products)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clusters')}
            className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'clusters'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#6f5f58] hover:text-[#1b4332] border border-[#e6ded3]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>क्लस्टर व मजदूरी (Clusters)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#6f5f58] hover:text-[#1b4332] border border-[#e6ded3]'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>ऑर्डर निगरानी (Orders)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('b2b')}
            className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'b2b'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#6f5f58] hover:text-[#1b4332] border border-[#e6ded3]'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>थोक मांग B2B (RFQs)</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin_management')}
              className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'admin_management'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-[#6f5f58] hover:text-[#1b4332] border border-[#e6ded3]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              <span>उपयोगकर्ता व प्रशासक (Users)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('audit_logs')}
            className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'audit_logs'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#6f5f58] hover:text-[#1b4332] border border-[#e6ded3]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>ऑडिट ट्रेल (Audit Trail)</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: PLATFORM OVERVIEW */}
        {/* ================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Security Alerts Banner */}
            {overview?.security_warnings && overview.security_warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>सक्रिय सुरक्षा एवं संचालन चेतावनियाँ (Active Alerts)</span>
                </div>
                <div className="space-y-1">
                  {overview.security_warnings.map((warn, i) => (
                    <div key={i} className="text-xs text-amber-800 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Health & Switch Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-[#e6ded3] shadow-xs space-y-4">
                <h3 className="font-sans text-base font-bold text-[#231f1e] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1b4332]" />
                  <span>राष्ट्रीय प्लेटफ़ॉर्म स्वास्थ्य स्थिति (System Status)</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-700">प्लेटफ़ॉर्म स्थिति (Platform Mode)</span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      switches.maintenance_mode ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {switches.maintenance_mode ? 'रखरखाव (Maintenance Mode)' : 'सक्रिय (Live Operational)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-700">UIDAI आधार वॉल्ट सुरक्षा</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      HMAC-SHA256 सुरक्षित
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-700">DPDP Act 2023 सहमति तंत्र</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      सक्रिय (Sovereign Audited)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-700">निलंबित खाते (Suspended Accounts)</span>
                    <span className="text-xs font-bold text-neutral-800 bg-neutral-100 px-2.5 py-1 rounded-full">
                      {overview?.suspended_accounts ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-[#e6ded3] shadow-xs space-y-4">
                <h3 className="font-sans text-base font-bold text-[#231f1e] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span>सक्रिय आपातकालीन स्विच (Switches Overview)</span>
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`p-3 rounded-xl border ${switches.marketplace_enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="font-bold">मार्केटप्लेस</div>
                    <div>{switches.marketplace_enabled ? 'सक्रिय (ON)' : 'बंद (OFF)'}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${switches.product_publishing_enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="font-bold">उत्पाद प्रकाशन</div>
                    <div>{switches.product_publishing_enabled ? 'सक्रिय (ON)' : 'बंद (OFF)'}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${switches.artisan_onboarding_enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="font-bold">कारीगर ऑनबोर्डिंग</div>
                    <div>{switches.artisan_onboarding_enabled ? 'सक्रिय (ON)' : 'बंद (OFF)'}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${switches.b2b_enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="font-bold">थोक मांग (B2B)</div>
                    <div>{switches.b2b_enabled ? 'सक्रिय (ON)' : 'बंद (OFF)'}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${switches.orders_enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="font-bold">ऑर्डर खरीद</div>
                    <div>{switches.orders_enabled ? 'सक्रिय (ON)' : 'बंद (OFF)'}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${switches.voice_catalog_enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="font-bold">ध्वनि कैटलॉग (Voice)</div>
                    <div>{switches.voice_catalog_enabled ? 'सक्रिय (ON)' : 'बंद (OFF)'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: PLATFORM CONTROLS (SWITCHES) */}
        {/* ================================================================= */}
        {activeTab === 'switches' && isSuperAdmin && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-[#e6ded3] shadow-xs space-y-4">
              <div>
                <h3 className="font-sans text-lg font-bold text-[#231f1e]">
                  प्लेटफ़ॉर्म आपातकालीन एवं संचालन स्विच (Persistent Emergency Switches)
                </h3>
                <p className="text-xs text-[#6f5f58] mt-1">
                  ये स्विच सीधे डेटाबेस में सुरक्षित होते हैं और पूरे प्लेटफ़ॉर्म पर तुरंत प्रभावी होते हैं। प्रत्येक परिवर्तन ऑडिट लॉग में रिकॉर्ड होता है।
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {[
                  {
                    key: 'maintenance_mode' as const,
                    title: 'आपातकालीन रखरखाव मोड (Maintenance Mode)',
                    desc: 'सक्रिय होने पर गैर-प्रशासकीय सभी यूज़र को HTTP 503 रखरखाव संदेश दिखता है।',
                    color: 'red',
                  },
                  {
                    key: 'marketplace_enabled' as const,
                    title: 'सार्वजनिक बाज़ार (Marketplace Active)',
                    desc: 'मार्केटप्लेस ब्राउजिंग, कार्ट और चेकआउट को नियंत्रित करता है।',
                    color: 'emerald',
                  },
                  {
                    key: 'product_publishing_enabled' as const,
                    title: 'नया उत्पाद प्रकाशन (Product Publishing)',
                    desc: 'कारीगरों द्वारा नए उत्पादों को अपलोड व प्रकाशित करने की अनुमति देता है।',
                    color: 'emerald',
                  },
                  {
                    key: 'artisan_onboarding_enabled' as const,
                    title: 'कारीगर ऑनबोर्डिंग (Artisan Onboarding)',
                    desc: 'नए कारीगर अपग्रेड आवेदनों की सबमिशन को चालू या बंद करता है।',
                    color: 'emerald',
                  },
                  {
                    key: 'b2b_enabled' as const,
                    title: 'थोक खरीद व मिलान (B2B Procurement)',
                    desc: 'संस्थागत खरीदारों के लिए RFQ सबमिशन व AI मैचमेकिंग को नियंत्रित करता है।',
                    color: 'emerald',
                  },
                  {
                    key: 'orders_enabled' as const,
                    title: 'ऑर्डर व भुगतान (Orders & Checkout)',
                    desc: 'ग्राहकों द्वारा नए आर्डरों की खरीद को चालू या बंद करता है।',
                    color: 'emerald',
                  },
                  {
                    key: 'ai_catalog_enabled' as const,
                    title: 'AI मल्टीमॉडल विश्लेषण (Gemma 4 31B)',
                    desc: 'शिल्प फोटो से स्वतः विवरण तैयार करने की सुविधा को नियंत्रित करता है।',
                    color: 'blue',
                  },
                  {
                    key: 'voice_catalog_enabled' as const,
                    title: 'भारतीय भाषा ध्वनि कैटलॉग (Sarvam ASR)',
                    desc: 'क्षेत्रीय आवाज रिकॉर्डिंग से कैटलॉग बनाने की सुविधा को नियंत्रित करता है।',
                    color: 'blue',
                  },
                ].map((item) => {
                  const isEnabled = switches[item.key] as boolean;
                  return (
                    <div
                      key={item.key}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                        isEnabled
                          ? 'bg-neutral-50/80 border-neutral-300'
                          : 'bg-red-50/50 border-red-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#231f1e]">{item.title}</span>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isEnabled
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {isEnabled ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6f5f58] leading-relaxed">{item.desc}</p>
                      </div>

                      <button
                        onClick={() => handleToggleSwitch(item.key, isEnabled)}
                        disabled={isActionPending}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                          isEnabled
                            ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-300'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{isEnabled ? 'स्विच बंद करें (Turn OFF)' : 'स्विच चालू करें (Turn ON)'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Maintenance Message Editor */}
            <div className="bg-white p-6 rounded-3xl border border-[#e6ded3] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-sans text-sm font-bold text-[#231f1e]">
                    सार्वजनिक रखरखाव संदेश (Custom Maintenance Notice)
                  </h4>
                  <p className="text-xs text-[#6f5f58]">
                    जब आपातकालीन रखरखाव मोड सक्रिय हो, तब यूज़र्स को यह संदेश प्रदर्शित किया जाता है।
                  </p>
                </div>
                {!editingMaintMsg && (
                  <button
                    onClick={() => setEditingMaintMsg(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-300 hover:bg-amber-100 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>संपादित करें</span>
                  </button>
                )}
              </div>

              {editingMaintMsg ? (
                <div className="space-y-3">
                  <textarea
                    value={maintMsgDraft}
                    onChange={(e) => setMaintMsgDraft(e.target.value)}
                    rows={3}
                    className="w-full text-xs p-3 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveMaintenanceMessage}
                      disabled={isActionPending}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                    >
                      सुरक्षित करें (Save)
                    </button>
                    <button
                      onClick={() => {
                        setMaintMsgDraft(switches.maintenance_message);
                        setEditingMaintMsg(false);
                      }}
                      className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      रद्द करें
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-800 font-medium">
                  {switches.maintenance_message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: ARTISAN APPLICATIONS */}
        {/* ================================================================= */}
        {activeTab === 'applications' && (
          <div className="bg-white rounded-3xl border border-[#e6ded3] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#e6ded3] flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-sans text-lg font-bold text-[#231f1e]">
                  कारीगर उन्नयन आवेदन (Artisan Upgrade Applications)
                </h3>
                <p className="text-xs text-[#6f5f58] mt-0.5">
                  कारीगर आवेदनों का परीक्षण करें। केवल सुपर एडमिन अनुमोदन से ही कारीगर खाता सक्रिय होता है।
                </p>
              </div>
            </div>

            {applications.length === 0 ? (
              <div className="p-12 text-center text-[#6f5f58] space-y-2">
                <Users className="w-10 h-10 text-neutral-300 mx-auto" />
                <p className="text-xs">कोई कारीगर आवेदन उपलब्ध नहीं है।</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf7f2] border-b border-[#e6ded3] text-[#6f5f58] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4">आईडी / नाम</th>
                      <th className="p-4">शिल्प प्रकार</th>
                      <th className="p-4">स्थान / राज्य</th>
                      <th className="p-4">अनुभव</th>
                      <th className="p-4">स्थिति</th>
                      <th className="p-4">जमा करने की तिथि</th>
                      <th className="p-4 text-right">कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6ded3]">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-neutral-50/50">
                        <td className="p-4">
                          <div className="font-bold text-[#231f1e]">{app.full_name || 'शिल्पकार'}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">{app.id}</div>
                        </td>
                        <td className="p-4 font-semibold text-neutral-800">{app.craft_category}</td>
                        <td className="p-4 text-neutral-600">
                          {app.district ? `${app.district}, ` : ''}
                          {app.state || 'India'}
                        </td>
                        <td className="p-4 text-neutral-600">{app.experience_years} वर्ष</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              app.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : app.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {app.status === 'approved' ? 'स्वीकृत' : app.status === 'rejected' ? 'अस्वीकृत' : 'प्रतीक्षारत'}
                          </span>
                        </td>
                        <td className="p-4 text-neutral-500">
                          {app.submitted_at || app.created_at
                            ? new Date(app.submitted_at || app.created_at || '').toLocaleDateString('en-IN')
                            : 'हाल ही में'}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          {app.status === 'pending' && isSuperAdmin ? (
                            <>
                              <button
                                onClick={() => handleApproveApp(app.id)}
                                disabled={isActionPending}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                              >
                                स्वीकृत करें
                              </button>
                              <button
                                onClick={() => handleRejectApp(app.id)}
                                disabled={isActionPending}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                              >
                                अस्वीकृत करें
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-neutral-400 font-mono">
                              {app.status === 'approved' ? 'सक्रिय खाता' : app.rejection_reason || 'पूर्ण'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: ARTISANS & GI CERTIFICATION */}
        {/* ================================================================= */}
        {activeTab === 'artisans' && (
          <div className="bg-white rounded-3xl border border-[#e6ded3] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#e6ded3] flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-sans text-lg font-bold text-[#231f1e]">
                  पंजीकृत शिल्पकार एवं भौगोलिक संकेत (GI) शासन
                </h3>
                <p className="text-xs text-[#6f5f58] mt-0.5">
                  सुपर एडमिन प्राधिकार द्वारा कारीगरों को GI मान्यता प्रदान करें या खाते को निलंबित/पुनः सक्रिय करें।
                </p>
              </div>
            </div>

            {artisans.length === 0 ? (
              <div className="p-12 text-center text-[#6f5f58] space-y-2">
                <Award className="w-10 h-10 text-neutral-300 mx-auto" />
                <p className="text-xs">कोई पंजीकृत कारीगर उपलब्ध नहीं है।</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf7f2] border-b border-[#e6ded3] text-[#6f5f58] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4">कारीगर नाम</th>
                      <th className="p-4">शिल्प प्रकार</th>
                      <th className="p-4">क्लस्टर / स्थान</th>
                      <th className="p-4">उत्पाद</th>
                      <th className="p-4">GI प्रमाणन</th>
                      <th className="p-4">खाता स्थिति</th>
                      <th className="p-4 text-right">सुपर एडमिन नियंत्रण</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6ded3]">
                    {artisans.map((art) => (
                      <tr key={art.id} className="hover:bg-neutral-50/50">
                        <td className="p-4">
                          <div className="font-bold text-[#231f1e]">{art.full_name}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">{art.phone_number}</div>
                        </td>
                        <td className="p-4 font-semibold text-neutral-800">{art.primary_craft}</td>
                        <td className="p-4 text-neutral-600">
                          <div>{art.cluster_name || 'Craft Cluster'}</div>
                          <div className="text-[10px] text-neutral-500">{art.state}</div>
                        </td>
                        <td className="p-4 font-bold text-[#1b4332]">{art.products_count} उत्पाद</td>
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleArtisanGI(art.id, art.gi_verified)}
                            disabled={!isSuperAdmin || isActionPending}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 ${
                              art.gi_verified
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                                : 'bg-neutral-100 text-neutral-600 border border-neutral-300 hover:bg-neutral-200'
                            }`}
                            title={isSuperAdmin ? 'GI स्थिति बदलने के लिए क्लिक करें' : 'केवल सुपर एडमिन'}
                          >
                            <Award className="w-3 h-3" />
                            <span>{art.gi_verified ? 'GI सत्यापित (Certified)' : 'गैर-सत्यापित (Unverified)'}</span>
                          </button>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              art.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {art.is_active ? 'सक्रिय (Active)' : 'निलंबित (Suspended)'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          {isSuperAdmin && (
                            art.is_active ? (
                              <button
                                onClick={() => handleSuspendArtisan(art.id)}
                                disabled={isActionPending}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 transition-colors cursor-pointer"
                              >
                                निलंबित करें
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivateArtisan(art.id)}
                                disabled={isActionPending}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                              >
                                पुनः सक्रिय करें
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: PRODUCTS MODERATION */}
        {/* ================================================================= */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-3xl border border-[#e6ded3] shadow-xs overflow-hidden space-y-4">
            <div className="p-6 border-b border-[#e6ded3] flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-sans text-lg font-bold text-[#231f1e]">
                  उत्पाद कैटलॉग मॉडरेशन (Live Product Moderation)
                </h3>
                <p className="text-xs text-[#6f5f58] mt-0.5">
                  मार्केटप्लेस उत्पादों की जांच करें। सर्वर-साइड प्रकाशन, निष्कासन व पुनर्स्थापना क्रियान्वित करें।
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="उत्पाद या शिल्प खोजें..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-[#e6ded3] focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
                />
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center text-[#6f5f58] space-y-2">
                <Package className="w-10 h-10 text-neutral-300 mx-auto" />
                <p className="text-xs">कोई उत्पाद नहीं मिला।</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf7f2] border-b border-[#e6ded3] text-[#6f5f58] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4">उत्पाद विवरण</th>
                      <th className="p-4">शिल्प प्रकार</th>
                      <th className="p-4">कारीगर</th>
                      <th className="p-4">मूल्य / न्यूनतम</th>
                      <th className="p-4">स्टॉक</th>
                      <th className="p-4">स्थिति</th>
                      <th className="p-4 text-right">मॉडरेशन कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6ded3]">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50/50">
                        <td className="p-4">
                          <div className="font-bold text-[#231f1e]">{p.title}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">{p.id}</div>
                        </td>
                        <td className="p-4 font-semibold text-neutral-800">{p.craft_type}</td>
                        <td className="p-4 text-neutral-600">{p.artisan_name || p.artisan_id}</td>
                        <td className="p-4">
                          <div className="font-bold text-[#1b4332]">₹{p.listing_price}</div>
                          <div className="text-[10px] text-neutral-500">न्यूनतम: ₹{p.floor_price}</div>
                        </td>
                        <td className="p-4 text-neutral-700">{p.stock_quantity} नग</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {p.is_active ? 'सक्रिय (Live)' : 'हटाया गया (Inactive)'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-1.5">
                          {p.is_active ? (
                            <>
                              <button
                                onClick={() => handleModerateProduct(p.id, 'unpublish')}
                                disabled={isActionPending}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-300 cursor-pointer"
                              >
                                अप्रकाशित करें
                              </button>
                              <button
                                onClick={() => handleModerateProduct(p.id, 'remove')}
                                disabled={isActionPending}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-lg border border-red-300 cursor-pointer"
                              >
                                निष्कासित करें
                              </button>
                            </>
                          ) : (
                            isSuperAdmin && (
                              <button
                                onClick={() => handleRestoreProduct(p.id)}
                                disabled={isActionPending}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                              >
                                सर्वर पुनर्स्थापना (Restore)
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: CLUSTERS & WAGE GOVERNANCE */}
        {/* ================================================================= */}
        {activeTab === 'clusters' && (
          <div className="bg-white rounded-3xl border border-[#e6ded3] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#e6ded3] flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-sans text-lg font-bold text-[#231f1e]">
                  शिल्प क्लस्टर एवं वैधानिक न्यूनतम मजदूरी शासन
                </h3>
                <p className="text-xs text-[#6f5f58] mt-0.5">
                  MoSJE कुशल कारीगर न्यूनतम दैनिक मजदूरी दर। इसके आधार पर निष्पक्ष मूल्य सीमा निर्धारित होती है।
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#faf7f2] border-b border-[#e6ded3] text-[#6f5f58] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-4">क्लस्टर नाम</th>
                    <th className="p-4">शिल्प प्रकार</th>
                    <th className="p-4">राज्य / जिला</th>
                    <th className="p-4">GI पंजीकरण स्थिति</th>
                    <th className="p-4">वैधानिक दैनिक मजदूरी</th>
                    <th className="p-4">प्रति घंटा दर</th>
                    <th className="p-4 text-right">मजदूरी अद्यतन</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ded3]">
                  {clusters.map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-50/50">
                      <td className="p-4 font-bold text-[#231f1e]">{c.name}</td>
                      <td className="p-4 font-semibold text-neutral-800">{c.craft_name}</td>
                      <td className="p-4 text-neutral-600">
                        {c.district}, {c.state}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                          {c.gi_tag_status || 'Registered GI'}
                        </span>
                      </td>
                      <td className="p-4">
                        {editingWageClusterId === c.id ? (
                          <input
                            type="number"
                            value={tempDailyWage}
                            onChange={(e) => {
                              const d = Number(e.target.value);
                              setTempDailyWage(d);
                              setTempHourlyWage(Math.round((d / 8) * 100) / 100);
                            }}
                            className="w-24 px-2 py-1 border border-amber-500 rounded-lg text-xs font-bold"
                          />
                        ) : (
                          <span className="font-black text-[#1b4332] text-sm">₹{c.statutory_daily_wage}/दिन</span>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-neutral-600">
                        ₹{c.statutory_hourly_wage}/घंटा
                      </td>
                      <td className="p-4 text-right">
                        {isSuperAdmin && (
                          editingWageClusterId === c.id ? (
                            <div className="space-x-1">
                              <button
                                onClick={() => handleSaveWage(c.id)}
                                disabled={isActionPending}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                              >
                                सेव
                              </button>
                              <button
                                onClick={() => setEditingWageClusterId(null)}
                                className="px-2 py-1 bg-neutral-200 text-neutral-700 font-bold text-xs rounded-lg cursor-pointer"
                              >
                                रद्द
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingWageClusterId(c.id);
                                setTempDailyWage(c.statutory_daily_wage);
                                setTempHourlyWage(c.statutory_hourly_wage);
                              }}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 cursor-pointer"
                            >
                              दर बदलें
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: ORDERS & COMMERCE OVERSIGHT */}
        {/* ================================================================= */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-[#e6ded3] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#e6ded3]">
              <h3 className="font-sans text-lg font-bold text-[#231f1e]">
                ऑर्डर व वाणिज्य निगरानी (Platform Orders Oversight)
              </h3>
              <p className="text-xs text-[#6f5f58] mt-0.5">
                प्लेटफ़ॉर्म पर संपन्न सभी लेन-देन, ग्राहक भुगतान व कारीगर डिलीवरी स्थिति का पर्यवेक्षण।
              </p>
            </div>

            {orders.length === 0 ? (
              <div className="p-12 text-center text-[#6f5f58] space-y-2">
                <ShoppingCart className="w-10 h-10 text-neutral-300 mx-auto" />
                <p className="text-xs">कोई ऑर्डर दर्ज नहीं है।</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf7f2] border-b border-[#e6ded3] text-[#6f5f58] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4">ऑर्डर संख्या</th>
                      <th className="p-4">उत्पाद</th>
                      <th className="p-4">मात्रा</th>
                      <th className="p-4">कुल राशि</th>
                      <th className="p-4">भुगतान स्थिति</th>
                      <th className="p-4">ऑर्डर स्थिति</th>
                      <th className="p-4">दिनांक</th>
                      <th className="p-4 text-right">सुपर एडमिन ओवरराइड</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6ded3]">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-neutral-50/50">
                        <td className="p-4 font-mono font-bold text-[#231f1e]">{o.order_number}</td>
                        <td className="p-4 font-semibold text-neutral-800">{o.product_title}</td>
                        <td className="p-4">{o.quantity} नग</td>
                        <td className="p-4 font-bold text-[#1b4332]">₹{o.total_price}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              o.payment_status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {o.payment_status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-800 uppercase">
                            {o.status}
                          </span>
                        </td>
                        <td className="p-4 text-neutral-500">
                          {o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : 'N/A'}
                        </td>
                        <td className="p-4 text-right space-x-1.5">
                          {isSuperAdmin && (
                            <select
                              value={o.status}
                              onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                              className="text-[11px] font-semibold p-1 border border-neutral-300 rounded-lg bg-white"
                            >
                              <option value="pending">pending</option>
                              <option value="paid">paid</option>
                              <option value="confirmed">confirmed</option>
                              <option value="processing">processing</option>
                              <option value="shipped">shipped</option>
                              <option value="delivered">delivered</option>
                              <option value="cancelled">cancelled</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 8: B2B RFQS */}
        {/* ================================================================= */}
        {activeTab === 'b2b' && (
          <div className="bg-white rounded-3xl border border-[#e6ded3] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#e6ded3]">
              <h3 className="font-sans text-lg font-bold text-[#231f1e]">
                थोक मांग एवं संस्थागत खरीद (B2B Bulk Procurement Governance)
              </h3>
              <p className="text-xs text-[#6f5f58] mt-0.5">
                कॉर्पोरेट व सरकारी खरीदारों की थोक मांगें और AI मिलान परिणाम।
              </p>
            </div>

            {b2bRFQs.length === 0 ? (
              <div className="p-12 text-center text-[#6f5f58] space-y-2">
                <Briefcase className="w-10 h-10 text-neutral-300 mx-auto" />
                <p className="text-xs">कोई B2B मांग उपलब्ध नहीं है।</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf7f2] border-b border-[#e6ded3] text-[#6f5f58] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4">खरीदार / संस्था</th>
                      <th className="p-4">शिल्प प्रकार</th>
                      <th className="p-4">मात्रा</th>
                      <th className="p-4">बजट (प्रति इकाई)</th>
                      <th className="p-4">कुल बजट</th>
                      <th className="p-4">स्थिति</th>
                      <th className="p-4 text-right">सुपर एडमिन स्थिति अद्यतन</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6ded3]">
                    {b2bRFQs.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-50/50">
                        <td className="p-4">
                          <div className="font-bold text-[#231f1e]">{r.buyer_name}</div>
                          <div className="text-[10px] text-neutral-500">{r.buyer_organization || r.buyer_email}</div>
                        </td>
                        <td className="p-4 font-semibold text-neutral-800">{r.craft_type}</td>
                        <td className="p-4">{r.required_quantity} इकाइयाँ</td>
                        <td className="p-4 font-bold text-[#1b4332]">₹{r.unit_budget}</td>
                        <td className="p-4 font-black text-[#231f1e]">₹{r.total_budget?.toLocaleString('en-IN')}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.status === 'MATCHED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'FULFILLED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {isSuperAdmin && (
                            <select
                              value={r.status}
                              onChange={(e) => handleUpdateB2BStatus(r.id, e.target.value)}
                              className="text-[11px] font-semibold p-1 border border-neutral-300 rounded-lg bg-white"
                            >
                              <option value="OPEN">OPEN</option>
                              <option value="MATCHED">MATCHED</option>
                              <option value="REVIEW">REVIEW</option>
                              <option value="FULFILLED">FULFILLED</option>
                              <option value="CLOSED">CLOSED</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 9: USERS & ADMINISTRATOR MANAGEMENT */}
        {/* ================================================================= */}
        {activeTab === 'admin_management' && isSuperAdmin && (
          <div className="space-y-6">
            {/* Platform Users Table */}
            <div className="bg-white rounded-3xl border border-[#e6ded3] shadow-xs overflow-hidden">
              <div className="p-6 border-b border-[#e6ded3] flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h3 className="font-sans text-lg font-bold text-[#231f1e]">
                    प्लेटफ़ॉर्म उपयोगकर्ता एवं खाता नियंत्रण (User Accounts Governance)
                  </h3>
                  <p className="text-xs text-[#6f5f58] mt-0.5">
                    ग्राहकों, कारीगरों व प्रशासकों के खातों को देखें, निलंबित करें या पुनः सक्रिय करें।
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf7f2] border-b border-[#e6ded3] text-[#6f5f58] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4">आईडी / ईमेल</th>
                      <th className="p-4">पद (Role)</th>
                      <th className="p-4">खाता स्थिति</th>
                      <th className="p-4">पंजीकरण तिथि</th>
                      <th className="p-4 text-right">निलंबन नियंत्रण</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6ded3]">
                    {platformUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-50/50">
                        <td className="p-4">
                          <div className="font-bold text-[#231f1e]">{u.email || 'Anonymous Member'}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">{u.id}</div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              u.role === 'super_admin'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : u.role === 'admin'
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : u.role === 'artisan'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-neutral-100 text-neutral-800'
                            }`}
                          >
                            {u.role === 'super_admin' ? '👑 सुपर एडमिन' : u.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.is_suspended ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {u.is_suspended ? 'निलंबित (Suspended)' : 'सक्रिय (Active)'}
                          </span>
                        </td>
                        <td className="p-4 text-neutral-500">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : 'N/A'}
                        </td>
                        <td className="p-4 text-right">
                          {u.role !== 'super_admin' && (
                            u.is_suspended ? (
                              <button
                                onClick={() => handleReactivateUser(u.id)}
                                disabled={isActionPending}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-300 cursor-pointer"
                              >
                                पुनः सक्रिय करें
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSuspendUser(u.id)}
                                disabled={isActionPending}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-300 cursor-pointer"
                              >
                                निलंबित करें
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Admin Role Appointment Card */}
            <div className="bg-white p-6 rounded-3xl border border-[#e6ded3] shadow-xs space-y-4">
              <div>
                <h4 className="font-sans text-sm font-bold text-[#231f1e]">
                  प्रशासक पद नियुक्ति (Appoint Administrator)
                </h4>
                <p className="text-xs text-[#6f5f58]">
                  किसी पंजीकृत यूज़र आईडी को 'admin' पद प्रदान करें।
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="यूज़र आईडी दर्ज करें (User ID)..."
                  value={newAdminUserId}
                  onChange={(e) => setNewAdminUserId(e.target.value)}
                  className="flex-1 text-xs p-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={() => handleGrantAdmin(newAdminUserId)}
                  disabled={!newAdminUserId.trim() || isActionPending}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  प्रशासक बनाएं
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 10: AUDIT TRAIL */}
        {/* ================================================================= */}
        {activeTab === 'audit_logs' && (
          <div className="bg-white rounded-3xl border border-[#e6ded3] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#e6ded3]">
              <h3 className="font-sans text-lg font-bold text-[#231f1e]">
                अपरिवर्तनीय ऑडिट ट्रेल (Immutable Administrative Audit Trail)
              </h3>
              <p className="text-xs text-[#6f5f58] mt-0.5">
                प्रशासकीय निर्णयों, भूमिका परिवर्तनों, GI सत्यापन और आपातकालीन स्विचों का आधिकारिक रिकॉर्ड।
              </p>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-12 text-center text-[#6f5f58] space-y-2">
                <History className="w-10 h-10 text-neutral-300 mx-auto" />
                <p className="text-xs">कोई ऑडिट लॉग उपलब्ध नहीं है।</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf7f2] border-b border-[#e6ded3] text-[#6f5f58] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4">कार्रवाई (Action)</th>
                      <th className="p-4">कर्ता (Actor)</th>
                      <th className="p-4">लक्षित यूज़र</th>
                      <th className="p-4">विवरण</th>
                      <th className="p-4">समय (UTC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6ded3]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50/50">
                        <td className="p-4">
                          <span className="font-mono font-bold text-[#1b4332] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-neutral-800">{log.actor_email || log.actor_id}</div>
                        </td>
                        <td className="p-4 text-neutral-600 font-mono text-[11px]">
                          {log.target_user_id || '—'}
                        </td>
                        <td className="p-4 text-neutral-700 max-w-xs truncate" title={log.details || ''}>
                          {log.details || '—'}
                        </td>
                        <td className="p-4 text-neutral-500 font-mono text-[11px]">
                          {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
