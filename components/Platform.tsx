'use client';

import { useEffect, useRef, useState } from 'react';

/* ── Scroll fade-in hook ─────────────────────────────────────────────────── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

/* ── Module data ─────────────────────────────────────────────────────────── */
const MODULES = [
  {
    title: 'Account Explorer',
    desc: 'Search and filter our database of D2C brands. Narrow down by geography, category, tech stack, funding stage, traffic band, or business model.',
    details: ['523K brands indexed', '13 filter dimensions', 'Priority score per account'],
    stat: '523K',
    statLabel: 'brands indexed',
    highlight: true,
    span: 'lg:col-span-7',
  },
  {
    title: 'Tech Stack Scanner',
    desc: 'Scan any website to detect their ecommerce platform, CRM, payment stack, analytics, and marketing tools.',
    details: ['4,218 technologies', 'Competitor displacement', 'Migration signals'],
    stat: '4,218',
    statLabel: 'tech signatures',
    highlight: false,
    span: 'lg:col-span-5',
  },
  {
    title: 'Watchlists',
    desc: 'Group brands into lists — competitor customers, recently funded, greenfield targets. Get alerted the second something changes.',
    details: ['Filters, manual, or CSV import', 'Slack & email alerts', 'Aggregate trends per list'],
    stat: 'Real-time',
    statLabel: 'change alerts',
    highlight: false,
    span: 'lg:col-span-5',
  },
  {
    title: 'Market Intelligence',
    desc: 'Weekly D2C market trends — funding activity, expansion moves, app adoption, and category momentum.',
    details: ['34 markets tracked', 'Category growth trends', 'Store expansion data'],
    stat: '2,847',
    statLabel: 'signals / week',
    highlight: false,
    span: 'lg:col-span-7',
  },
  {
    title: 'Smart Alerts',
    desc: 'Push signals to Slack, email, or your CRM. Know the moment a target account fires a buying signal.',
    details: ['Slack & email delivery', 'Weekly digest', 'Custom trigger rules'],
    stat: '~6 hrs',
    statLabel: 'avg. signal delay',
    highlight: false,
    span: 'lg:col-span-12',
  },
];

export default function Platform() {
  const header = useFadeIn();
  const grid = useFadeIn();

  return (
    <section className="relative py-24 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-white/[0.06] overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        ref={header.ref}
        className={`px-6 pb-14 transition-all duration-700 ${header.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      >
        <div className="max-w-[720px] mx-auto text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 mb-5">
            The Platform
          </p>
          <h2 className="text-[clamp(28px,4.2vw,48px)] font-semibold leading-[1.08] tracking-[-0.025em] text-slate-900 dark:text-white mb-4">
            What&rsquo;s inside
          </h2>
          <p className="text-[16px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-[480px] mx-auto">
            Five modules. One platform. Built for sales teams who sell to D2C brands.
          </p>
        </div>
      </div>

      {/* ── Module grid ──────────────────────────────────────────── */}
      <div
        ref={grid.ref}
        className={`px-6 transition-all duration-700 delay-100 ${grid.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-[960px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
          {MODULES.map((mod, i) => (
            <div
              key={mod.title}
              className={`group relative rounded-2xl overflow-hidden
                         ${mod.highlight
                           ? 'bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-[#C94C1E]/[0.06] dark:to-[#C94C1E]/[0.02] border-[#C94C1E]/20 dark:border-[#C94C1E]/15'
                           : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06]'}
                         border
                         hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)]
                         hover:border-slate-300 dark:hover:border-white/[0.1]
                         transition-all duration-400
                         ${mod.span}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="p-7 sm:p-8">
                {/* Title row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#C94C1E] flex-shrink-0" />
                    <h3 className="text-[19px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                      {mod.title}
                    </h3>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-[22px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">{mod.stat}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{mod.statLabel}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-400 mb-5 max-w-[520px]">
                  {mod.desc}
                </p>

                {/* Detail chips */}
                <div className="flex flex-wrap gap-2">
                  {mod.details.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium
                                 text-slate-700 dark:text-slate-300
                                 px-3 py-1.5 rounded-full
                                 bg-slate-50 dark:bg-white/[0.04]
                                 border border-slate-200 dark:border-white/[0.06]"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
