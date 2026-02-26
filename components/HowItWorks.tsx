'use client';

import { useEffect, useRef, useState } from 'react';

const SLIDE_DURATION = 6000;
const UPDATE_INTERVAL = 50;
const SWIPE_THRESHOLD = 40;

/* ── Custom Styles for Animations ────────────────────────────────────────── */
const styles = `
  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-slide-up-fade {
    animation: slideUpFade 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes subtleFadeIn {
    from { opacity: 0; transform: scale(0.985); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-subtle-fade {
    animation: subtleFadeIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes scanSweep {
    0%   { transform: translateY(6%);  }
    46%  { transform: translateY(80%); }
    54%  { transform: translateY(80%); }
    100% { transform: translateY(6%);  }
  }
  .animate-scan-sweep {
    animation: scanSweep 4.2s cubic-bezier(0.37, 0, 0.63, 1) infinite;
    will-change: transform;
  }
`;

/* ── Step Visual Mockups ─────────────────────────────────────────────────── */

function DiscoverVisual() {
  const brands = [
    { i: 'P', c: '#C94C1E' },
    { i: 'B', c: '#1A9A82' },
    { i: 'S', c: '#A93D18' },
    { i: 'N', c: '#4A4842' },
    { i: 'M', c: '#343330' },
    { i: 'W', c: '#6E6B63' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5">
      <div className="flex h-12 w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 shadow-sm">
        <svg className="h-4 w-4 flex-shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="font-sans text-[13px] font-medium text-gray-500">Beauty · Mumbai · Series B</span>
      </div>

      <div className="grid w-full grid-cols-3 gap-3">
        {brands.map((b, i) => (
          <div
            key={i}
            className={`flex flex-col gap-3 rounded-xl border p-4 transition-all duration-300 ${
              i === 0
                ? 'relative z-10 scale-105 border-[#C94C1E] bg-[#C94C1E]/5 shadow-[0_8px_20px_rgba(201,76,30,0.12)]'
                : 'border-gray-100 bg-white shadow-sm'
            }`}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-bold text-white shadow-sm"
              style={{ backgroundColor: b.c }}
            >
              {b.i}
            </div>
            <div className={`h-1.5 w-3/4 rounded-full ${i === 0 ? 'bg-[#C94C1E]/60' : 'bg-gray-200'}`} />
            <div className={`h-1.5 w-1/2 rounded-full ${i === 0 ? 'bg-[#C94C1E]/40' : 'bg-gray-100'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalsVisual() {
  const signals = [
    { icon: '💰', label: 'Raised $8.2M Series B', brand: 'Plum Goodness', color: '#C94C1E' },
    { icon: '🏪', label: '3 new stores opened', brand: 'Bombay Shaving', color: '#1A9A82' },
    { icon: '👤', label: 'VP Growth hired', brand: 'Mokobara', color: '#64748b' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3 pl-2">
      {signals.map((s, i) => (
        <div key={i} className="relative">
          <div className="relative z-10 flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 text-[20px] leading-none">
              {s.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-gray-900">{s.label}</p>
              <p className="mt-0.5 truncate text-[12px] text-gray-500">{s.brand}</p>
            </div>
            <span
              className="rounded-md border px-2 py-1 font-mono text-[10px] font-semibold"
              style={{ backgroundColor: `${s.color}10`, color: s.color, borderColor: `${s.color}20` }}
            >
              Signal
            </span>
          </div>
          {i < signals.length - 1 && (
            <div className="absolute -bottom-4 left-[35px] z-0 h-5 w-px border-l-2 border-dashed border-gray-300" />
          )}
        </div>
      ))}
    </div>
  );
}

function TimingVisual() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6">
      <div className="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[10px] text-[14px] font-bold text-white shadow-sm"
              style={{ backgroundColor: '#C94C1E' }}
            >
              P
            </div>
            <div>
              <p className="text-[15px] font-bold text-gray-900">Plum Goodness</p>
              <p className="mt-0.5 text-[13px] text-gray-500">Beauty · Mumbai</p>
            </div>
          </div>

          <span className="rounded-lg border border-[#C94C1E]/20 bg-[#C94C1E]/10 px-2.5 py-1 font-mono text-[15px] font-bold text-[#C94C1E]">
            94
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="relative h-full rounded-full bg-gradient-to-r from-[#e87f58] to-[#C94C1E]" style={{ width: '94%' }}>
            <div className="absolute inset-0 animate-pulse bg-white/20" />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-px border-l-2 border-dashed border-[#C94C1E]/40" />
        <div className="flex items-center gap-2.5 rounded-full border border-[#C94C1E]/20 bg-[#C94C1E]/10 px-4 py-2 shadow-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#C94C1E] shadow-[0_0_8px_#C94C1E]" />
          <span className="text-[13px] font-semibold text-[#C94C1E]">Prime buying window</span>
        </div>
      </div>
    </div>
  );
}

function DealVisual() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex flex-1 flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-gray-50">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-gray-700">You</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#C94C1E] shadow-[0_0_20px_rgba(201,76,30,0.3)]">
            <div className="absolute inset-0 animate-ping rounded-full border-2 border-[#C94C1E] opacity-30" />
            <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h8M8 4l5 4-5 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="whitespace-nowrap font-mono text-[10px] font-medium text-[#C94C1E]">perfect timing</span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-3 rounded-xl border border-[#C94C1E]/20 bg-[#C94C1E]/5 p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#C94C1E] text-[14px] font-bold text-white shadow-sm">P</div>
          <p className="text-[13px] font-semibold text-[#C94C1E]">Plum</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2.5 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 shadow-sm">
        <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[13px] font-bold tracking-wide text-emerald-600">Deal closed successfully</span>
      </div>
    </div>
  );
}

/* ── Steps Data ──────────────────────────────────────────────────────────── */
const STEPS = [
  {
    number: '01',
    title: 'Discover the Right Brands',
    desc: 'Search across 500,000+ D2C brands using smart filters — category, location, funding stage, and tech stack.',
    scanLabel: 'Scanning 500,000+ brand profiles',
    Visual: DiscoverVisual,
  },
  {
    number: '02',
    title: 'Track Real-Time Signals',
    desc: 'Get instant alerts on funding rounds, store openings, app launches, and hiring activity — before anyone else.',
    scanLabel: 'Monitoring live buying signals',
    Visual: SignalsVisual,
  },
  {
    number: '03',
    title: 'Identify the Right Moment',
    desc: "Harvin's intelligence score shows exactly when a brand is in a buying window — so you reach out when it matters.",
    scanLabel: 'Calculating intent score',
    Visual: TimingVisual,
  },
  {
    number: '04',
    title: 'Close the Deal',
    desc: 'Engage with full context at the perfect moment. Convert intelligence into revenue — before your competitors notice.',
    scanLabel: 'Initiating outreach sequence',
    Visual: DealVisual,
  },
];

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleNext = () => {
    setActiveStep((prev) => (prev + 1) % STEPS.length);
    setProgress(0);
  };

  const handlePrev = () => {
    setActiveStep((prev) => (prev - 1 + STEPS.length) % STEPS.length);
    setProgress(0);
  };

  useEffect(() => {
    const slideStart = Date.now();

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - slideStart;
      const currentProgress = Math.min(100, (elapsed / SLIDE_DURATION) * 100);
      setProgress(currentProgress);

      if (elapsed >= SLIDE_DURATION) {
        setActiveStep((curr) => (curr + 1) % STEPS.length);
        setProgress(0);
      }
    }, UPDATE_INTERVAL);

    return () => window.clearInterval(timer);
  }, [activeStep]);

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX < 0) handleNext();
    else handlePrev();
  };

  const currentData = STEPS[activeStep];
  const ActiveVisual = currentData.Visual;
  const totalProgress = ((activeStep + progress / 100) / STEPS.length) * 100;

  return (
    <section className="flex min-h-screen w-full flex-col justify-center bg-[#f1f2f4] px-6 py-20 font-sans md:px-10 lg:px-16">
      <style>{styles}</style>

      <div className="mx-auto w-full max-w-[1300px]">
        <div className="mx-auto mb-14 max-w-6xl text-center lg:mb-16">
          <h2 className="text-[24px] font-bold leading-[1.1] tracking-tight text-gray-900 md:text-[36px] lg:text-[36px]">
            How HarvinAI turns signals into signed deals
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-gray-600 md:text-xl">
            Discover high-intent D2C brands, track real-time buying signals, and reach out at the right moment to convert intelligence into revenue.
          </p>
        </div>

        <div
          className="rounded-[28px] border border-gray-200/80 bg-[#f8f8f9] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)] md:p-6 lg:p-7"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: 'pan-y' }}
        >
          <div className="flex flex-col gap-7 lg:flex-row lg:items-stretch lg:gap-8">
            <div className="relative flex w-full flex-col justify-between lg:w-1/2 lg:min-h-[430px] lg:pb-14">
              <div key={activeStep} className="animate-slide-up-fade">
                <div className="mb-4 font-mono text-[22px] font-medium tracking-wide text-gray-400">{currentData.number}</div>
                <h3 className="mb-5 pr-4 text-3xl font-bold leading-[1.2] text-gray-900 md:text-[38px]">{currentData.title}</h3>
                <p className="pr-3 text-[18px] leading-relaxed text-gray-600">{currentData.desc}</p>
              </div>

              <div className="mt-10 flex w-full max-w-[460px] items-center gap-5 lg:absolute lg:bottom-0 lg:left-0">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-300/80">
                  <div className="h-full rounded-full bg-[#C94C1E] transition-all duration-75 ease-linear" style={{ width: `${totalProgress}%` }} />
                </div>

                <div className="flex flex-shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous step"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm transition-all hover:border-[#C94C1E] hover:text-[#C94C1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C94C1E] focus-visible:ring-offset-2"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next step"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm transition-all hover:border-[#C94C1E] hover:text-[#C94C1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C94C1E] focus-visible:ring-offset-2"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

              </div>
            </div>

            <div className="relative flex h-[340px] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)] md:h-[390px] lg:h-[430px] lg:w-1/2 lg:p-6">
              <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_75%_30%,rgba(201,76,30,0.07),transparent_45%),linear-gradient(to_bottom,rgba(248,250,252,0.6),rgba(255,255,255,0.2))]" />
              <div key={activeStep} className="relative z-10 flex h-full w-full animate-subtle-fade items-center justify-center">
                <ActiveVisual />
              </div>
              {/* Scan sweep — translateY % is relative to this element's height (h-full = container height) */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-full animate-scan-sweep">

                {/* Illuminated region below the scan line */}
                <div
                  className="absolute left-0 right-0 top-0 h-[110px]"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(201,76,30,0.13) 0%, rgba(201,76,30,0.06) 60%, transparent 100%)',
                  }}
                />

                {/* Scan line */}
                <div
                  className="absolute left-0 right-0 top-0 h-[1.5px]"
                  style={{
                    background: 'linear-gradient(to right, transparent 2%, rgba(201,76,30,0.7) 15%, #C94C1E 40%, #F48E56 50%, #C94C1E 60%, rgba(201,76,30,0.7) 85%, transparent 98%)',
                    boxShadow: '0 0 6px 1px rgba(201,76,30,0.45), 0 2px 16px rgba(201,76,30,0.2)',
                  }}
                />

                {/* Pill — centered on the scan line */}
                <div
                  className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-3.5 py-[7px]"
                  style={{
                    border: '1.5px solid #C94C1E',
                    boxShadow: '0 2px 14px rgba(201,76,30,0.22), 0 0 0 3px rgba(201,76,30,0.08)',
                  }}
                >
                  <svg className="h-3.5 w-3.5 flex-shrink-0 text-[#C94C1E]" viewBox="0 0 16 16" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.6"/>
                    <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  <span className="text-[11.5px] font-semibold text-slate-800 tracking-wide">
                    {currentData.scanLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
