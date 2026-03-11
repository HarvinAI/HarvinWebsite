'use client';

import { useState } from 'react';
import { Check, X, ChevronDown } from 'lucide-react';
import { useModal } from '@/components/ModalContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Pricing from '@/components/Pricing';

/* ── Feature comparison data ──────────────────────────────────────────────── */
type FeatureVal = boolean | string;
interface CompareRow {
  feature: string;
  starter: FeatureVal;
  business: FeatureVal;
  enterprise: FeatureVal;
}

const COMPARE_SECTIONS: { title: string; rows: CompareRow[] }[] = [
  {
    title: 'Data & Intelligence',
    rows: [
      { feature: 'D2C account database', starter: '500K+', business: '500K+', enterprise: '500K+ + custom' },
      { feature: 'Market Intelligence feed', starter: true, business: true, enterprise: true },
      { feature: 'Tech stack detection', starter: true, business: true, enterprise: true },
      { feature: 'Funding & signal alerts', starter: 'Daily digest', business: 'Real-time', enterprise: 'Real-time' },
      { feature: 'Custom data requests', starter: false, business: false, enterprise: true },
    ],
  },
  {
    title: 'Filters & Search',
    rows: [
      { feature: 'Filter categories', starter: '13', business: '13', enterprise: '13 + custom' },
      { feature: 'Saved filter presets', starter: '3', business: 'Unlimited', enterprise: 'Unlimited' },
      { feature: 'Search & sort', starter: true, business: true, enterprise: true },
      { feature: 'Boolean / advanced search', starter: false, business: true, enterprise: true },
    ],
  },
  {
    title: 'Watchlists & Exports',
    rows: [
      { feature: 'Watchlists', starter: '5', business: 'Unlimited', enterprise: 'Unlimited' },
      { feature: 'CSV export', starter: true, business: true, enterprise: true },
      { feature: 'White-label exports', starter: false, business: false, enterprise: true },
      { feature: 'Export rows / month', starter: '1,000', business: '10,000', enterprise: 'Unlimited' },
    ],
  },
  {
    title: 'Integrations',
    rows: [
      { feature: 'CRM integrations', starter: '1', business: 'All', enterprise: 'All + custom' },
      { feature: 'Slack alerts', starter: false, business: true, enterprise: true },
      { feature: 'Chrome extension', starter: false, business: true, enterprise: true },
      { feature: 'API access', starter: false, business: true, enterprise: true },
      { feature: 'Webhooks', starter: false, business: false, enterprise: true },
    ],
  },
  {
    title: 'Support',
    rows: [
      { feature: 'Support response time', starter: '48h', business: '24h', enterprise: '4h SLA' },
      { feature: 'Dedicated CSM', starter: false, business: false, enterprise: true },
      { feature: 'Onboarding session', starter: false, business: '1 session', enterprise: 'Custom' },
      { feature: 'Quarterly business reviews', starter: false, business: false, enterprise: true },
    ],
  },
];

/* ── FAQ data ─────────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: 'Can I switch plans later?',
    a: 'Absolutely. Upgrade or downgrade anytime from your account settings. When upgrading, you only pay the prorated difference. Downgrades take effect at the next billing cycle.',
  },
  {
    q: 'What counts as a "seat"?',
    a: 'Each seat is one user login. Every team member who needs to log in and access the dashboard requires their own seat. Shared logins are not supported.',
  },
  {
    q: 'Do you offer annual billing discounts?',
    a: 'Yes. Annual billing saves 20% compared to monthly. Contact us for multi-year enterprise agreements with additional savings.',
  },
  {
    q: 'What CRM integrations do you support?',
    a: 'We currently support HubSpot and Salesforce. Starter plans get one integration, Business and Enterprise plans get both, plus Enterprise can request custom integrations.',
  },
  {
    q: 'Is my data secure?',
    a: 'We use bank-level encryption (AES-256 at rest, TLS 1.3 in transit). SOC 2 Type II certification is in progress. We never share your data or watchlists with other customers.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Monthly plans can be cancelled at any time with no penalty. Your access continues until the end of the current billing period.',
  },
];

/* ── Cell renderer ────────────────────────────────────────────────────────── */
function CellValue({ val }: { val: FeatureVal }) {
  if (val === true)
    return <Check size={16} className="text-emerald-500 mx-auto" />;
  if (val === false)
    return <X size={16} className="text-slate-300 mx-auto" />;
  return <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">{val}</span>;
}

/* ── FAQ Accordion Item ───────────────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 dark:border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-200 pr-4 group-hover:text-[#C94C1E] transition-colors">
          {q}
        </span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-[200px] pb-5' : 'max-h-0'}`}
      >
        <p className="text-[14px] leading-relaxed text-slate-500 dark:text-slate-400 pr-8">{a}</p>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export default function PricingPage() {
  const { openModal } = useModal();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Navbar />
      <div className="pt-[64px]">

        {/* Pricing cards section (reused component) */}
        <Pricing />

        {/* ── Feature Comparison Table ──────────────────────────────────── */}
        <section className="py-20 px-6 bg-white dark:bg-slate-900/50 border-t border-slate-200 dark:border-white/[0.06]">
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-[clamp(24px,3vw,38px)] font-normal tracking-[-0.02em] text-slate-900 dark:text-white mb-3">
                Compare plans in detail
              </h2>
              <p className="text-[15px] text-slate-500 dark:text-slate-400">
                Everything you need to pick the right plan for your team.
              </p>
            </div>

            <div className="overflow-x-clip">
              <table className="w-full min-w-[700px]">
                {/* Sticky header */}
                <thead className="sticky top-[64px] z-20">
                  <tr className="border-b-2 border-slate-200 dark:border-white/[0.1]">
                    <th className="text-left py-4 pr-4 w-[40%] bg-white dark:bg-slate-900/50 backdrop-blur-sm" />
                    <th className="text-center py-4 px-4 w-[20%] bg-white dark:bg-slate-900/50 backdrop-blur-sm">
                      <span className="text-[14px] font-semibold text-slate-600 dark:text-slate-300">Starter</span>
                      <p className="text-[12px] text-slate-400 font-normal mt-0.5">$75/seat/mo</p>
                    </th>
                    <th className="text-center py-4 px-4 w-[20%] bg-[#FFF8F5] dark:bg-[#C94C1E]/10 backdrop-blur-sm">
                      <span className="text-[14px] font-semibold text-[#C94C1E]">Business</span>
                      <p className="text-[12px] text-[#C94C1E]/70 font-normal mt-0.5">$250/seat/mo</p>
                    </th>
                    <th className="text-center py-4 px-4 w-[20%] bg-white dark:bg-slate-900/50 backdrop-blur-sm">
                      <span className="text-[14px] font-semibold text-slate-600 dark:text-slate-300">Enterprise</span>
                      <p className="text-[12px] text-slate-400 font-normal mt-0.5">Custom</p>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {COMPARE_SECTIONS.map(section => (
                    <>
                      <tr key={section.title}>
                        <td colSpan={4} className="pt-6 pb-2">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            {section.title}
                          </span>
                        </td>
                      </tr>
                      {section.rows.map(row => (
                        <tr key={row.feature} className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 pr-4 text-[13px] text-slate-600 dark:text-slate-400">{row.feature}</td>
                          <td className="py-3.5 px-4 text-center"><CellValue val={row.starter} /></td>
                          <td className="py-3.5 px-4 text-center bg-[#C94C1E]/[0.02] dark:bg-[#C94C1E]/[0.04]"><CellValue val={row.business} /></td>
                          <td className="py-3.5 px-4 text-center"><CellValue val={row.enterprise} /></td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CTA below table */}
            <div className="flex items-center justify-center gap-4 mt-12">
              <button
                onClick={() => openModal('early-access')}
                className="px-8 py-3 rounded-xl text-[14px] font-semibold bg-[#C94C1E] text-white shadow-[0_2px_10px_rgba(201,76,30,0.35)] hover:shadow-[0_6px_20px_rgba(201,76,30,0.5)] transition-all"
              >
                Start free trial
              </button>
              <button
                onClick={() => openModal('talk-to-sales')}
                className="px-8 py-3 rounded-xl text-[14px] font-semibold border border-slate-300 dark:border-white/[0.15] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all"
              >
                Talk to sales
              </button>
            </div>
          </div>
        </section>

        {/* ── FAQ Section ──────────────────────────────────────────────── */}
        <section className="py-20 px-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-white/[0.06]">
          <div className="max-w-[680px] mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-[clamp(24px,3vw,38px)] font-normal tracking-[-0.02em] text-slate-900 dark:text-white mb-3">
                Frequently asked questions
              </h2>
              <p className="text-[15px] text-slate-500 dark:text-slate-400">
                Can&apos;t find what you&apos;re looking for?{' '}
                <button onClick={() => openModal('talk-to-sales')} className="text-[#C94C1E] font-medium hover:underline">
                  Contact us
                </button>
              </p>
            </div>

            <div>
              {FAQS.map(faq => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ───────────────────────────────────────────────── */}
        <section className="py-20 px-6 bg-white dark:bg-slate-900/50 border-t border-slate-200 dark:border-white/[0.06]">
          <div className="max-w-[600px] mx-auto text-center">
            <h2 className="text-[clamp(22px,3vw,32px)] font-normal tracking-[-0.02em] text-slate-900 dark:text-white mb-3">
              Ready to find your next D2C customer?
            </h2>
            <p className="text-[15px] text-slate-500 dark:text-slate-400 mb-8">
              Join 200+ sales teams already using Harvin to close D2C deals faster.
            </p>
            <button
              onClick={() => openModal('early-access')}
              className="px-10 py-3.5 rounded-xl text-[15px] font-semibold bg-[#C94C1E] text-white shadow-[0_2px_10px_rgba(201,76,30,0.35)] hover:shadow-[0_6px_20px_rgba(201,76,30,0.5)] transition-all"
            >
              Start your free trial
            </button>
            <p className="mt-4 text-[13px] text-slate-400">14 days free · No credit card required</p>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
