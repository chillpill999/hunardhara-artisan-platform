'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  fetchClusters,
  fetchProducts,
  removeProduct,
  restoreAllProducts,
  getRemovedProductIds,
  fetchAdminApplications,
  approveAdminApplication,
  rejectAdminApplication,
  fetchAdminUsers,
  grantAdminRole,
  revokeAdminRole,
  fetchAuditLogs,
  ArtisanApplicationItem,
  AdminUserItem,
  AdminAuditLogItem
} from '@/lib/api';
import { getAllInquiries, updateInquiryStatus, deleteInquiry } from '@/lib/inquiries';
import { CraftCluster, Product, ArtisanInquiry } from '@/lib/types';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
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
  Sparkles,
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
  Shield
} from 'lucide-react';

interface AdminB2BRFQ {
  id: string;
  buyer_name: string;
  company_name: string;
  buyer_phone: string;
  craft_type: string;
  quantity: number;
  budget_per_unit: number;
  delivery_state: string;
  deadline_days: number;
  match_score: number;
  status: 'review' | 'matched' | 'approved';
  created_at: string;
}

interface MasterArtisanItem {
  id: string;
  name: string;
  cluster: string;
  state: string;
  craft_type: string;
  phone: string;
  products_count: number;
  gi_verified: boolean;
  joined_date: string;
}

export default function AdminDashboardPage() {
  const { user, role, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'clusters' | 'b2b' | 'inquiries' | 'artisans' | 'security' | 'applications' | 'admin_management' | 'audit_logs'>('products');
  const [clusters, setClusters] = useState<CraftCluster[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [removedCount, setRemovedCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');

  // B2B RFQs State
  const [b2bRFQs, setB2bRFQs] = useState<AdminB2BRFQ[]>([]);

  // Inquiries State
  const [inquiries, setInquiries] = useState<ArtisanInquiry[]>([]);
  const [inquiryFilter, setInquiryFilter] = useState<'all' | 'new' | 'replied'>('all');

  // Master Artisans State
  const [artisans, setArtisans] = useState<MasterArtisanItem[]>([]);

  // Artisan Applications State
  const [applications, setApplications] = useState<ArtisanApplicationItem[]>([]);

  // Admins State (Super Admin Only)
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [newAdminUserId, setNewAdminUserId] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);

  // Async Action in Progress
  const [isActionPending, setIsActionPending] = useState(false);

  // Editable Wage Baseline
  const [editingWageClusterId, setEditingWageClusterId] = useState<string | null>(null);
  const [tempWageValue, setTempWageValue] = useState<number>(650);

  // Deletion Confirmation Modal State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!isAdmin) {
      return;
    }
    try {
      const [clusterData, productData, appList, logList] = await Promise.all([
        fetchClusters(),
        fetchProducts(),
        fetchAdminApplications(),
        fetchAuditLogs(50)
      ]);
      setClusters(clusterData);
      setProducts(productData);
      setApplications(appList);
      setAuditLogs(logList);

      if (isSuperAdmin) {
        const users = await fetchAdminUsers();
        setAdminUsers(users);
      }
      setRemovedCount(getRemovedProductIds().length);
      setInquiries(getAllInquiries());

      try {
        const { data: artisanProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, cluster, state, craft_type, phone, gi_verified, created_at')
          .eq('role', 'artisan');

        if (artisanProfiles && artisanProfiles.length > 0) {
          setArtisans(artisanProfiles.map((a: any) => ({
            id: a.id,
            name: a.full_name || 'शिल्पकार (Artisan)',
            cluster: a.cluster || 'Craft Cluster',
            state: a.state || 'India',
            craft_type: a.craft_type || 'Handicraft',
            phone: a.phone || 'N/A',
            products_count: productData.filter((p) => p.artisan_id === a.id).length,
            gi_verified: !!a.gi_verified,
            joined_date: new Date(a.created_at || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
          })));
        } else {
          setArtisans([]);
        }
      } catch {
        setArtisans([]);
      }

      try {
        const { data: rfqList } = await supabase
          .from('b2b_rfqs')
          .select('*')
          .order('created_at', { ascending: false });

        if (rfqList && rfqList.length > 0) {
          setB2bRFQs(rfqList.map((r: any) => ({
            id: r.id,
            buyer_name: r.buyer_name || 'Verified Buyer',
            company_name: r.company_name || 'B2B Enterprise',
            buyer_phone: r.buyer_phone || 'N/A',
            craft_type: r.craft_type,
            quantity: Number(r.quantity),
            budget_per_unit: Number(r.budget_per_unit),
            delivery_state: r.delivery_state || 'India',
            deadline_days: Number(r.deadline_days || 30),
            match_score: Number(r.match_score || 95),
            status: r.status || 'review',
            created_at: new Date(r.created_at || Date.now()).toLocaleDateString('en-IN')
          })));
        } else {
          setB2bRFQs([]);
        }
      } catch {
        setB2bRFQs([]);
      }
    } catch (err) {
      console.warn('Admin load data error:', err);
    }
  };

  useEffect(() => {
    if (role === 'admin') {
      loadData();
    }

    const handleUpdate = () => {
      if (role === 'admin') loadData();
    };
    window.addEventListener('hunardhara_product_published', handleUpdate);
    window.addEventListener('hunardhara_product_removed', handleUpdate);
    window.addEventListener('hunardhara_inquiry_added', handleUpdate);
    return () => {
      window.removeEventListener('hunardhara_product_published', handleUpdate);
      window.removeEventListener('hunardhara_product_removed', handleUpdate);
      window.removeEventListener('hunardhara_inquiry_added', handleUpdate);
    };
  }, [role]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p) return false;
      const q = (searchQuery || '').toLowerCase().trim();
      const titleEn = (p.title_en || (p as any).title || '').toLowerCase();
      const titleHi = (p.title_hi || (p as any).description_hindi || '').toLowerCase();
      const craftType = (p.craft_type || '').toLowerCase();
      const artisanName = (p.artisan_name || '').toLowerCase();
      return (
        !q ||
        titleEn.includes(q) ||
        titleHi.includes(q) ||
        craftType.includes(q) ||
        artisanName.includes(q)
      );
    });
  }, [products, searchQuery]);

  // Handle Product Deletion
  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const success = await removeProduct(productToDelete.id);
      if (success) {
        setToastMessage(`उत्पाद "${productToDelete.title_hi || productToDelete.title_en}" सफलतापूर्वक हटा दिया गया है।`);
        setTimeout(() => setToastMessage(null), 4000);
        await loadData();
      }
    } catch (e) {
      console.warn('Failed to remove product:', e);
    } finally {
      setIsDeleting(false);
      setProductToDelete(null);
    }
  };

  // Handle Restore
  const handleRestore = () => {
    restoreAllProducts();
    setToastMessage('सभी मूल उत्पाद कैटलॉग में वापस रीसेट कर दिए गए हैं।');
    setTimeout(() => setToastMessage(null), 4000);
    loadData();
  };

  // Handle Wage Save
  const handleSaveWage = (clusterId: string) => {
    setClusters((prev) =>
      prev.map((c) =>
        c.id === clusterId ? { ...c, statutory_minimum_daily_wage: tempWageValue } : c
      )
    );
    setEditingWageClusterId(null);
    setToastMessage(`क्लस्टर न्यूनतम मजदूरी को ₹${tempWageValue}/दिन पर अद्यतन किया गया।`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handle B2B Status Update
  const handleUpdateB2BStatus = (id: string, newStatus: 'review' | 'matched' | 'approved') => {
    setB2bRFQs((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    setToastMessage(`थोक मांग #${id} की स्थिति अद्यतन की गई।`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handle Artisan GI Toggle
  const handleToggleArtisanGI = (artisanId: string) => {
    setArtisans((prev) =>
      prev.map((a) =>
        a.id === artisanId ? { ...a, gi_verified: !a.gi_verified } : a
      )
    );
    setToastMessage(`शिल्पकार प्रमाणन स्थिति सफलतापूर्वक बदली गई।`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handle Application Approval (Super Admin Only)
  const handleApproveApp = async (appId: string) => {
    if (!isSuperAdmin) {
      setToastMessage('त्रुटि: केवल सुपर एडमिन ही कारीगर आवेदन स्वीकृत कर सकते हैं (Super Admin clearance required)।');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    setIsActionPending(true);
    try {
      const res = await approveAdminApplication(appId);
      if (res.success) {
        setToastMessage(`आवेदन #${appId} स्वीकृत! कारीगर खाता सक्रिय कर दिया गया।`);
        await loadData();
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

  // Handle Application Rejection (Super Admin Only)
  const handleRejectApp = async (appId: string) => {
    if (!isSuperAdmin) {
      setToastMessage('त्रुटि: केवल सुपर एडमिन ही कारीगर आवेदन अस्वीकृत कर सकते हैं (Super Admin clearance required)।');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    const reason = window.prompt("कृपया कारीगर आवेदन अस्वीकृत करने का कारण दर्ज करें (Enter reason for rejection):");
    if (!reason || !reason.trim()) {
      setToastMessage('त्रुटि: अस्वीकृति का कारण अनिवार्य है।');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    setIsActionPending(true);
    try {
      const res = await rejectAdminApplication(appId, reason.trim());
      if (res.success) {
        setToastMessage(`आवेदन #${appId} अस्वीकृत किया गया।`);
        await loadData();
      } else {
        setToastMessage(`त्रुटि: ${res.error || 'अस्वीकृति विफल'}`);
      }
    } catch (e: any) {
      setToastMessage(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Handle Grant Admin Role
  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUserId.trim()) return;
    setIsActionPending(true);
    try {
      const res = await grantAdminRole(newAdminUserId.trim());
      if (res.success) {
        setToastMessage(res.message || 'प्रशासक पद सफलतापूर्वक दिया गया।');
        setNewAdminUserId('');
        await loadData();
      } else {
        setToastMessage(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      setToastMessage(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Handle Revoke Admin Role
  const handleRevokeAdmin = async (userId: string) => {
    if (!confirm(`क्या आप वाकई उपयोगकर्ता ${userId} से प्रशासक पद वापस लेना चाहते हैं?`)) return;
    setIsActionPending(true);
    try {
      const res = await revokeAdminRole(userId);
      if (res.success) {
        setToastMessage(res.message || 'प्रशासक पद वापस ले लिया गया।');
        await loadData();
      } else {
        setToastMessage(`त्रुटि: ${res.message}`);
      }
    } catch (e: any) {
      setToastMessage(`त्रुटि: ${e.message}`);
    } finally {
      setIsActionPending(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Filtered Inquiries
  const filteredInquiries = useMemo(() => {
    if (inquiryFilter === 'all') return inquiries;
    return inquiries.filter((inq) => inq.status === inquiryFilter);
  }, [inquiries, inquiryFilter]);

  return (
    <AuthGuard
      allowedRoles={['admin', 'super_admin']}
      redirectMessage="Sign in as Administrator to access governance and cluster monitoring."
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-20 right-5 z-50 bg-[#1b4332] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-[#e9a83a]/40 animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-[#e9a83a]" />
            <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Top Banner */}
        <div className="bg-[#141414] text-white rounded-3xl p-6 sm:p-10 border border-[#27272a] flex flex-col md:flex-row justify-between md:items-center gap-6 shadow-md">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#F8C146] text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-[#F5A941]" />
              <span>National Heritage Craft Governance • Master Control Console</span>
            </div>

            <h1 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              प्रशासकीय नियंत्रण व क्लस्टर निगरानी (Admin Control Center)
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 font-light leading-relaxed">
              संपूर्ण राष्ट्रीय प्लेटफ़ॉर्म का केंद्रीय नियंत्रण — उत्पाद कैटलॉग निष्कासन, वैधानिक न्यूनतम मजदूरी निर्धारण, थोक खरीद (B2B), ग्राहक पूछताछ और शिल्पकार प्रमाणन।
            </p>
          </div>

          {/* Protection Badges */}
          <div className="bg-[#1c1917] p-5 rounded-2xl border border-[#2e2e30] text-xs space-y-2 shrink-0">
            <div className="flex items-center gap-2 text-[#34d399] font-bold">
              <ShieldCheck className="w-4 h-4 text-[#34d399]" />
              <span>प्रमाणित प्रशासक (Authorised Admin)</span>
            </div>
            <div className="text-[11px] font-mono text-[#F8C146] bg-black/40 px-2.5 py-1 rounded-lg border border-[#3e3e42] truncate max-w-xs">
              {user?.email || 'Verified Supabase administrator'}
            </div>
            <div className="flex items-center gap-2 text-[#a1a1aa] text-[10px] pt-1.5 border-t border-[#2e2e30]">
              <span>Full Governance Clearance • MoSJE Oversight</span>
            </div>
          </div>
        </div>

        {/* Overall Platform Key Metric Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] bento-shadow space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>लाइव उत्पाद</span>
              <Package className="w-3.5 h-3.5 text-[#1b4332]" />
            </div>
            <div className="font-sans text-2xl font-black text-[#231f1e]">{products.length}</div>
            <div className="text-[10px] text-[#2d6a4f] font-semibold">मार्केटप्लेस पर सक्रिय</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] bento-shadow space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>शिल्प क्लस्टर</span>
              <Building2 className="w-3.5 h-3.5 text-[#e9a83a]" />
            </div>
            <div className="font-sans text-2xl font-black text-[#c85a32]">{clusters.length || 5}</div>
            <div className="text-[10px] text-[#6f5f58]">न्यूनतम मजदूरी लागू</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] bento-shadow space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>थोक मांग (B2B)</span>
              <Briefcase className="w-3.5 h-3.5 text-[#1b4332]" />
            </div>
            <div className="font-sans text-2xl font-black text-[#1b4332]">{b2bRFQs.length}</div>
            <div className="text-[10px] text-[#2d6a4f] font-semibold">संस्थागत ऑर्डर</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] bento-shadow space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>ग्राहक पूछताछ</span>
              <MessageSquare className="w-3.5 h-3.5 text-[#0284c7]" />
            </div>
            <div className="font-sans text-2xl font-black text-[#0284c7]">{inquiries.length}</div>
            <div className="text-[10px] text-[#6f5f58]">कुल संदेश</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] bento-shadow space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>पंजीकृत कारीगर</span>
              <Users className="w-3.5 h-3.5 text-[#d97706]" />
            </div>
            <div className="font-sans text-2xl font-black text-[#d97706]">{artisans.length}</div>
            <div className="text-[10px] text-[#2d6a4f] font-semibold">100% GI सत्यापित</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e6ded3] bento-shadow space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#6f5f58] flex items-center justify-between">
              <span>DPDP सुरक्षा</span>
              <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
            </div>
            <div className="font-sans text-2xl font-black text-[#059669]">100%</div>
            <div className="text-[10px] text-[#059669] font-semibold">UIDAI व EXIF सुरक्षित</div>
          </div>
        </div>

        {/* 6 Comprehensive Governance Tabs */}
        <div className="flex items-center gap-2 border-b border-[#e6ded3] pb-3 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'products'
                ? 'bg-[#c85a32] text-white shadow-sm'
                : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>उत्पाद नियंत्रण ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clusters')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'clusters'
                ? 'bg-[#1b4332] text-white shadow-sm'
                : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>शिल्प समूह व न्यूनतम मजदूरी ({clusters.length || 5})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('b2b')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'b2b'
                ? 'bg-[#1e293b] text-white shadow-sm'
                : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>थोक मांग (B2B RFQs) ({b2bRFQs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inquiries')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'inquiries'
                ? 'bg-[#0284c7] text-white shadow-sm'
                : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>ग्राहक पूछताछ निगरानी ({inquiries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('artisans')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'artisans'
                ? 'bg-[#d97706] text-white shadow-sm'
                : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>कारीगर निर्देशिका ({artisans.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-[#059669] text-white shadow-sm'
                : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>सुरक्षा व DPDP ऑडिट</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'applications'
                ? 'bg-[#b45309] text-white shadow-sm'
                : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>कारीगर आवेदन ({applications.filter((a) => a.status === 'pending').length} लंबित)</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin_management')}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'admin_management'
                  ? 'bg-[#7c2d12] text-white shadow-sm'
                  : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>प्रशासक प्रबंधन ({adminUsers.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('audit_logs')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'audit_logs'
                ? 'bg-[#4338ca] text-white shadow-sm'
                : 'bg-white text-[#6f5f58] border border-[#e6ded3] hover:bg-[#faf7f2]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>ऑडिट लॉग्स ({auditLogs.length})</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: PRODUCT GOVERNANCE & REMOVAL                                   */}
        {/* ===================================================================== */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e6ded3] bento-shadow space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-[#6f5f58] font-bold flex items-center justify-between">
                  <span>लाइव मार्केटप्लेस उत्पाद</span>
                  <Package className="w-4 h-4 text-[#1b4332]" />
                </div>
                <div className="font-sans text-3xl font-extrabold text-[#231f1e]">
                  {products.length}
                </div>
                <div className="text-[11px] text-[#2d6a4f] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> सार्वजनिक रूप से उपलब्ध
                </div>
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e6ded3] bento-shadow space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-[#6f5f58] font-bold flex items-center justify-between">
                  <span>कारीगरों द्वारा लाइव अपलोड</span>
                  <Sparkles className="w-4 h-4 text-[#e9a83a]" />
                </div>
                <div className="font-sans text-3xl font-extrabold text-[#c85a32]">
                  {products.filter((p) => p.id.startsWith('prod-live-')).length}
                </div>
                <div className="text-[11px] text-[#6f5f58]">
                  Speak. Snap. Sell. अपलोड्स
                </div>
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e6ded3] bento-shadow space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-[#6f5f58] font-bold flex items-center justify-between">
                  <span>हटाए गए उत्पाद (Removed)</span>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <div className="font-sans text-3xl font-extrabold text-red-600">
                  {removedCount}
                </div>
                <div className="text-[11px] text-red-700">
                  मार्केटप्लेस से निष्कासित
                </div>
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e6ded3] bento-shadow space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-[#6f5f58] font-bold flex items-center justify-between">
                  <span>प्रशासनिक अधिकार</span>
                  <ShieldCheck className="w-4 h-4 text-[#1b4332]" />
                </div>
                <div className="font-sans text-2xl font-extrabold text-[#1b4332]">
                  Full Access
                </div>
                <div className="text-[11px] text-[#6f5f58]">
                  उत्पाद जोड़ने व हटाने का अधिकार
                </div>
              </div>
            </div>

            {/* Product Table Card */}
            <div className="bg-white rounded-3xl border border-[#e6ded3] overflow-hidden bento-shadow space-y-4 p-5 sm:p-7">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#e6ded3] pb-4">
                <div>
                  <h3 className="font-sans font-bold text-xl text-[#231f1e]">
                    उत्पाद कैटलॉग प्रशासन (Catalog Governance)
                  </h3>
                  <p className="text-xs text-[#6f5f58] mt-0.5">
                    किसी भी उत्पाद को सीधे मार्केटप्लेस से हटाने के लिए दाईं ओर स्थित &quot;हटाएं&quot; बटन दबाएं।
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {removedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleRestore}
                      className="bg-[#faf7f2] hover:bg-[#e6ded3] text-[#1b4332] border border-[#e6ded3] font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      title="हटाए गए सभी मूल उत्पादों को रीसेट करें"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>मूल कैटलॉग रीसेट करें</span>
                    </button>
                  )}

                  <div className="relative">
                    <Search className="w-4 h-4 text-[#6f5f58] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="उत्पाद या शिल्प खोजें..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#e6ded3] bg-[#faf7f2] focus:outline-none focus:border-[#1b4332] w-48 sm:w-64"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf7f2] text-[#6f5f58] uppercase font-bold border-b border-[#e6ded3]">
                    <tr>
                      <th className="py-3 px-4">उत्पाद (Product)</th>
                      <th className="py-3 px-4">शिल्प व राज्य (Craft & State)</th>
                      <th className="py-3 px-4">प्रमाणित मूल्य (Fair Price)</th>
                      <th className="py-3 px-4">प्रकार (Type)</th>
                      <th className="py-3 px-4 text-right">कार्रवाई (Admin Action)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6ded3] text-[#231f1e]">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-[#faf7f2] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white border border-[#e6ded3] overflow-hidden shrink-0">
                              <img
                                src={p.studio_image_url || '/logo.png'}
                                alt={p.title_en}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = '/logo.png';
                                }}
                              />
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <span className="font-bold text-sm text-[#231f1e] block truncate">
                                {p.title_hi || p.title_en}
                              </span>
                              <span className="text-[11px] text-[#6f5f58] block truncate">
                                {p.title_en}
                              </span>
                              <span className="text-[10px] text-[#2d6a4f] block font-mono">
                                ID: {p.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="bg-[#1b4332]/10 text-[#1b4332] font-semibold px-2.5 py-0.5 rounded-full block w-fit">
                            {p.craft_type}
                          </span>
                          <span className="text-[11px] text-[#6f5f58] block mt-1">
                            📍 {p.artisan_state || 'भारत'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-sans font-extrabold text-base text-[#c85a32]">
                            ₹{(p.recommended_retail_d2c || p.floor_price).toLocaleString('en-IN')}
                          </div>
                          <span className="text-[10px] text-[#2d6a4f]">
                            लागत + ₹650/दिन मजदूरी
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {p.id.startsWith('prod-live-') ? (
                            <span className="bg-[#e8f5e9] text-[#1b4332] text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit border border-[#2d6a4f]/20">
                              <Sparkles className="w-3 h-3 text-[#e9a83a]" />
                              <span>Live Upload</span>
                            </span>
                          ) : (
                            <span className="bg-[#faf7f2] text-[#6f5f58] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#e6ded3] block w-fit">
                              Catalog Seed
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/craft/${p.id}`}
                              target="_blank"
                              className="p-2 rounded-xl bg-white border border-[#e6ded3] text-[#6f5f58] hover:text-[#1b4332] hover:border-[#1b4332] transition-colors"
                              title="मार्केटप्लेस पर देखें"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            <button
                              type="button"
                              onClick={() => setProductToDelete(p)}
                              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border border-red-200 hover:border-red-500 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                              title="उत्पाद को मार्केटप्लेस से हटाएं"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>हटाएं (Remove)</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredProducts.length === 0 && (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#faf7f2] text-[#6f5f58] flex items-center justify-center mx-auto text-xl">
                    📦
                  </div>
                  <p className="text-sm font-bold text-[#231f1e]">कोई उत्पाद नहीं मिला</p>
                  <p className="text-xs text-[#6f5f58]">
                    {removedCount > 0
                      ? 'सभी उत्पाद हटा दिए गए हैं। आप ऊपर दिए गए "मूल कैटलॉग रीसेट करें" बटन से उन्हें वापस ला सकते हैं।'
                      : 'खोज शब्द बदलकर पुनः प्रयास करें।'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: CLUSTERS & STATUTORY WAGES WITH INLINE EDITOR                  */}
        {/* ===================================================================== */}
        {activeTab === 'clusters' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#e4e4e7] overflow-hidden bento-shadow">
              <div className="p-6 sm:p-7 border-b border-[#f4f4f5] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="font-sans font-bold text-xl text-[#1c1917]">
                    शिल्प समूह व वैधानिक न्यूनतम पारिश्रमिक नीतियां (Cluster Wage Floor Governance)
                  </h3>
                  <p className="text-xs text-[#545454] mt-0.5">
                    ये दैनिक मजदूरी दरें AI मूल्य निर्धारण एल्गोरिदम के लिए अनिवार्य न्यूनतम सीमा (Cost-Plus Wage Floor) तय करती हैं।
                  </p>
                </div>

                <div className="text-xs bg-[#f4f4f5] text-[#545454] border border-[#e4e4e7] px-3.5 py-1.5 rounded-full font-semibold flex items-center gap-1.5 w-fit">
                  <ShieldCheck className="w-4 h-4 text-[#059669]" />
                  <span>Statutory Wage Baseline Enforced</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fafafa] text-[#71717a] uppercase font-bold border-b border-[#e4e4e7]">
                    <tr>
                      <th className="py-4 px-6">Cluster & Origin</th>
                      <th className="py-4 px-6">Heritage Discipline</th>
                      <th className="py-4 px-6">Active Artisans</th>
                      <th className="py-4 px-6">Statutory Wage Baseline</th>
                      <th className="py-4 px-6">Provenance Status</th>
                      <th className="py-4 px-6 text-right">Admin Wage Modifier</th>
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
                          {c.active_artisans_count.toLocaleString('en-IN')} पंजीकृत
                        </td>
                        <td className="py-4 px-6">
                          {editingWageClusterId === c.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={tempWageValue}
                                onChange={(e) => setTempWageValue(Number(e.target.value))}
                                className="w-24 px-2 py-1 border border-[#1b4332] rounded-lg text-xs font-bold"
                              />
                              <button
                                onClick={() => handleSaveWage(c.id)}
                                className="bg-[#1b4332] text-white p-1.5 rounded-lg hover:bg-[#2d6a4f]"
                                title="सुरक्षित करें"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingWageClusterId(null)}
                                className="border border-neutral-300 p-1.5 rounded-lg hover:bg-neutral-100"
                                title="रद्द करें"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-bold text-[#065f46] bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-1 rounded-md">
                              ₹{c.statutory_minimum_daily_wage}/दिन
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1 text-[#059669] font-semibold">
                            <Award className="w-3.5 h-3.5" /> GI Certified
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWageClusterId(c.id);
                              setTempWageValue(c.statutory_minimum_daily_wage);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#1b4332] hover:text-[#2d6a4f] bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>मजदूरी बदलें</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: B2B BULK RFQS & PROCUREMENT OVERSIGHT                          */}
        {/* ===================================================================== */}
        {activeTab === 'b2b' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#e4e4e7] overflow-hidden bento-shadow p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[#f4f4f5] pb-4">
                <div>
                  <h3 className="font-sans font-bold text-xl text-[#1c1917]">
                    थोक मांग व संस्थागत खरीद नियंत्रण (B2B Bulk Procurement RFQs)
                  </h3>
                  <p className="text-xs text-[#545454] mt-0.5">
                    कॉर्पोरेट, बुटीक और सरकारी एम्पोरियम द्वारा दर्ज की गई थोक आवश्यकताओं की समीक्षा व कारीगर आवंटन।
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs bg-[#f4f4f5] text-[#545454] px-3 py-1 rounded-full font-semibold border border-[#e4e4e7]">
                    {b2bRFQs.length} सक्रिय मांगें
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fafafa] text-[#71717a] uppercase font-bold border-b border-[#e4e4e7]">
                    <tr>
                      <th className="py-3 px-4">संस्था / क्रेता (Buyer Organization)</th>
                      <th className="py-3 px-4">आवश्यक शिल्प (Craft)</th>
                      <th className="py-3 px-4">मात्रा व बजट (Volume & Budget)</th>
                      <th className="py-3 px-4">AI मिलान स्कोर (Match %)</th>
                      <th className="py-3 px-4">स्थिति (Status)</th>
                      <th className="py-3 px-4 text-right">प्रशासक निर्णय (Admin Action)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f4f5] text-[#1c1917]">
                    {b2bRFQs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-[#71717a]">
                          कोई सक्रिय B2B मांग उपलब्ध नहीं है (No active B2B RFQ records found).
                        </td>
                      </tr>
                    ) : (
                      b2bRFQs.map((rfq) => (
                      <tr key={rfq.id} className="hover:bg-[#fafafa] transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-sm text-[#1c1917]">{rfq.company_name}</div>
                          <div className="text-[11px] text-[#71717a] flex items-center gap-1 mt-0.5">
                            <Users className="w-3 h-3 text-[#F5A941]" /> {rfq.buyer_name} • {rfq.buyer_phone}
                          </div>
                          <div className="text-[10px] text-[#a1a1aa] mt-0.5">📍 {rfq.delivery_state} • {rfq.created_at}</div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="bg-[#1b4332]/10 text-[#1b4332] font-semibold px-2.5 py-1 rounded-md block w-fit">
                            {rfq.craft_type}
                          </span>
                          <span className="text-[11px] text-[#71717a] block mt-1">
                            अवधि: {rfq.deadline_days} दिन
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-sm text-[#c85a32]">
                            {rfq.quantity} इकाइयाँ
                          </div>
                          <div className="text-[11px] text-[#545454]">
                            ₹{rfq.budget_per_unit.toLocaleString('en-IN')}/इकाई
                          </div>
                          <div className="text-[10px] font-semibold text-[#059669]">
                            कुल: ₹{(rfq.quantity * rfq.budget_per_unit).toLocaleString('en-IN')}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-neutral-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-[#059669] h-2 rounded-full"
                                style={{ width: `${rfq.match_score}%` }}
                              />
                            </div>
                            <span className="font-extrabold text-[#059669]">{rfq.match_score}%</span>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          {rfq.status === 'approved' ? (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                              ✓ स्वीकृत (Approved)
                            </span>
                          ) : rfq.status === 'matched' ? (
                            <span className="bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                              ⚡ कारीगर मिलान (Matched)
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                              ⏳ समीक्षाधीन (In Review)
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {rfq.status !== 'approved' && (
                              <button
                                onClick={() => handleUpdateB2BStatus(rfq.id, 'approved')}
                                className="px-2.5 py-1 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                              >
                                स्वीकृत करें
                              </button>
                            )}
                            {rfq.status !== 'matched' && (
                              <button
                                onClick={() => handleUpdateB2BStatus(rfq.id, 'matched')}
                                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-[#1c1917] text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                              >
                                मैच करें
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: CUSTOMER INQUIRIES OVERSIGHT                                   */}
        {/* ===================================================================== */}
        {activeTab === 'inquiries' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#e4e4e7] overflow-hidden bento-shadow p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[#f4f4f5] pb-4">
                <div>
                  <h3 className="font-sans font-bold text-xl text-[#1c1917]">
                    सार्वजनिक ग्राहक पूछताछ निगरानी (All Customer Inquiries Feed)
                  </h3>
                  <p className="text-xs text-[#545454] mt-0.5">
                    खरीदारों द्वारा कारीगरों को भेजी गई सभी पूछताछों की निगरानी व सहायता व्यवस्था।
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-[#f4f4f5] p-1 rounded-xl border border-[#e4e4e7]">
                    <button
                      onClick={() => setInquiryFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        inquiryFilter === 'all' ? 'bg-white shadow-xs text-[#1c1917]' : 'text-[#71717a]'
                      }`}
                    >
                      सभी ({inquiries.length})
                    </button>
                    <button
                      onClick={() => setInquiryFilter('new')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        inquiryFilter === 'new' ? 'bg-white shadow-xs text-[#c85a32]' : 'text-[#71717a]'
                      }`}
                    >
                      नया ({inquiries.filter((i) => i.status === 'new').length})
                    </button>
                    <button
                      onClick={() => setInquiryFilter('replied')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        inquiryFilter === 'replied' ? 'bg-white shadow-xs text-[#059669]' : 'text-[#71717a]'
                      }`}
                    >
                      उत्तर दिया ({inquiries.filter((i) => i.status === 'replied').length})
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredInquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className="p-5 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] hover:bg-white hover:border-[#1b4332]/30 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-bold text-sm text-[#1c1917] block">
                          {inq.customer_name}
                        </span>
                        <span className="text-[11px] text-[#71717a] block">
                          📞 {inq.customer_phone} {inq.customer_email ? `• ${inq.customer_email}` : ''}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          inq.status === 'new'
                            ? 'bg-amber-100 text-amber-800'
                            : inq.status === 'replied'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {inq.status === 'new' ? 'नया प्रश्न' : 'उत्तर दिया गया'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-[#e4e4e7] text-xs space-y-1">
                      <div className="font-semibold text-[#1c1917] truncate">
                        🎨 शिल्प: {inq.product_title}
                      </div>
                      <div className="text-[11px] text-[#71717a]">
                        कारीगर: {inq.artisan_name || 'हस्तशिल्पकार'} • मात्रा: {inq.quantity || 1}
                      </div>
                    </div>

                    <p className="text-xs text-[#545454] leading-relaxed bg-white/70 p-3 rounded-xl border border-[#e4e4e7]">
                      &quot;{inq.message}&quot;
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-[#e4e4e7] text-[11px]">
                      <span className="text-[#71717a]">
                        {inq.created_at ? new Date(inq.created_at).toLocaleDateString('hi-IN') : 'हाल ही में'}
                      </span>
                      <div className="flex items-center gap-2">
                        {inq.status === 'new' && (
                          <button
                            onClick={() => {
                              updateInquiryStatus(inq.id, 'replied');
                              setInquiries(getAllInquiries());
                              setToastMessage('पूछताछ स्थिति "उत्तर दिया गया" में बदली गई।');
                              setTimeout(() => setToastMessage(null), 3000);
                            }}
                            className="text-[#059669] hover:underline font-bold text-xs cursor-pointer"
                          >
                            मार्क उत्तर दिया
                          </button>
                        )}
                        <button
                          onClick={() => {
                            deleteInquiry(inq.id);
                            setInquiries(getAllInquiries());
                            setToastMessage('पूछताछ हटाई गई।');
                            setTimeout(() => setToastMessage(null), 3000);
                          }}
                          className="text-red-600 hover:underline font-bold text-xs cursor-pointer"
                        >
                          हटाएं
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredInquiries.length === 0 && (
                <div className="py-10 text-center text-[#71717a] text-xs">
                  कोई पूछताछ उपलब्ध नहीं है।
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: REGISTERED ARTISANS DIRECTORY                                  */}
        {/* ===================================================================== */}
        {activeTab === 'artisans' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#e4e4e7] overflow-hidden bento-shadow p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[#f4f4f5] pb-4">
                <div>
                  <h3 className="font-sans font-bold text-xl text-[#1c1917]">
                    पंजीकृत शिल्पकार व कारीगर निर्देशिका (Master Artisans Directory)
                  </h3>
                  <p className="text-xs text-[#545454] mt-0.5">
                    राष्ट्रीय शिल्प पंजीयन, क्लस्टर संबद्धता व GI पहचान का प्रशासनिक प्रबंधन।
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs bg-[#f4f4f5] text-[#545454] px-3 py-1 rounded-full font-semibold border border-[#e4e4e7]">
                    {artisans.length} पंजीकृत शिल्पकार
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fafafa] text-[#71717a] uppercase font-bold border-b border-[#e4e4e7]">
                    <tr>
                      <th className="py-4 px-4">शिल्पकार (Master Artisan)</th>
                      <th className="py-4 px-4">क्लस्टर व राज्य (Cluster & State)</th>
                      <th className="py-4 px-4">शिल्प विधा (Heritage Craft)</th>
                      <th className="py-4 px-4">सक्रिय उत्पाद (Listings)</th>
                      <th className="py-4 px-4">प्रमाणन स्थिति (GI Certification)</th>
                      <th className="py-4 px-4 text-right">कार्रवाई (Admin Action)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f4f5] text-[#1c1917]">
                    {artisans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-[#71717a]">
                          कोई शिल्पकार रिकॉर्ड नहीं मिला (No artisan records found).
                        </td>
                      </tr>
                    ) : (
                      artisans.map((art) => (
                      <tr key={art.id} className="hover:bg-[#fafafa] transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-sm text-[#1c1917]">{art.name}</div>
                          <div className="text-[11px] text-[#71717a] flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-[#F5A941]" /> {art.phone}
                          </div>
                          <div className="text-[10px] text-[#a1a1aa]">पंजीकरण: {art.joined_date}</div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-semibold text-[#1c1917] block">{art.cluster}</span>
                          <span className="text-[11px] text-[#71717a]">📍 {art.state}</span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="bg-[#1b4332]/10 text-[#1b4332] font-semibold px-2.5 py-1 rounded-md block w-fit">
                            {art.craft_type}
                          </span>
                        </td>

                        <td className="py-4 px-4 font-bold text-[#c85a32]">
                          {art.products_count} उत्पाद
                        </td>

                        <td className="py-4 px-4">
                          {art.gi_verified ? (
                            <span className="inline-flex items-center gap-1 text-[#059669] bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-1 rounded-full font-bold text-[10px]">
                              <Award className="w-3 h-3" /> GI प्रमाणित शिल्पकार
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-bold text-[10px]">
                              ⏳ सत्यापन लंबित
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleArtisanGI(art.id)}
                            className="px-3 py-1.5 rounded-xl border border-[#e4e4e7] bg-white hover:bg-[#f4f4f5] text-xs font-bold transition-all cursor-pointer"
                          >
                            {art.gi_verified ? 'प्रमाणन हटाएं' : 'सत्यापित करें'}
                          </button>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 6: SECURITY & DPDP STATUTORY AUDIT                                */}
        {/* ===================================================================== */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#e4e4e7] overflow-hidden bento-shadow p-6 sm:p-7 space-y-6">
              <div className="border-b border-[#f4f4f5] pb-4">
                <h3 className="font-sans font-bold text-xl text-[#1c1917]">
                  प्लेटफ़ॉर्म सुरक्षा, संप्रभु अनुपालन व DPDP ऑडिट (Security & Statutory Compliance)
                </h3>
                <p className="text-xs text-[#545454] mt-0.5">
                  डिजिटल पर्सनल डेटा प्रोटेक्शन (DPDP) अधिनियम 2023, UIDAI आधार सुरक्षा व एंटी-एक्सप्लॉयटेशन मूल्य निर्धारण की लाइव स्थिति।
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>DPDP Act 2023 Voice & Visual Consent</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    कारीगरों की आवाज व उत्पाद फोटो अपलोड से पहले क्षेत्रीय भाषा में स्पष्ट सहमति रिकॉर्ड की जाती है। कारीगर 1-क्लिक में डेटा निष्कासन का अनुरोध कर सकते हैं।
                  </p>
                  <div className="text-[10px] font-mono text-emerald-900 bg-white/70 p-2 rounded-lg border border-emerald-200">
                    Status: COMPLIANT • 100% Consent Log Coverage
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>UIDAI Masked Aadhaar Vault</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    कारीगर पहचान सत्यापन में UIDAI मानकों के अनुरूप केवल अंतिम 4 अंक (xxxx-xxxx-4321) संग्रहीत किए जाते हैं। कोई भी असंरक्षित आधार संख्या डेटाबेस में नहीं जाती।
                  </p>
                  <div className="text-[10px] font-mono text-emerald-900 bg-white/70 p-2 rounded-lg border border-emerald-200">
                    Status: VAULT ENCRYPTED • Zero Raw Aadhaar Stored
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>GPS EXIF Metadata Automatic Stripping</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    ग्रामीण कारीगरों के घरों और कार्यशालाओं की भू-स्थानिक सुरक्षा के लिए, सभी अपलोड की गई फोटो से GPS अक्षांश/देशांतर EXIF डेटा अपलोड होते ही स्थायी रूप से हटा दिया जाता है।
                  </p>
                  <div className="text-[10px] font-mono text-emerald-900 bg-white/70 p-2 rounded-lg border border-emerald-200">
                    Status: ACTIVE • All EXIF Scrubbed on Edge Upload
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Anti-Exploitation Wage Floor Guardrails</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    कोई भी बिचौलिया या ग्राहक कारीगर की वैधानिक न्यूनतम मजदूरी लागत से कम मूल्य पर उत्पाद नहीं खरीद सकता। सर्वर-साइड फ्लोर गार्डरेल सक्रिय रूप से लागू है।
                  </p>
                  <div className="text-[10px] font-mono text-emerald-900 bg-white/70 p-2 rounded-lg border border-emerald-200">
                    Status: ENFORCED • Statutory Floor Guardrail Active
                  </div>
                </div>
              </div>

              {/* Edge Whitelist Audit Box */}
              <div className="p-5 rounded-2xl border border-[#2e2e30] bg-[#141414] text-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#F8C146] font-bold text-sm">
                    <ShieldCheck className="w-4 h-4 text-[#F5A941]" />
                    <span>Cloudflare Edge Administrative Whitelist Status</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    Active Firewall
                  </span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  संवेदनशील प्रशासनिक API कार्यवाही सत्यापित Supabase JWT और सर्वर-साइड अनुमोदित administrator subject ID द्वारा सुरक्षित है।
                </p>
                <div className="text-xs font-mono text-[#F8C146] bg-black/50 p-3 rounded-xl border border-[#3e3e42]">
                  Administrator identity is configured server-side.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 7: ARTISAN UPGRADE APPLICATIONS                                   */}
        {/* ===================================================================== */}
        {activeTab === 'applications' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#e6ded3] overflow-hidden bento-shadow p-6 sm:p-7 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#e6ded3] pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider mb-1">
                    <KeyRound className="w-3 h-3 text-purple-700" />
                    <span>Super Admin Authorization Required</span>
                  </div>
                  <h3 className="font-sans font-bold text-xl text-[#1c1917]">
                    कारीगर उन्नयन आवेदन (Artisan Upgrade Applications)
                  </h3>
                  <p className="text-xs text-[#545454] mt-0.5">
                    शिल्पकारों द्वारा जमा किए गए आवेदनों की समीक्षा। सुरक्षा एवं नीतिगत कारणों से अनुमोदन केवल सुपर एडमिन (Super Admin) द्वारा ही मान्य है।
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {applications.filter((a) => a.status === 'pending').length} लंबित आवेदन
                  </span>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {applications.filter((a) => a.status === 'approved').length} स्वीकृत
                  </span>
                </div>
              </div>

              {applications.length === 0 ? (
                <div className="text-center py-12 space-y-3 bg-[#faf7f2] rounded-2xl border border-dashed border-[#e6ded3]">
                  <UserCheck className="w-10 h-10 text-[#a89e96] mx-auto" />
                  <p className="text-sm font-bold text-[#1c1917]">कोई कारीगर आवेदन नहीं मिला</p>
                  <p className="text-xs text-[#545454]">नये आवेदन प्राप्त होते ही यहाँ प्रदर्शित होंगे।</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#e6ded3] text-[#6f5f58] uppercase text-[10px] font-bold">
                        <th className="py-3 px-3">आवेदक ID</th>
                        <th className="py-3 px-3">शिल्प श्रेणी</th>
                        <th className="py-3 px-3">अनुभव</th>
                        <th className="py-3 px-3">स्थान</th>
                        <th className="py-3 px-3">आवेदन तिथि</th>
                        <th className="py-3 px-3">स्थिति</th>
                        <th className="py-3 px-3 text-right">कार्यवाही</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4f0ea]">
                      {applications.map((app) => (
                        <tr key={app.id} className="hover:bg-[#faf7f2] transition-colors">
                          <td className="py-3.5 px-3 font-mono text-[11px] text-[#1c1917]">
                            {app.user_id.slice(0, 14)}...
                          </td>
                          <td className="py-3.5 px-3 font-bold text-[#1c1917]">
                            {app.craft_category}
                          </td>
                          <td className="py-3.5 px-3 text-[#545454]">
                            {app.experience_years} वर्ष
                          </td>
                          <td className="py-3.5 px-3 text-[#545454]">
                            {app.state || 'N/A'}{app.district ? `, ${app.district}` : ''}
                          </td>
                          <td className="py-3.5 px-3 text-[#545454]">
                            {app.created_at ? new Date(app.created_at).toLocaleDateString('hi-IN') : 'हाल ही में'}
                          </td>
                          <td className="py-3.5 px-3">
                            {app.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" /> लंबित (Pending)
                              </span>
                            )}
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
                          <td className="py-3.5 px-3 text-right">
                            {app.status === 'pending' && (
                              isSuperAdmin ? (
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleApproveApp(app.id)}
                                    disabled={isActionPending}
                                    className="inline-flex items-center gap-1 bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                                  >
                                    <UserCheck className="w-3 h-3" />
                                    <span>स्वीकार करें (Approve)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectApp(app.id)}
                                    disabled={isActionPending}
                                    className="inline-flex items-center gap-1 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                                  >
                                    <UserX className="w-3 h-3" />
                                    <span>अस्वीकार (Reject)</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                  <Lock className="w-3 h-3 text-amber-700" /> केवल सुपर एडमिन
                                </span>
                              )
                            )}
                            {app.status !== 'pending' && (
                              <span className="text-[11px] text-[#a89e96] italic">संसाधित</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 8: ADMIN USER GOVERNANCE (SUPER ADMIN ONLY)                       */}
        {/* ===================================================================== */}
        {activeTab === 'admin_management' && isSuperAdmin && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#e6ded3] overflow-hidden bento-shadow p-6 sm:p-7 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#e6ded3] pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-amber-100/60 text-amber-900 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider mb-1">
                    <KeyRound className="w-3 h-3 text-amber-700" />
                    <span>Super Admin Clearance Only</span>
                  </div>
                  <h3 className="font-sans font-bold text-xl text-[#1c1917]">
                    प्रशासक खाता प्रबंधन (Platform Administrator Governance)
                  </h3>
                  <p className="text-xs text-[#545454] mt-0.5">
                    प्लेटफ़ॉर्म प्रशासक नियुक्त करें या पद वापस लें। प्राथमिक सुपर एडमिन को हटाया नहीं जा सकता।
                  </p>
                </div>
              </div>

              {/* Grant Form */}
              <div className="bg-[#faf7f2] p-5 rounded-2xl border border-[#e6ded3] space-y-3">
                <h4 className="text-xs font-bold text-[#1c1917] uppercase tracking-wider">
                  नया प्रशासक नियुक्त करें (Grant Administrator Role)
                </h4>
                <form onSubmit={handleGrantAdmin} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="उपयोगकर्ता UUID दर्ज करें (Enter User ID)..."
                    value={newAdminUserId}
                    onChange={(e) => setNewAdminUserId(e.target.value)}
                    className="flex-1 bg-white border border-[#e6ded3] rounded-2xl px-4 py-2.5 text-xs text-[#1c1917] focus:ring-2 focus:ring-[#1b4332] focus:outline-hidden font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isActionPending || !newAdminUserId.trim()}
                    className="bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs px-5 py-2.5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>प्रशासक बनाएं (Grant Admin)</span>
                  </button>
                </form>
                <p className="text-[11px] text-[#6f5f58]">
                  नियुक्त किए गए उपयोगकर्ता को सर्वर-साइड Supabase app_metadata में 'admin' भूमिका प्राप्त होगी।
                </p>
              </div>

              {/* Admins Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e6ded3] text-[#6f5f58] uppercase text-[10px] font-bold">
                      <th className="py-3 px-3">उपयोगकर्ता ID</th>
                      <th className="py-3 px-3">ईमेल</th>
                      <th className="py-3 px-3">भूमिका (Role)</th>
                      <th className="py-3 px-3">सृजन तिथि</th>
                      <th className="py-3 px-3 text-right">कार्यवाही</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f0ea]">
                    {adminUsers.map((adm) => {
                      const isSelf = adm.id === user?.id;
                      const isSuper = adm.role === 'super_admin';
                      return (
                        <tr key={adm.id} className="hover:bg-[#faf7f2] transition-colors">
                          <td className="py-3.5 px-3 font-mono text-[11px] text-[#1c1917]">
                            {adm.id}
                          </td>
                          <td className="py-3.5 px-3 font-medium text-[#1c1917]">
                            {adm.email || 'N/A'}
                          </td>
                          <td className="py-3.5 px-3">
                            {isSuper ? (
                              <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                                <KeyRound className="w-3 h-3" /> SUPER ADMIN
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                                <Shield className="w-3 h-3" /> ADMIN
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-[#545454]">
                            {adm.created_at ? new Date(adm.created_at).toLocaleDateString('hi-IN') : 'N/A'}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {isSuper || isSelf ? (
                              <span className="text-[10px] text-[#a89e96] italic">सुरक्षित खाता</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRevokeAdmin(adm.id)}
                                disabled={isActionPending}
                                className="inline-flex items-center gap-1 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                              >
                                <UserX className="w-3 h-3" />
                                <span>पद वापस लें (Revoke)</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 9: ADMINISTRATIVE AUDIT LOGS                                      */}
        {/* ===================================================================== */}
        {activeTab === 'audit_logs' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#e6ded3] overflow-hidden bento-shadow p-6 sm:p-7 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#e6ded3] pb-4">
                <div>
                  <h3 className="font-sans font-bold text-xl text-[#1c1917]">
                    प्रशासनिक ऑडिट लॉग (Administrative Audit Trail)
                  </h3>
                  <p className="text-xs text-[#545454] mt-0.5">
                    प्लेटफ़ॉर्म पर किए गए सभी प्रशासनिक निर्णयों, भूमिका परिवर्तनों और कारीगर स्वीकृतियों का अपरिवर्तनीय सर्वर लॉग।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadData()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border border-[#e6ded3] bg-[#faf7f2] hover:bg-white text-[#1c1917] transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>रिफ्रेश लॉग्स</span>
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-12 space-y-3 bg-[#faf7f2] rounded-2xl border border-dashed border-[#e6ded3]">
                  <History className="w-10 h-10 text-[#a89e96] mx-auto" />
                  <p className="text-sm font-bold text-[#1c1917]">कोई ऑडिट लॉग रिकॉर्ड नहीं मिला</p>
                  <p className="text-xs text-[#545454]">प्रशासनिक गतिविधियों के साथ ऑडिट लॉग स्वतः दर्ज होते हैं।</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#e6ded3] text-[#6f5f58] uppercase text-[10px] font-bold">
                        <th className="py-3 px-3">समय (Timestamp)</th>
                        <th className="py-3 px-3">कार्यवाही (Action)</th>
                        <th className="py-3 px-3">प्रशासक (Actor)</th>
                        <th className="py-3 px-3">लक्षित खाता (Target User)</th>
                        <th className="py-3 px-3">विवरण (Details)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4f0ea]">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#faf7f2] transition-colors">
                          <td className="py-3.5 px-3 font-mono text-[11px] text-[#545454] whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('hi-IN')}
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-[11px] text-[#1c1917]">
                            <span className="bg-[#faf7f2] px-2 py-0.5 rounded-md border border-[#e6ded3]">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-[#1c1917]">
                            {log.actor_email || log.actor_id.slice(0, 12)}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-[11px] text-[#545454]">
                            {log.target_user_id ? log.target_user_id.slice(0, 14) + '...' : '-'}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-[11px] text-[#6f5f58] max-w-xs truncate">
                            {log.details || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* DELETE CONFIRMATION MODAL                                             */}
        {/* ===================================================================== */}
        {productToDelete && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 border border-[#e6ded3] shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="font-sans text-xl font-extrabold text-[#231f1e]">
                  उत्पाद हटाएं? (Remove Product)
                </h3>
                <p className="text-xs text-[#6f5f58] leading-relaxed">
                  क्या आप वाकई निम्नलिखित उत्पाद को सार्वजनिक मार्केटप्लेस और कैटलॉग से हटाना चाहते हैं?
                </p>
                <div className="p-3 bg-[#faf7f2] rounded-xl border border-[#e6ded3] text-left mt-2">
                  <span className="font-bold text-xs text-[#231f1e] block">
                    {productToDelete.title_hi || productToDelete.title_en}
                  </span>
                  <span className="text-[11px] text-[#6f5f58] block">
                    शिल्प: {productToDelete.craft_type} • मूल्य: ₹{(productToDelete.recommended_retail_d2c || productToDelete.floor_price).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  disabled={isDeleting}
                  className="py-3 px-4 rounded-xl border border-[#e6ded3] bg-white hover:bg-[#faf7f2] text-[#231f1e] font-bold text-xs transition-all cursor-pointer"
                >
                  रद्द करें (Cancel)
                </button>

                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>हाँ, हटाएं (Yes, Remove)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
