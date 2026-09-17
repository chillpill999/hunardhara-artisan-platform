'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { saveInquiry } from '@/lib/inquiries';
import { ArtisanInquiry } from '@/lib/types';
import {
  X,
  Send,
  CheckCircle2,
  MessageSquareQuote,
  Sparkles,
  Phone,
  Mail,
  User,
  Package,
  ShieldCheck,
  Lock,
  LogIn
} from 'lucide-react';

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  productTitleHi?: string;
  productImage?: string;
  artisanId: string;
  artisanName?: string;
  artisanCluster?: string;
  defaultType?: 'customization' | 'bulk_order' | 'delivery_time' | 'price' | 'general';
}

export default function InquiryModal({
  isOpen,
  onClose,
  productId,
  productTitle,
  productImage,
  artisanId,
  artisanName,
  artisanCluster,
  defaultType = 'customization',
}: InquiryModalProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [inquiryType, setInquiryType] = useState<ArtisanInquiry['inquiry_type']>(defaultType);
  const [customerName, setCustomerName] = useState(user?.user_metadata?.full_name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.user_metadata?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync logged in user profile
  useEffect(() => {
    if (user) {
      if (!customerName && user.user_metadata?.full_name) {
        setCustomerName(user.user_metadata.full_name);
      }
      if (!customerEmail && user.email) {
        setCustomerEmail(user.email);
      }
      if (!customerPhone && user.user_metadata?.phone) {
        setCustomerPhone(user.user_metadata.phone);
      }
    }
  }, [user]);

  if (!isOpen) return null;

  // Strict Login Gate: Unauthenticated users are blocked from sending inquiries
  if (!user) {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : `/craft/${productId}`;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white rounded-3xl border border-[#e6ded3] max-w-md w-full p-6 sm:p-8 text-center space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-[#6f5f58] hover:bg-[#faf7f2] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-3 py-1 rounded-full">
              लॉगिन आवश्यक • Sign In Required
            </span>
            <h3 className="font-sans text-xl font-bold text-[#231f1e]">
              कारीगर से पूछताछ के लिए साइन इन करें
            </h3>
            <p className="text-xs text-[#6f5f58] leading-relaxed">
              उत्पाद अवलोकन खुला है, परंतु कारीगरों को स्पैम से बचाने और सीधी बातचीत के लिए केवल सत्यापित खरीदार ही प्रश्न पूछ सकते हैं।
            </p>
          </div>

          <div className="bg-[#faf7f2] p-3 rounded-2xl border border-[#e6ded3] text-left text-xs text-[#231f1e] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#e6ded3] overflow-hidden shrink-0 flex items-center justify-center">
              <img src={productImage || '/logo.png'} alt="" className="w-full h-full object-contain" />
            </div>
            <div className="truncate flex-1">
              <span className="font-bold block truncate">{productTitle}</span>
              <span className="text-[11px] text-[#6f5f58]">{artisanName || 'कारीगर'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                router.push(`/login?redirect=${encodeURIComponent(currentPath)}&msg=${encodeURIComponent('कारीगर से सीधा सवाल पूछने के लिए कृपया लॉगिन करें (Please sign in to inquire with the artisan)')}`);
              }}
              className="w-full bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs py-3.5 px-5 rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>लॉगिन करें (Sign In to Inquire)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full bg-white hover:bg-[#faf7f2] text-[#6f5f58] font-semibold text-xs py-2.5 rounded-xl border border-[#e6ded3] transition-colors cursor-pointer"
            >
              रद्द करें (Cancel)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('कृपया अपना नाम दर्ज करें (Please enter your name)');
      return;
    }
    if (!customerPhone.trim() && !customerEmail.trim()) {
      setError('कृपया फोन/व्हाट्सएप नंबर या ईमेल में से कम से कम एक संपर्क दर्ज करें');
      return;
    }
    if (!message.trim()) {
      setError('कृपया कारीगर के लिए अपना संदेश या प्रश्न लिखें');
      return;
    }

    setIsSubmitting(true);
    try {
      saveInquiry({
        product_id: productId,
        product_title: productTitle,
        product_image: productImage,
        artisan_id: artisanId || '',
        artisan_name: artisanName || 'प्रमाणित शिल्पकार',
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || '',
        inquiry_type: inquiryType,
        quantity: typeof quantity === 'number' && quantity > 0 ? quantity : undefined,
        message: message.trim(),
      });

      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'पूछताछ भेजने में त्रुटि हुई। कृपया पुनः प्रयास करें।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    setError(null);
    setMessage('');
    setQuantity('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-[#e6ded3] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#faf7f2] border-b border-[#e6ded3] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {productImage && (
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white border border-[#e6ded3] shrink-0 p-1 flex items-center justify-center">
                <img
                  src={productImage}
                  alt={productTitle}
                  className="w-full h-full object-contain rounded-xl"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/logo.png';
                  }}
                />
              </div>
            )}
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#c85a32] uppercase tracking-wider">
                <MessageSquareQuote className="w-3.5 h-3.5" />
                <span>सीधा कारीगर संवाद • Direct Artisan Inquiry</span>
              </div>
              <h3 className="font-sans font-extrabold text-[#231f1e] text-sm sm:text-base leading-snug line-clamp-1">
                {productTitle}
              </h3>
              <p className="text-[11px] text-[#6f5f58] mt-0.5">
                कारीगर: <strong className="text-[#1b4332]">{artisanName || 'प्रमाणित कारीगर'}</strong>
                {artisanCluster && ` • ${artisanCluster}`}
              </p>
            </div>
          </div>

          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-full hover:bg-white text-[#6f5f58] hover:text-[#231f1e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {isSuccess ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-sans font-extrabold text-xl text-[#1b4332]">
                  पूछताछ सीधे कारीगर को भेजी गई!
                </h4>
                <p className="text-xs text-[#231f1e] max-w-sm mx-auto leading-relaxed">
                  आपका संदेश बिना किसी बिचौलिये के सीधे <strong>{artisanName || 'कारीगर'}</strong> के कार्यशाला डैशबोर्ड (Atelier Inbox) में प्रेषित कर दिया गया है।
                </p>
              </div>

              <div className="bg-[#faf7f2] border border-[#e6ded3] rounded-2xl p-4 text-left space-y-2 text-xs">
                <div className="flex items-center gap-2 text-[#1b4332] font-semibold">
                  <ShieldCheck className="w-4 h-4 text-[#2d6a4f]" />
                  <span>सीधा संपर्क सुरक्षित (Zero Middleman Policy)</span>
                </div>
                <p className="text-[#6f5f58] text-[11px] leading-relaxed">
                  कारीगर आपसे सीधे आपके फोन/व्हाट्सएप <strong>({customerPhone || customerEmail})</strong> पर संपर्क करेंगे।
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full py-3 px-5 rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs transition-colors shadow-xs"
              >
                ठीक है, धन्यवाद (Close)
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Zero-Middleman Guarantee Pill */}
              <div className="bg-[#e8f5e9] border border-[#c8e6c9] rounded-2xl p-3 text-[11px] text-[#1b4332] flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
                <div>
                  <strong>सीधा संपर्क गारंटी:</strong> यह संदेश किसी दलाल या बिचौलिये के पास नहीं, सीधे कारीगर के कार्यशाला खाते में जाता है।
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                  {error}
                </div>
              )}

              {/* Query Classification */}
              <div>
                <label className="block text-xs font-bold text-[#231f1e] mb-1.5">
                  पूछताछ का प्रकार (Inquiry Category):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: 'customization', label: '🎨 कस्टमाइज़ेशन', sub: 'Custom Craft' },
                    { id: 'bulk_order', label: '📦 थोक ऑर्डर', sub: 'B2B Wholesale' },
                    { id: 'delivery_time', label: '🚚 डिलीवरी समय', sub: 'Timeline' },
                    { id: 'price', label: '💰 मूल्य दर', sub: 'Price Query' },
                    { id: 'general', label: '❓ सामान्य प्रश्न', sub: 'General' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setInquiryType(cat.id as any)}
                      className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                        inquiryType === cat.id
                          ? 'border-[#1b4332] bg-[#1b4332] text-white shadow-xs font-bold'
                          : 'border-[#e6ded3] bg-[#faf7f2] text-[#231f1e] hover:bg-white'
                      }`}
                    >
                      <div className="font-semibold">{cat.label}</div>
                      <div className={`text-[10px] ${inquiryType === cat.id ? 'text-emerald-200' : 'text-[#6f5f58]'}`}>
                        {cat.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Buyer Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#231f1e] mb-1">
                    आपका नाम (Your Name) *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-[#6f5f58] absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="उदा. अमित शर्मा"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-[#e6ded3] bg-[#faf7f2] focus:bg-white focus:outline-none focus:border-[#1b4332]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#231f1e] mb-1">
                    फोन / व्हाट्सएप नंबर *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#6f5f58] absolute left-3 top-3" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-[#e6ded3] bg-[#faf7f2] focus:bg-white focus:outline-none focus:border-[#1b4332]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#231f1e] mb-1">
                    ईमेल पता (Email Address)
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[#6f5f58] absolute left-3 top-3" />
                    <input
                      type="email"
                      placeholder="buyer@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-[#e6ded3] bg-[#faf7f2] focus:bg-white focus:outline-none focus:border-[#1b4332]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#231f1e] mb-1">
                    अनुमानित इकाइयाँ (Qty, यदि लागू हो)
                  </label>
                  <div className="relative">
                    <Package className="w-3.5 h-3.5 text-[#6f5f58] absolute left-3 top-3" />
                    <input
                      type="number"
                      min={1}
                      placeholder="उदा. 5"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-[#e6ded3] bg-[#faf7f2] focus:bg-white focus:outline-none focus:border-[#1b4332]"
                    />
                  </div>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-[#231f1e] mb-1">
                  आपका संदेश या प्रश्न (Your Message to Artisan) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="कारीगर से क्या पूछना चाहते हैं? (उदा. क्या यह विशिष्ट रंग या आकार में बन सकता है? डिलीवरी कितने दिनों में होगी?)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-[#e6ded3] bg-[#faf7f2] focus:bg-white focus:outline-none focus:border-[#1b4332] resize-none"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#e6ded3]">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 text-xs font-semibold text-[#6f5f58] hover:text-[#231f1e] cursor-pointer"
                >
                  रद्द करें (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>भेजा जा रहा है...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>कारीगर को भेजें (Submit Inquiry)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
