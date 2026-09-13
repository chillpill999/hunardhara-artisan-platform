import Link from 'next/link';
import { Scale, CheckCircle2, AlertTriangle, FileText, ArrowLeft, Mail } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service • Hunardhara (हुनरधारा)',
  description: 'Hunardhara Terms of Service governing platform usage, artisan fair-trade protections, and buyer transactions.',
};

export default function TermsPage() {
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
            <Scale className="w-4 h-4 text-[#c85a32]" />
            <span>Terms of Service & Fair Trade Governance</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-[#231f1e] tracking-tight">
            Terms of Service (सेवा की शर्तें)
          </h1>
          <p className="text-sm text-[#736357] leading-relaxed">
            Effective Date: <strong>September 13, 2026</strong> • Last Updated: <strong>September 13, 2026</strong>
          </p>
          <p className="text-sm text-[#443e39] leading-relaxed">
            These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you and <strong>Hunardhara (हुनरधारा)</strong> (&quot;Platform&quot;, &quot;we&quot;, &quot;our&quot;). By accessing, registering, signing in via Google, or purchasing on Hunardhara, you agree to comply with and be bound by these Terms.
          </p>
        </div>

        {/* Main Content Sections */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#e8dfd5] shadow-xs space-y-8 text-sm text-[#3b3531] leading-relaxed">
          
          {/* 1. Platform Purpose & Non-Exploitation Guarantee */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#231f1e] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#c85a32]" />
              1. Platform Mission & Zero-Exploitation Mandate
            </h2>
            <p>Hunardhara exists to bridge marginalized rural master artisans directly with buyers, eliminating exploitative middlemen. Under our Charter:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#5a5048]">
              <li><strong>Fair Wage Floor:</strong> All pricing recommendations respect algorithmic wage floors calculated against local skilled daily wages, preventing distress selling.</li>
              <li><strong>Direct Linkage:</strong> Buyer product inquiries and customization requests are delivered directly to the artisan without commission extortion.</li>
              <li><strong>Certified Provenance:</strong> QR Craft Passports represent authentic Geographical Indication (GI) lineages and cannot be falsified.</li>
            </ul>
          </section>

          {/* 2. User Accounts & Authentication */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#231f1e] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#c85a32]" />
              2. User Accounts & Google Authentication
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#5a5048]">
              <li>Users may authenticate using Email/Password, Magic Link, or Google OAuth.</li>
              <li>You are responsible for maintaining the confidentiality of your authentication credentials.</li>
              <li>First-time users must accurately identify as either an <strong>Artisan (कारीगर)</strong> or <strong>Buyer/Patron (खरीदार)</strong> and provide valid contact information for order fulfillment.</li>
              <li>Administrative access is strictly restricted to authorized platform personnel; unauthorized access attempts are logged and legally actionable.</li>
            </ul>
          </section>

          {/* 3. Artisan Commitments & Intellectual Property */}
          <section className="space-y-3 bg-[#fdfbf7] p-6 rounded-2xl border border-[#ede3d8]">
            <h2 className="text-lg font-bold text-[#231f1e] flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#c85a32]" />
              3. Artisan Rights & Intellectual Heritage
            </h2>
            <p className="text-xs sm:text-sm">
              All craft techniques, generational motifs, cultural stories, and artisan likenesses displayed on Hunardhara remain the exclusive intellectual and cultural heritage of the respective artisan communities.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#5a5048]">
              <li>Artisans warrant that listed crafts are handcrafted using authentic traditional methods.</li>
              <li>Buyers and commercial entities are strictly prohibited from replicating, scraping, or mass-producing indigenous artisan designs using industrial automation without explicit written consent.</li>
            </ul>
          </section>

          {/* 4. Transactions, Inquiries & B2B Orders */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#231f1e] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#c85a32]" />
              4. Direct Inquiries & Transactions
            </h2>
            <p>Hunardhara facilitates transparent commercial discussions:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#5a5048]">
              <li><strong>Inquiry Etiquette:</strong> Buyers must provide valid telephone/WhatsApp numbers and respectful messages when inquiring with artisans.</li>
              <li><strong>B2B Bulk Orders:</strong> Institutional buyers submitting RFQs agree to realistic production timelines respecting the artisanal, handcrafted nature of the products.</li>
              <li><strong>Payment Security:</strong> Direct settlements must occur via approved digital rails (UPI, Bank Transfer, Escrow) with proof of transaction.</li>
            </ul>
          </section>

          {/* 5. Limitation of Liability & Governing Law */}
          <section className="space-y-3 border-t border-[#e8dfd5] pt-6">
            <h2 className="text-lg font-bold text-[#231f1e] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#c85a32]" />
              5. Dispute Resolution & Governing Law
            </h2>
            <p className="text-xs sm:text-sm text-[#5a5048]">
              These Terms are governed by and construed in accordance with the laws of the Republic of India. Any disputes arising in connection with the platform shall be subject to the exclusive jurisdiction of the competent courts in India.
            </p>
            <div className="bg-[#f7f4ee] p-4 rounded-xl text-xs space-y-1 font-mono text-[#443e39] mt-4">
              <p><strong>Legal & Compliance Desk:</strong> Hunardhara Platform Governance</p>
              <p><strong>Email:</strong> <a href="mailto:aryanrockstar2007@gmail.com" className="text-[#c85a32] underline">aryanrockstar2007@gmail.com</a></p>
              <p><strong>Initiative:</strong> Ministry of Social Justice and Empowerment / Smart India Hackathon 2026</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
