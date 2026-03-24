'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';

/* ── Scroll fade-in hook ─────────────────────────────────────────────────── */
function useFadeIn(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ── Module data ─────────────────────────────────────────────────────────── */
const MODULES = [
  {
    title: 'Account Explorer',
    desc: 'Search and filter our database of D2C brands. Narrow down by geography, category, tech stack, funding stage, traffic band, or business model.',
    details: ['523K brands indexed', '13 filter dimensions', 'Priority score per account'],
    stat: '523K',
    statLabel: 'brands',
    screenshot: '/dashboard-preview.png',
    screenshotDark: '/dashboard-preview-dark.png',
  },
  {
    title: 'Tech Stack Scanner',
    desc: 'Scan any website to detect their ecommerce platform, CRM, payment stack, analytics, and marketing tools. Useful for competitive displacement.',
    details: ['4,218 technologies', 'Competitor displacement', 'Migration signals'],
    stat: '4,218',
    statLabel: 'techs',
    screenshot: '/tech-scanner.png',
    screenshotDark: '/tech-scanner-dark.png',
  },
  {
    title: 'Watchlists',
    desc: 'Group brands into lists — competitor customers, recently funded, greenfield targets. Get alerted the second something changes.',
    details: ['Filters, manual, or CSV import', 'Slack & email alerts', 'Aggregate trends per list'],
    stat: 'Real-time',
    statLabel: 'alerts',
    screenshot: '/Watchlist.png',
    screenshotDark: '/Watchlist-dark.png',
  },
  {
    title: 'LookALike Brands',
    desc: 'Find brands similar to your best customers. Enter a domain and discover lookalike companies by category, tech stack, scale, and region.',
    details: ['AI-powered matching', 'Category & tech overlap', 'Scale-aware suggestions'],
    stat: 'Smart',
    statLabel: 'matching',
    screenshot: '/Look-a-Like.png',
    screenshotDark: '/Look-a-Like-dark.png',
  },
];

export default function Platform() {
  const header = useFadeIn();
  const { isDark } = useTheme();

  return (
    <section className="relative py-28 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-white/[0.06] overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        ref={header.ref}
        className={`px-6 pb-20 transition-all duration-700 ${header.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      >
        <div className="max-w-[720px] mx-auto text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 mb-5">
            The Platform
          </p>
          <h2 className="text-[clamp(28px,4.2vw,48px)] font-semibold leading-[1.08] tracking-[-0.025em] text-slate-900 dark:text-white mb-4">
            What&rsquo;s inside
          </h2>
          <p className="text-[16px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-[480px] mx-auto">
            Four modules. One platform. Built for sales teams who sell to D2C brands.
          </p>
        </div>
      </div>

      {/* ── Modules ──────────────────────────────────────────────── */}
      <div className="max-w-[1100px] mx-auto px-6">
        {MODULES.map((mod, i) => (
          <ModuleRow key={mod.title} mod={mod} index={i} flipped={i % 2 !== 0} isDark={isDark} />
        ))}
      </div>
    </section>
  );
}

/* ── Single module row — alternates text left / screenshot right ──────── */
function ModuleRow({ mod, index, flipped, isDark }: {
  mod: typeof MODULES[number];
  index: number;
  flipped: boolean;
  isDark: boolean;
}) {
  const row = useFadeIn(0.15);

  return (
    <div
      ref={row.ref}
      className={`flex flex-col ${flipped ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10 md:gap-12 lg:gap-16 mb-14 sm:mb-18 lg:mb-24 last:mb-0
                   transition-all duration-700 ${row.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {/* ── Text side ── */}
      <div className="flex-1 min-w-0 max-w-lg">
        {/* Number + stat row */}
        <div className="flex items-center gap-4 mb-5">
          <span className="text-[32px] sm:text-[40px] lg:text-[48px] font-bold text-slate-100 dark:text-white/[0.06] leading-none font-mono select-none">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <p className="text-[24px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              {mod.stat}
            </p>
            <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
              {mod.statLabel}
            </p>
          </div>
        </div>

        <h3 className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white mb-3 leading-tight">
          {mod.title}
        </h3>

        <p className="text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
          {mod.desc}
        </p>

        {/* Detail pills */}
        <div className="flex flex-wrap gap-2">
          {mod.details.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium
                         text-slate-600 dark:text-slate-300
                         px-3 py-1.5 rounded-lg
                         bg-slate-50 dark:bg-white/[0.04]
                         border border-slate-200 dark:border-white/[0.06]"
            >
              <span className="w-1 h-1 rounded-full bg-[#C94C1E] flex-shrink-0" />
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* ── Screenshot side ── */}
      <div className="flex-1 min-w-0 w-full md:max-w-[440px] lg:max-w-[520px]">
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)] bg-slate-50 dark:bg-white/[0.02]">
          {/*
            Add a screenshot for each module:
            /public/platform-explorer.png
            /public/platform-scanner.png
            /public/platform-watchlists.png
            /public/platform-intel.png
            /public/platform-alerts.png
          */}
          <img
            src={isDark ? mod.screenshotDark : mod.screenshot}
            alt={`${mod.title} — HarvinAI`}
            className="w-full h-auto block"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
