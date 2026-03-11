/* ── Hero.tsx ─────────────────────────────────────────────────────────────── */
'use client';

import { useModal } from '@/components/ModalContext';
import TechScanner from '@/components/TechScanner';

const TICKER: { brand: string; signal: string }[] = [
  { brand: 'Plum Goodness',   signal: 'got funded for $8.2M in Series B'              },
  { brand: 'Bombay Shaving',  signal: 'opened 3 new stores in Bangalore'              },
  { brand: 'Noise',           signal: 'raised $12M in Series C'                       },
  { brand: 'Sugar Cosmetics', signal: 'launched its Android app'                      },
  { brand: 'Mokobara',        signal: 'hired a VP of Growth'                          },
  { brand: 'Wakefit',         signal: 'opened 5 new experience centres in tier-2 cities' },
  { brand: 'Mamaearth',       signal: 'relaunched its D2C channel'                    },
  { brand: 'boAt',            signal: 'launched a new accessories line'               },
  { brand: 'Lenskart',        signal: 'crossed 500+ stores across India'              },
  { brand: 'MyGlamm',         signal: 'raised Series D from L\'Oréal'                 },
];


export default function Hero() {
  const { openModal } = useModal();
  return (
    <>
      {/* ── Ticker ──────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-white/[0.06]
                      bg-white/70 dark:bg-white/[0.02] overflow-hidden h-10 flex items-center">
        <div className="flex animate-marquee whitespace-nowrap hover:[animation-play-state:paused]">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-5 text-[12.5px] font-sans">
              <span className="font-semibold text-ember-500">{item.brand}</span>
              <span className="text-slate-500 dark:text-slate-400">{item.signal}</span>
              <span className="text-slate-300 dark:text-slate-700 mx-2">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <main>
        {/* Headline + CTA */}
        <div className="text-center px-6 pt-16 pb-6">
          <h1 className="font-sans font-bold tracking-[-0.02em] leading-[1.08] mb-6
                         text-[clamp(30px,6vw,76px)]
                         text-slate-900 dark:text-slate-50">
            Know which <em className="not-italic text-ember-500">D2C brands</em> <br/> <em className="not-italic text-ember-500">to sell to and</em>
            <em className="not-italic text-ember-500"> when</em>
          </h1>

          <button
            onClick={() => openModal('early-access')}
            className="inline-flex items-center px-8 py-3 rounded-full text-[15px] font-semibold
                       text-white bg-ember-500 shadow-[0_2px_8px_rgba(201,76,30,0.35)]
                       hover:bg-ember-400 hover:shadow-[0_6px_20px_rgba(201,76,30,0.45)]
                       transition-all duration-200"
          >
            Get early access
          </button>
        </div>

        {/* ── Tech Scanner ─────────────────────────────────────────────── */}
        <TechScanner />

        {/* Dashboard Preview — mirrors the real dashboard */}
        <div className="px-4 pb-16">

          {/* Browser frame wrapper (relative for fade) */}
          <div className="relative max-w-[1200px] mx-auto">
          {/* Browser window frame */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-900 shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden">

            {/* Title bar */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/[0.1] text-[12px] text-slate-400 dark:text-slate-500 font-mono">
                  app.harvin.ai/explorer
                </div>
              </div>
              <div className="w-[42px]" />
            </div>

            {/* Dashboard layout: nav | filters | content */}
            <div className="flex" style={{ minHeight: 540 }}>

              {/* ── Nav Sidebar ──────────────────────────────────────── */}
              <div className="w-[180px] border-r border-slate-100 dark:border-white/[0.06] bg-white dark:bg-slate-900 py-4 px-3 flex-shrink-0 hidden lg:flex flex-col">
                {/* Logo */}
                <div className="flex items-center gap-2 px-2 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-[#C94C1E] flex items-center justify-center"><span className="text-white text-[11px] font-bold">H</span></div>
                  <span className="font-bricolage font-bold text-[14px] tracking-normal text-slate-800 dark:text-white leading-none">Harvin<span className="font-semibold opacity-40">AI</span></span>
                </div>

                <p className="px-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Intelligence</p>
                {[
                  { label: 'Market Intelligence', active: false },
                  { label: 'Account Explorer', active: true },
                ].map(n => (
                  <div key={n.label} className={`flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-[12px] mb-0.5 ${n.active ? 'bg-[#C94C1E]/10 text-[#C94C1E] font-semibold' : 'text-slate-500'}`}>
                    <span className="w-4 text-center">{n.active ? '🔍' : '📊'}</span>{n.label}
                  </div>
                ))}

                <p className="px-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-4 mb-1.5">Watchlists</p>
                {[
                  { label: 'My Watchlists', badge: '' },
                  { label: 'Recently Funded', badge: 'Active' },
                  { label: 'Competitor Clients', badge: 'Active' },
                  { label: 'Current Clients', badge: 'Active' },
                ].map(n => (
                  <div key={n.label} className="flex items-center gap-2 px-2.5 py-[7px] text-[12px] text-slate-500">
                    <span className="w-4 text-center text-[11px]">📋</span>
                    <span className="truncate">{n.label}</span>
                    {n.badge && <span className="ml-auto text-[8px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">{n.badge}</span>}
                  </div>
                ))}

                <p className="px-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-4 mb-1.5">Settings</p>
                {['ICP & Preferences', 'Integrations'].map(n => (
                  <div key={n} className="flex items-center gap-2 px-2.5 py-[7px] text-[12px] text-slate-500">
                    <span className="w-4 text-center text-[11px]">⚙️</span>{n}
                  </div>
                ))}

                {/* User avatar at bottom */}
                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-2 px-2">
                  <div className="w-7 h-7 rounded-full bg-[#C94C1E] flex items-center justify-center text-white text-[11px] font-bold">H</div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">Harvin AI</p>
                    <p className="text-[9px] text-slate-400 truncate">admin@harvin.ai</p>
                  </div>
                </div>
              </div>

              {/* ── Filter Panel ─────────────────────────────────────── */}
              <div className="w-[220px] border-r border-slate-100 dark:border-white/[0.06] bg-white dark:bg-slate-900/50 py-4 px-3 flex-shrink-0 hidden md:block overflow-y-auto">
                <div className="flex items-center gap-1.5 px-1 mb-3">
                  <span className="text-[#C94C1E] text-[12px]">▼</span>
                  <span className="text-[13px] font-bold text-slate-700 dark:text-white">Filters</span>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]">🔍</span>
                  <div className="w-full pl-7 pr-3 py-[6px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] rounded-lg text-[11px] text-slate-400">Search brands...</div>
                </div>

                {/* Basics */}
                <p className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">Basics</p>

                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide mb-1">Category</p>
                <div className="mb-3 px-1 py-[6px] border border-slate-200 dark:border-white/[0.08] rounded-lg text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span className="text-[10px]">＋</span> Select Categories
                </div>

                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide mb-1">Country</p>
                <div className="relative mb-1.5">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">🔍</span>
                  <div className="w-full pl-6 pr-2 py-[5px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] rounded-md text-[10px] text-slate-400">Search country...</div>
                </div>
                {['Australia', 'Brazil', 'EU', 'Germany', 'Global'].map(c => (
                  <div key={c} className="flex items-center justify-between px-1 py-[4px] text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400">{c}</span>
                    <span className="text-[9px] text-slate-400 font-medium">Include</span>
                  </div>
                ))}

                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide mt-3 mb-1">State</p>
                <div className="relative mb-1.5">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">🔍</span>
                  <div className="w-full pl-6 pr-2 py-[5px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] rounded-md text-[10px] text-slate-400">Search state...</div>
                </div>
                {['Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu'].map(s => (
                  <div key={s} className="flex items-center justify-between px-1 py-[4px] text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400">{s}</span>
                    <span className="text-[9px] text-slate-400 font-medium">Include</span>
                  </div>
                ))}

                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide mt-3 mb-1">City</p>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">🔍</span>
                  <div className="w-full pl-6 pr-2 py-[5px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] rounded-md text-[10px] text-slate-400">Search city...</div>
                </div>
              </div>

              {/* ── Main Content Area ────────────────────────────────── */}
              <div className="flex-1 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col min-w-0">
                {/* Header bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-white/[0.06] bg-white/80 dark:bg-slate-900/80 flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#C94C1E]" />
                    <h2 className="text-[16px] font-bold text-slate-800 dark:text-white">Account Explorer</h2>
                    <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">3,924 results</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500 border border-slate-200 dark:border-white/[0.1] px-2.5 py-1 rounded-md flex items-center gap-1">↕ Sort</span>
                    <span className="text-[11px] font-medium text-slate-500 border border-slate-200 dark:border-white/[0.1] px-2.5 py-1 rounded-md flex items-center gap-1">↓ Export</span>
                  </div>
                </div>

                {/* Select all bar */}
                <div className="px-5 py-2 flex items-center gap-2 text-[11px] text-slate-400 border-b border-slate-50 dark:border-white/[0.03] flex-shrink-0">
                  <div className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600" /> Select all
                </div>

                {/* Account cards */}
                <div className="flex-1 overflow-hidden px-4 py-3 space-y-2.5">
                  {[
                    { name: 'Mamaearth', cat: 'Beauty & Personal Care', region: 'US', model: 'Pure D2C', tech: 8, signals: 1, traffic: '2M+', app: 'iOS Only', stores: '', funding: 'Late Stage', signalText: 'New Product Launch', techTags: ['Meta Pixel', 'Hotjar', 'Google Analytics'], initial: 'M', bg: '#C94C1E' },
                    { name: 'Bunnings', cat: 'Unknown', region: 'Australia', model: 'Omnichannel', tech: 9, signals: 2, traffic: '<100K', app: 'Android Only', stores: '', funding: 'Bootstrapped', signalText: 'Recently Funded · New Product Launch', techTags: ['Shiprocket', 'Shopify', 'Freshdesk'], initial: 'B', bg: '#1A9A82' },
                    { name: 'Ikea', cat: 'Home & Living', region: 'India', model: 'Omnichannel', tech: 29, signals: 2, traffic: '<100K', app: 'Android Only', stores: '1-10', funding: 'Bootstrapped', signalText: 'New Product Launch · Tech Migration', techTags: ['Meta Pixel', 'Hotjar', 'Google Analytics'], initial: 'I', bg: '#0058A3' },
                  ].map(card => (
                    <div key={card.name} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden hover:border-slate-300 transition-all">
                      <div className="flex">
                        {/* Checkbox */}
                        <div className="w-10 flex items-start justify-center pt-4 border-r border-slate-100 dark:border-white/[0.04] flex-shrink-0">
                          <div className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600" />
                        </div>

                        {/* Card body */}
                        <div className="flex-1 px-4 py-3 min-w-0">
                          {/* Row 1: Name + tech + signals + tech badges */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: card.bg }}>{card.initial}</div>
                            <span className="text-[14px] font-bold text-slate-800 dark:text-white">{card.name}</span>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">⊞ {card.tech} tech</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">{card.signals} signal{card.signals > 1 ? 's' : ''}</span>
                            <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                              {card.techTags.map(t => (
                                <span key={t} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-white/[0.08] text-[9px] font-semibold text-slate-600 dark:text-slate-300">{t}</span>
                              ))}
                              <span className="text-[9px] text-slate-400 font-medium">+2</span>
                            </div>
                          </div>

                          {/* Row 2: Category · Region · Model */}
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 ml-10">{card.cat} · {card.region} · {card.model}</p>

                          {/* Row 3: Pills */}
                          <div className="flex items-center gap-1.5 ml-10 mb-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-slate-800 text-[9px] font-medium text-slate-600 dark:text-slate-400">📈 {card.traffic} MAU</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-slate-800 text-[9px] font-medium text-slate-600 dark:text-slate-400">📱 {card.app}</span>
                            {card.stores && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-slate-800 text-[9px] font-medium text-slate-600 dark:text-slate-400">🏪 {card.stores} stores</span>}
                          </div>

                          {/* Row 4: Funding + signals */}
                          <div className="flex items-center gap-2.5 ml-10">
                            <span className="text-[10px] font-medium text-green-600 dark:text-green-400">$ {card.funding}</span>
                            {card.signalText.split(' · ').map(s => (
                              <span key={s} className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />{s}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Visit icon */}
                        <div className="w-9 flex items-start justify-center pt-4 border-l border-slate-100 dark:border-white/[0.04] flex-shrink-0">
                          <span className="text-slate-300 text-[12px]">↗</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>

          </div>

          {/* Bottom fade — seamlessly blends card into stats */}
          <div className="pointer-events-none absolute -bottom-1 left-0 right-0 h-56 z-20 bg-gradient-to-t from-slate-50 dark:from-slate-950 from-5% via-slate-50/95 dark:via-slate-950/95 via-35% to-transparent" />

          {/* Stats — overlaps fade so card + stats feel unified */}
          <div className="relative z-30 max-w-[900px] mx-auto -mt-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: '500K+', label: 'D2C brands tracked' },
              { value: '101',   label: 'Tools detected'      },
              { value: '30+',   label: 'Markets covered'     },
              { value: 'Daily', label: 'Signal updates'      },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="font-sans font-normal leading-none text-slate-900 dark:text-slate-100
                               text-[clamp(28px,4vw,40px)]">
                  {value}
                </p>
                <p className="mt-1 text-[13px] font-sans text-slate-400 dark:text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
          </div>
        </div>
      </main>
    </>
  );
}
