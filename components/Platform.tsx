'use client';

import { useEffect, useRef, useState } from 'react';
import { Bookmark, BarChart3, Search, Zap, Monitor, Check, ArrowUpRight, TrendingUp, Bell } from 'lucide-react';

/* ── Watchlist demo rows ─────────────────────────────────────────────────── */
const WATCHLIST_ROWS = [
  { color: '#EF4444', name: 'Competitor Customers', signals: 5, trend: '+12%' },
  { color: '#3B82F6', name: 'Recently Funded', signals: 12, trend: '+34%' },
  { color: '#22C55E', name: 'Greenfield Opportunities', signals: 8, trend: '+18%' },
  { color: '#F59E0B', name: 'Our Customers', signals: 3, trend: '+5%' },
];

/* ── Module cards ────────────────────────────────────────────────────────── */
const MODULES: {
  icon: typeof BarChart3;
  title: string;
  desc: string;
  bullets: string[];
  stat: string;
  statLabel: string;
  span: string; // grid col span class
}[] = [
  {
    icon: BarChart3,
    title: 'Market Intelligence',
    desc: 'Weekly D2C market trends — funding activity, omnichannel expansion, app adoption, and category momentum. The context that makes you the smartest person on the call.',
    bullets: [
      'Funding rounds tracked in real-time',
      'Category trend analysis',
      'Geographic expansion tracking',
    ],
    stat: '2,400+',
    statLabel: 'signals tracked weekly',
    span: 'md:col-span-7',
  },
  {
    icon: Search,
    title: 'Account Explorer',
    desc: 'The most comprehensive D2C database. Filter by geography, category, business model, scale, tech stack, and funding status.',
    bullets: [
      'D2C-specific taxonomy',
      'Priority scores per account',
      '13 advanced filter categories',
    ],
    stat: '500K+',
    statLabel: 'D2C brands indexed',
    span: 'md:col-span-5',
  },
  {
    icon: Zap,
    title: 'Smart Alerts',
    desc: 'Push signals directly to Slack, email, or your CRM. Know the moment a target account fires a buying signal.',
    bullets: [
      'Slack integration',
      'Weekly email digests',
      'Custom trigger rules',
    ],
    stat: '<5 min',
    statLabel: 'average alert latency',
    span: 'md:col-span-5',
  },
  {
    icon: Monitor,
    title: 'Tech Stack Intelligence',
    desc: 'See exactly which ecommerce platform, CRM, payment gateway, and marketing tools every D2C brand uses. Powered by our TechScanner with 4,000+ signatures.',
    bullets: [
      '4,000+ technologies detected',
      'Competitive displacement insights',
      'Migration & adoption signals',
    ],
    stat: '4,000+',
    statLabel: 'tech signatures',
    span: 'md:col-span-7',
  },
];

/* ── Scroll fade-in hook ─────────────────────────────────────────────────── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

export default function Platform() {
  const header = useFadeIn();
  const hero = useFadeIn();
  const grid = useFadeIn();

  return (
    <section className="relative py-24 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-white/[0.06] overflow-hidden">

      {/* Subtle radial accent */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(201,76,30,0.05),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(201,76,30,0.08),transparent_70%)]" />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        ref={header.ref}
        className={`px-6 pb-14 transition-all duration-700 ${header.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      >
        <div className="max-w-[720px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#C94C1E]/20 bg-[#C94C1E]/[0.06] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C94C1E] animate-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C94C1E]">
              Platform
            </span>
          </div>
          <h2 className="text-[clamp(28px,4.2vw,48px)] font-semibold leading-[1.08] tracking-[-0.025em] text-slate-900 dark:text-white mb-4">
            Everything you need to own<br />the D2C market
          </h2>
          <p className="text-[16px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-[520px] mx-auto">
            Four integrated modules that give your team an unfair advantage — from discovery to deal close.
          </p>
        </div>
      </div>

      {/* ── Watchlists — hero card ─────────────────────────────────── */}
      <div
        ref={hero.ref}
        className={`px-6 pb-10 transition-all duration-700 delay-100 ${hero.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-[960px] mx-auto">
          <div className="group relative rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-gradient-to-br from-white via-white to-slate-50/80 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-900/40 p-8 md:p-10 lg:p-12 flex flex-col md:flex-row gap-8 md:gap-14 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-none dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-shadow duration-500">

            {/* Left — text */}
            <div className="flex-1 min-w-0">
              <div className="h-12 w-12 rounded-xl bg-[#C94C1E]/10 flex items-center justify-center mb-6 ring-1 ring-[#C94C1E]/10">
                <Bookmark size={22} className="text-[#C94C1E]" />
              </div>
              <h3 className="text-[28px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white mb-2">
                Watchlists
              </h3>
              <p className="text-[14px] leading-relaxed text-slate-500 dark:text-slate-400 mb-7 max-w-[380px]">
                The core of HarvinAI. Create custom watchlists for competitive tracking, churn monitoring, deal sourcing, or prospect management. Get alerted the moment something changes.
              </p>
              <ul className="space-y-3.5">
                {[
                  'Build from filters, manual add, or CSV import',
                  'Real-time Slack and email alerts',
                  'Aggregate trends across your watchlist',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-[14px] text-slate-700 dark:text-slate-300">
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-[#C94C1E]/10 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-[#C94C1E]" strokeWidth={2.5} />
                    </div>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — watchlist preview */}
            <div className="flex-1 min-w-0 flex items-center justify-center">
              <div className="w-full max-w-[380px]">
                {/* Mini header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <Bell size={13} className="text-slate-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">Active Watchlists</span>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>
                <div className="rounded-xl bg-slate-900 dark:bg-slate-800/90 p-2.5 space-y-2 shadow-[0_4px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                  {WATCHLIST_ROWS.map((row, i) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between rounded-lg bg-white/[0.06] hover:bg-white/[0.1] px-4 py-3 transition-colors cursor-default"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-white/10"
                          style={{ backgroundColor: row.color }}
                        />
                        <span className="text-[13px] font-medium text-slate-200">{row.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-0.5">
                          <TrendingUp size={10} />{row.trend}
                        </span>
                        <span className="text-[12px] font-semibold text-[#C94C1E] bg-[#C94C1E]/10 px-2 py-0.5 rounded-md">
                          {row.signals} new
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Summary bar */}
                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">28 total signals this week</span>
                  <span className="text-[11px] font-medium text-[#C94C1E] flex items-center gap-1 cursor-default hover:underline">
                    View all <ArrowUpRight size={10} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Module grid (2×2) ──────────────────────────────────────── */}
      <div
        ref={grid.ref}
        className={`px-6 transition-all duration-700 delay-200 ${grid.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-[960px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-5">
          {MODULES.map((mod, i) => (
            <div
              key={mod.title}
              className={`group relative rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-900/60 p-8 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-500 hover:border-slate-300 dark:hover:border-white/[0.12] ${mod.span}`}
              style={{ transitionDelay: `${i * 75}ms` }}
            >
              {/* Icon + stat row */}
              <div className="flex items-start justify-between mb-5">
                <div className="h-12 w-12 rounded-xl bg-[#C94C1E]/10 flex items-center justify-center ring-1 ring-[#C94C1E]/10 group-hover:bg-[#C94C1E]/[0.14] transition-colors">
                  <mod.icon size={22} className="text-[#C94C1E]" />
                </div>
                <div className="text-right">
                  <p className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white leading-none">{mod.stat}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{mod.statLabel}</p>
                </div>
              </div>

              <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-white mb-2">
                {mod.title}
              </h3>
              <p className="text-[14px] leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
                {mod.desc}
              </p>

              {/* Divider */}
              <div className="h-px bg-slate-100 dark:bg-white/[0.06] mb-5" />

              <ul className="space-y-3">
                {mod.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[14px] text-slate-700 dark:text-slate-300">
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-[#C94C1E]/10 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-[#C94C1E]" strokeWidth={2.5} />
                    </div>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
