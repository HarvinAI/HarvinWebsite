/* ── Hero.tsx ─────────────────────────────────────────────────────────────── */
'use client';

import { useModal } from '@/components/ModalContext';

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

const BRANDS = [
  { initial: 'P', bg: '#C94C1E', name: 'Plum Goodness',   sub: 'Beauty · Mumbai',       score: 94, tag: 'Funding',   signal: 'Got funded for $8.2M in Series B from Faering Capital', ago: '2d ago' },
  { initial: 'B', bg: '#1A9A82', name: 'Bombay Shaving',  sub: 'Grooming · Delhi',      score: 87, tag: 'Expansion', signal: '3 new retail stores opened in Bangalore',               ago: '4d ago' },
  { initial: 'M', bg: '#343330', name: 'Mokobara',        sub: 'Luggage · Bangalore',   score: 82, tag: 'Hiring',    signal: 'Hired a VP of Growth — tool purchases expected in 90d', ago: '5d ago' },
  { initial: 'S', bg: '#A93D18', name: 'Sugar Cosmetics', sub: 'Beauty · Mumbai',       score: 91, tag: 'Digital',   signal: 'Launched Android app — now live on iOS + Android',      ago: '1d ago' },
  { initial: 'N', bg: '#4A4842', name: 'Noise',           sub: 'Electronics · Gurgaon', score: 88, tag: 'Funding',   signal: 'Raised $12M in Series C — greenfield opportunity',       ago: '3d ago' },
  { initial: 'W', bg: '#6E6B63', name: 'Wakefit',         sub: 'Home · Bangalore',      score: 79, tag: 'Expansion', signal: '5 new experience centres opened in tier-2 cities',       ago: '6d ago' },
];

const TAG_COLORS: Record<string, string> = {
  Funding:   'bg-amber-50  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400',
  Expansion: 'bg-teal-50   text-teal-700   dark:bg-teal-900/30   dark:text-teal-400',
  Hiring:    'bg-blue-50   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400',
  Digital:   'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

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
        <div className="text-center px-6 pt-16 pb-12">
          <h1 className="font-display font-normal tracking-[-0.02em] leading-[1.08] mb-6
                         text-[clamp(40px,6vw,76px)]
                         text-slate-900 dark:text-slate-50">
            Never miss a<br />
            <em className="not-italic text-ember-500">D2C opportunity</em>
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

        {/* Brand cards */}
        <div className="relative px-4 pb-16 overflow-hidden">

          {/* Edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-20 z-10
                          bg-gradient-to-r from-slate-50 dark:from-slate-950 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-20 z-10
                          bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent" />

          <div className="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BRANDS.map((b, i) => (
              <div
                key={i}
                className="rounded-card p-4 border transition-all duration-200 cursor-pointer
                           bg-white dark:bg-slate-800/40
                           border-slate-200 dark:border-white/[0.07]
                           shadow-[0_1px_4px_rgba(0,0,0,0.05)] dark:shadow-none
                           hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:border-white/[0.14]
                           hover:-translate-y-0.5"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0
                                 text-white font-sans font-bold text-[15px]"
                      style={{ backgroundColor: b.bg }}
                    >
                      {b.initial}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
                        {b.name}
                      </p>
                      <p className="text-[12px] font-sans text-slate-400 dark:text-slate-500">
                        {b.sub}
                      </p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-[13px] font-bold font-mono text-ember-500
                                   bg-ember-50 dark:bg-ember-900/20 px-2 py-0.5 rounded-md">
                    {b.score}
                  </span>
                </div>

                {/* Signal */}
                <p className="text-[13px] leading-relaxed mb-3 text-slate-600 dark:text-slate-400">
                  {b.signal}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TAG_COLORS[b.tag]}`}>
                    {b.tag}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-600">
                    {b.ago}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="max-w-[1100px] mx-auto mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: '50K+',  label: 'D2C brands tracked' },
              { value: '101',   label: 'Tools detected'      },
              { value: '30+',   label: 'Markets covered'     },
              { value: 'Daily', label: 'Signal updates'      },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="font-display font-normal leading-none text-slate-900 dark:text-slate-100
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
      </main>
    </>
  );
}
