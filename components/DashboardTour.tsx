'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const TOUR_STORAGE_KEY = 'harvin_tour_completed';

interface TourStep {
  target: string;
  title: string;
  desc: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: TourStep[] = [
  {
    target: '[data-tour="filters"]',
    title: 'Filter & find brands',
    desc: 'Narrow down 500K+ D2C brands by category, country, funding stage, tech stack, and more.',
    position: 'right',
  },
  {
    target: '[data-tour="search"]',
    title: 'Search any brand',
    desc: 'Type a brand name or domain to instantly find it.',
    position: 'bottom',
  },
  {
    target: '[data-tour="account-list"]',
    title: 'Your matched accounts',
    desc: 'Each card shows category, tech stack, traffic, and signals. Click any card to see the full profile.',
    position: 'left',
  },
  {
    target: '[data-tour="sort-export"]',
    title: 'Sort & export',
    desc: 'Sort by any column, or export your list as CSV for your CRM.',
    position: 'bottom',
  },
  {
    target: '[data-tour="watchlists"]',
    title: 'Save to watchlists',
    desc: 'Group brands into custom lists. Get alerts when something changes.',
    position: 'right',
  },
  {
    target: '[data-tour="tech-scanner"]',
    title: 'Scan any website',
    desc: 'Paste any URL to see its full tech stack — 4,000+ tools detected.',
    position: 'right',
  },
];

function clamp(val: number, min: number, max: number) { return Math.min(max, Math.max(min, val)); }

export default function DashboardTour({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(-1);
  const [visible, setVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [highlight, setHighlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<React.CSSProperties>({});
  const rafRef = useRef(0);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { if (localStorage.getItem(TOUR_STORAGE_KEY) === '1') return; } catch {}
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Measure target + calculate safe tooltip position
  const measure = useCallback(() => {
    if (step < 0 || step >= STEPS.length) { setHighlight(null); return; }
    const el = document.querySelector(STEPS[step].target);
    if (!el) { setHighlight(null); return; }

    const r = el.getBoundingClientRect();
    const pad = 8;
    setHighlight({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Calculate tooltip position with viewport clamping
    requestAnimationFrame(() => {
      const tw = Math.min(320, window.innerWidth - 32); // tooltip width, clamped for mobile
      const th = tooltipRef.current?.offsetHeight || 200;
      const gap = 16;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pos = STEPS[step].position;

      let top = 0, left = 0;

      if (pos === 'right' && r.right + gap + tw < vw) {
        top = clamp(r.top + r.height / 2 - th / 2, 12, vh - th - 12);
        left = r.right + gap;
      } else if (pos === 'left' && r.left - gap - tw > 0) {
        top = clamp(r.top + r.height / 2 - th / 2, 12, vh - th - 12);
        left = r.left - gap - tw;
      } else if (pos === 'bottom' && r.bottom + gap + th < vh) {
        top = r.bottom + gap;
        left = clamp(r.left + r.width / 2 - tw / 2, 12, vw - tw - 12);
      } else if (pos === 'top' && r.top - gap - th > 0) {
        top = r.top - gap - th;
        left = clamp(r.left + r.width / 2 - tw / 2, 12, vw - tw - 12);
      } else {
        // Fallback: bottom-center of screen
        top = clamp(r.bottom + gap, 12, vh - th - 12);
        left = clamp(r.left + r.width / 2 - tw / 2, 12, vw - tw - 12);
      }

      setTooltipPos({ top, left, width: tw });
    });
  }, [step]);

  useEffect(() => { measure(); }, [measure]);

  useEffect(() => {
    if (step < 0) return;
    const handler = () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(measure); };
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => { window.removeEventListener('resize', handler); window.removeEventListener('scroll', handler, true); cancelAnimationFrame(rafRef.current); };
  }, [step, measure]);

  // Keyboard
  useEffect(() => {
    if (step < 0 || !visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const goToStep = useCallback((idx: number) => {
    if (idx < 0 || idx >= STEPS.length) return;
    setTransitioning(true);
    setTimeout(() => { setStep(idx); setTimeout(() => setTransitioning(false), 50); }, 150);
  }, []);

  const finish = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => { setStep(-1); setVisible(false); try { localStorage.setItem(TOUR_STORAGE_KEY, '1'); } catch {} onComplete?.(); }, 200);
  }, [onComplete]);

  const next = () => { if (step + 1 >= STEPS.length) finish(); else goToStep(step + 1); };
  const prev = () => { if (step > 0) goToStep(step - 1); };

  if (!visible) return null;

  // ── Welcome modal ──
  if (step === -1) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center animate-[tourFadeIn_0.3s_ease]">
        <div className="absolute inset-0 bg-black/30" onClick={finish} />
        <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl max-w-[400px] w-full mx-4 sm:mx-6 overflow-hidden animate-[tourSlideUp_0.4s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="px-7 pt-7 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center flex-shrink-0">
                <span className="text-white dark:text-slate-900 text-[13px] font-bold">H</span>
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-slate-900 dark:text-white leading-tight">
                  Welcome to HarvinAI
                </h2>
                <p className="text-[12px] text-slate-400 dark:text-slate-500">Quick tour · 30 seconds</p>
              </div>
            </div>
            <p className="text-[14px] text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
              We&rsquo;ll walk you through 6 key features so you can start finding D2C brands right away.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => goToStep(0)}
                className="flex-1 py-2.5 rounded-lg text-[14px] font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-[0.98]"
              >
                Start tour
              </button>
              <button
                onClick={finish}
                className="px-4 py-2.5 rounded-lg text-[14px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
        <style>{tourStyles}</style>
      </div>
    );
  }

  // ── Tour step ──
  const currentStep = STEPS[step];

  return (
    <>
      {/* Overlay with cutout */}
      <div className="fixed inset-0 z-[200]" onClick={finish}>
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {highlight && (
                <rect
                  x={highlight.left} y={highlight.top}
                  width={highlight.width} height={highlight.height}
                  rx="12" fill="black"
                  style={{ transition: 'all 0.3s ease' }}
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.35)" mask="url(#tour-mask)" />
        </svg>

        {/* Subtle ring around target */}
        {highlight && (
          <div
            className="absolute rounded-xl pointer-events-none"
            style={{
              top: highlight.top,
              left: highlight.left,
              width: highlight.width,
              height: highlight.height,
              boxShadow: '0 0 0 2px rgba(100,116,139,0.3), 0 0 0 4px rgba(100,116,139,0.08)',
              transition: 'all 0.3s ease',
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`fixed z-[201] bg-white dark:bg-[#1a1a1a] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-slate-200 dark:border-white/[0.08] overflow-hidden transition-all duration-300 ease-out ${
          transitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        style={tooltipPos}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4">
          {/* Step + skip */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {step + 1} / {STEPS.length}
            </span>
            <button onClick={finish} className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              Skip
            </button>
          </div>

          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-1 leading-snug">
            {currentStep.title}
          </h3>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
            {currentStep.desc}
          </p>

          {/* Progress + nav */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1 flex-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-[3px] rounded-full flex-1 transition-all duration-300 ${
                    i <= step ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-white/[0.08]'
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {step > 0 && (
                <button onClick={prev} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}
              <button
                onClick={next}
                className="h-7 px-3 rounded-md text-[12px] font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-[0.97] flex items-center gap-1"
              >
                {step === STEPS.length - 1 ? 'Done' : 'Next'}
                {step < STEPS.length - 1 && (
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{tourStyles}</style>
    </>
  );
}

const tourStyles = `
  @keyframes tourFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tourSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
`;
