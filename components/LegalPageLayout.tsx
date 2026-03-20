'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Shield, FileText, RefreshCcw, AlertTriangle, Cookie } from 'lucide-react';

const ICONS: Record<string, React.ReactNode> = {
  privacy: <Shield size={18} />,
  terms: <FileText size={18} />,
  refund: <RefreshCcw size={18} />,
  'acceptable-use': <AlertTriangle size={18} />,
  cookies: <Cookie size={18} />,
};

export default function LegalPageLayout({
  type,
  title,
  lastUpdated,
  children,
}: {
  type: string;
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
        {/* Hero */}
        <div className="relative overflow-hidden bg-slate-50 dark:bg-transparent">
          {/* Decorative gradient orbs */}
          <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#C94C1E]/10 dark:bg-[#C94C1E]/20 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-80px] right-[-100px] w-[300px] h-[300px] rounded-full bg-[#C94C1E]/5 dark:bg-[#C94C1E]/10 blur-[100px] pointer-events-none" />

          <div className="relative max-w-4xl mx-auto px-6 pt-32 pb-16 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[13px] font-semibold text-slate-500 dark:text-white/70 mb-6">
              {ICONS[type] || <FileText size={18} />}
              <span>Legal Document</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              {title}
            </h1>
            <p className="text-[15px] text-slate-400 dark:text-white/40 font-medium">
              Last updated: {lastUpdated}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 pb-24">
          <div className="space-y-6">
            {children}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-sm dark:shadow-none">
      <h2 className="text-[18px] sm:text-[20px] font-bold text-slate-900 dark:text-white mb-4">{title}</h2>
      <div className="text-[15px] text-slate-600 dark:text-white/60 leading-relaxed space-y-3">
        {children}
      </div>
    </div>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 mt-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#C94C1E] mt-2 flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-[#C94C1E] hover:text-[#E86335] underline underline-offset-2 transition-colors">
      {children}
    </a>
  );
}

export function LegalContact() {
  return (
    <div className="bg-gradient-to-br from-[#C94C1E]/5 to-[#C94C1E]/[0.02] dark:from-[#C94C1E]/10 dark:to-[#C94C1E]/5 border border-[#C94C1E]/15 dark:border-[#C94C1E]/20 rounded-2xl p-6 sm:p-8">
      <h2 className="text-[18px] sm:text-[20px] font-bold text-slate-900 dark:text-white mb-4">Contact Us</h2>
      <div className="text-[15px] text-slate-600 dark:text-white/60 leading-relaxed space-y-3">
        <p>If you have any questions about this document, please contact us:</p>
        <div className="space-y-2 mt-4">
          <a href="mailto:admin@harvin.ai" className="flex items-center gap-3 text-[#C94C1E] hover:text-[#E86335] transition-colors font-medium">
            <div className="w-9 h-9 rounded-lg bg-[#C94C1E]/10 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </div>
            admin@harvin.ai
          </a>
          <a href="https://www.harvin.ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[#C94C1E] hover:text-[#E86335] transition-colors font-medium">
            <div className="w-9 h-9 rounded-lg bg-[#C94C1E]/10 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
            </div>
            www.harvin.ai
          </a>
        </div>
      </div>
    </div>
  );
}
