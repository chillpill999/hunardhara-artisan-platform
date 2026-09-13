import Link from 'next/link';
import { ShieldCheck, Lock, Eye, FileText, ArrowLeft, Mail } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy • Hunardhara (हुनरधारा)',
  description: 'Hunardhara Privacy Policy detailing data protection, DPDP Act 2023 compliance, and Google OAuth user data safeguards.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#1c1917] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#8c4b2d] hover:text-[#5e2f18] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>होमपेज पर वापस जाएं (Back to Home)</span>
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#e8dfd5] shadow-xs space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#fdf2ea] text-[#c85a32] text-xs font-bold px-3.5 py-1.5 rounded-full">
            <ShieldCheck className="w-4 h-4 text-[#c85a32]" />
            <span>DPDP Act 2023 & OAuth Compliance</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-[#231f1e] tracking-tight">
            Privacy Policy (गोपनीयता नीति)
          </h1>
          <p className="text-sm text-[#736357] leading-relaxed">
            Effective Date: <strong>September 13, 2026</strong> • Last Updated: <strong>September 13, 2026</strong>
          </p>
          <p className="text-sm text-[#443e39] leading-relaxed">
            Welcome to <strong>Hunardhara (हुनरधारा)</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). Hunardhara is a digital marketplace and AI-driven market linkage platform empowering traditional Indian master artisans and connecting them directly with retail and B2B patrons. We are committed to protecting your personal privacy in full compliance with the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> of India and international standards.
          </p>
        </div>

        {/* Main Content Sections */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#e8dfd5] shadow-xs space-y-8 text-sm text-[#3b3531] leading-relaxed">
          
          {/* 1. Information We Collect */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#231f1e] flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#c85a32]" />
              1. Information We Collect
            </h2>
            <p>We collect information that is strictly necessary to provide authentic market linkages, secure login, craft verification, and order processing:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#5a5048]">
              <li><strong>Account Credentials & Profile:</strong> When you register or sign in via Google OAuth, we receive your verified email address, full name, and avatar/profile picture.</li>
              <li><strong>Artisan Profiles:</strong> Craft specialization, workshop district/state, artisan bio, cooperative affiliations, and bank/UPI payout verification details.</li>
              <li><strong>Customer & B2B Inquiries:</strong> Contact phone/WhatsApp number, inquiry message, requested bulk quantities, and delivery location for order fulfillment.</li>
              <li><strong>Device & Usage Information:</strong> Anonymized log data, IP address, and session tokens essential to safeguard against unauthorized access.</li>
            </ul>
          </section>

          {/* 2. Google OAuth User Data Policy */}
          <section className="space-y-3 bg-[#fdfbf7] p-6 rounded-2xl border border-[#ede3d8]">
            <h2 className="text-lg font-bold text-[#231f1e] flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#c85a32]" />
              2. Google OAuth & Third-Party Authentication
            </h2>
            <p className="text-xs sm:text-sm">
              Hunardhara uses Google OAuth strictly to authenticate your identity securely. When you choose <em>&quot;Continue with Google&quot;</em>:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#5a5048]">
              <li>We only request read access to basic user profile data (email, name, picture).</li>
              <li><strong>We NEVER sell, trade, or transfer your Google user data</strong> to third-party ad networks, brokers, or external AI model trainers.</li>
              <li>Your Google authentication tokens are processed securely by Supabase infrastructure and encrypted at rest using AES-256.</li>
            </ul>
          </section>

          {/* 3. How We Use Your Data */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#231f1e] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#c85a32]" />
              3. Purpose of Processing & Data Usage
            </h2>
            <p>Your data is processed only for explicit, legitimate purposes:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#5a5048]">
              <li>Connecting buyers directly with artisans to fulfill product inquiries and bulk RFQs without middleman interception.</li>
              <li>Enabling verified GI (Geographical Indication) QR Craft Passports for authentic handicraft provenance.</li>
              <li>Administering fair pricing recommendations and artisan studio features.</li>
              <li>Platform security, preventing fraud, and enforcing authorized administrator access controls.</li>
            </ul>
          </section>

          {/* 4. Data Protection & DPDP Act 2023 Compliance */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#231f1e] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#c85a32]" />
              4. Data Retention & User Rights (DPDP Act 2023)
            </h2>
            <p>Under the Digital Personal Data Protection Act (DPDP Act 2023), you hold complete sovereignty over your data:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#5a5048]">
              <li><strong>Right to Access & Rectify:</strong> You can review and edit your account details at any time from your account settings.</li>
              <li><strong>Right to Erasure / Deletion:</strong> You have the legal right to withdraw consent and request total deletion of your profile, catalog entries, and inquiries.</li>
              <li><strong>EXIF Privacy Guard:</strong> All GPS and personal location metadata are automatically scrubbed from handicraft studio photos prior to cloud storage.</li>
            </ul>
          </section>

          {/* 5. Contact & Grievance Officer */}
          <section className="space-y-3 border-t border-[#e8dfd5] pt-6">
            <h2 className="text-lg font-bold text-[#231f1e] flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#c85a32]" />
              5. Grievance Officer & Contact
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your personal information, please reach out to our Grievance Redressal Officer:
            </p>
            <div className="bg-[#f7f4ee] p-4 rounded-xl text-xs space-y-1 font-mono text-[#443e39]">
              <p><strong>Grievance Officer:</strong> Hunardhara Data Protection Officer</p>
              <p><strong>Email:</strong> <a href="mailto:aryanrockstar2007@gmail.com" className="text-[#c85a32] underline">aryanrockstar2007@gmail.com</a></p>
              <p><strong>Platform:</strong> Hunardhara (हुनरधारा) • Ministry of Social Justice and Empowerment / Smart India Hackathon Initiative</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
