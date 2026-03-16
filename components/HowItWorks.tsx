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

/* ── Step Visual Mockups (live animated, mirrors the actual product) ────── */

const ALL_ACCOUNTS = [
  { domain: 'mamaearth.in', name: 'Mamaearth', cat: 'Beauty · US · Pure D2C', tech: 8, signals: 1, tags: ['Shopify', 'Klaviyo'] },
  { domain: 'bunnings.com.au', name: 'Bunnings', cat: 'Retail · Australia · Omnichannel', tech: 9, signals: 2, tags: ['Shiprocket', 'Shopify'] },
  { domain: 'ikea.com', name: 'Ikea', cat: 'Home · India · Omnichannel', tech: 29, signals: 2, tags: ['Meta Pixel', 'Hotjar'] },
  { domain: 'sugarcosmetics.com', name: 'Sugar', cat: 'Beauty · Mumbai · D2C', tech: 12, signals: 3, tags: ['Shopify', 'WebEngage'] },
  { domain: 'plumgoodness.com', name: 'Plum', cat: 'Beauty · Mumbai · Pure D2C', tech: 15, signals: 1, tags: ['Magento', 'Segment'] },
  { domain: 'gonoise.com', name: 'Noise', cat: 'Electronics · Gurgaon · D2C', tech: 11, signals: 2, tags: ['Custom', 'MoEngage'] },
];

function BrandLogo({ domain, size = 28 }: { domain: string; size?: number }) {
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2}`}
      alt=""
      className="rounded-md bg-slate-100 dark:bg-white/10"
      style={{ width: size, height: size }}
    />
  );
}

const ALL_FILTERS = [
  ['Beauty & Personal Care', 'India', 'Series B+', 'Omnichannel'],
  ['Electronics & Tech', 'US', 'Series A+', 'Pure D2C'],
  ['Home & Living', 'Global', 'Bootstrapped', 'D2C + Marketplace'],
];

/* Step 1: Account Explorer — live cycling accounts + filters */
function DiscoverVisual() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCycle(c => c + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const filterSet = ALL_FILTERS[cycle % ALL_FILTERS.length];
  const startIdx = (cycle * 2) % ALL_ACCOUNTS.length;
  const cards = [0, 1, 2].map(j => ALL_ACCOUNTS[(startIdx + j) % ALL_ACCOUNTS.length]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
      {/* Search bar with typing effect */}
      <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 shadow-sm">
        <svg className="h-4 w-4 flex-shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="font-sans text-[12px] text-gray-400">Search 500K+ brands...</span>
        <span className="w-px h-4 bg-[#C94C1E] animate-pulse ml-auto" />
      </div>

      {/* Filter pills — animate in/out */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {filterSet.map((f, i) => (
          <span key={`${cycle}-${f}`}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all duration-500 ${
              i < 2 ? 'border-[#C94C1E]/30 bg-[#C94C1E]/5 text-[#C94C1E]' : 'border-gray-200 bg-white text-gray-500'
            }`}
            style={{ animation: 'slideUpFade 0.4s ease forwards', animationDelay: `${i * 80}ms` }}>
            {f} {i < 2 && <span className="opacity-50">×</span>}
          </span>
        ))}
      </div>

      {/* Account cards — cycle with slide animation */}
      {cards.map((a, idx) => (
        <div key={`${cycle}-${a.name}`}
          className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
          style={{ animation: 'slideUpFade 0.45s ease forwards', animationDelay: `${200 + idx * 100}ms`, opacity: 0 }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <BrandLogo domain={a.domain} size={28} />
              <span className="text-[13px] font-bold text-gray-900">{a.name}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold">{a.tech} tech</span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[9px] font-bold">{a.signals} signal{a.signals > 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-1">
              {a.tags.map(t => (
                <span key={t} className="px-1.5 py-0.5 rounded bg-gray-100 text-[8px] font-semibold text-gray-500">{t}</span>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-gray-400 ml-9">{a.cat}</p>
        </div>
      ))}
    </div>
  );
}

/* Step 2: Live signal feed — signals slide in from top one by one, loop */
const ALL_SIGNALS = [
  { domain: 'mamaearth.in', label: 'Raised ₹280Cr Series D', brand: 'Mamaearth', type: 'Funding', color: '#C94C1E' },
  { domain: 'sugarcosmetics.com', label: 'Opened 14 stores', brand: 'Sugar Cosmetics', type: 'Expansion', color: '#1A9A82' },
  { domain: 'boat-lifestyle.com', label: 'Launched Android app', brand: 'boAt', type: 'Digital', color: '#7C3AED' },
  { domain: 'mokobara.com', label: 'Hiring VP Growth', brand: 'Mokobara', type: 'Hiring', color: '#2563EB' },
  { domain: 'gonoise.com', label: 'Raised $12M Series C', brand: 'Noise', type: 'Funding', color: '#C94C1E' },
  { domain: 'wakefit.co', label: '5 new stores in tier-2', brand: 'Wakefit', type: 'Expansion', color: '#1A9A82' },
  { domain: 'lenskart.com', label: 'Relaunched D2C site', brand: 'Lenskart', type: 'Digital', color: '#7C3AED' },
  { domain: 'plumgoodness.com', label: 'New CTO appointed', brand: 'Plum Goodness', type: 'Hiring', color: '#2563EB' },
];

function SignalsVisual() {
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(284);

  useEffect(() => {
    const t = setInterval(() => {
      setOffset(o => o + 1);
      setCount(c => c + 1);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  const visible = [0, 1, 2, 3].map(j => ALL_SIGNALS[(offset + j) % ALL_SIGNALS.length]);
  const times = ['Just now', '2m ago', '18m ago', '1h ago'];

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-bold text-gray-700">Live Signals</span>
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {count} today
        </span>
      </div>

      {visible.map((s, i) => (
        <div key={`${offset}-${i}`} className="relative"
          style={{ animation: 'slideUpFade 0.4s ease forwards', animationDelay: `${i * 60}ms`, opacity: 0 }}>
          <div className={`flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm transition-all duration-300 ${
            i === 0 ? 'border-[#C94C1E]/20 ring-1 ring-[#C94C1E]/10' : 'border-gray-100'
          }`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 flex-shrink-0">
              <BrandLogo domain={s.domain} size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-gray-900 leading-tight">{s.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.brand} · {times[i]}</p>
            </div>
            <span className="rounded-md border px-1.5 py-0.5 text-[9px] font-bold flex-shrink-0"
              style={{ backgroundColor: `${s.color}10`, color: s.color, borderColor: `${s.color}20` }}>
              {s.type}
            </span>
          </div>
          {i < 3 && <div className="absolute -bottom-2.5 left-[28px] z-0 h-3 w-px border-l border-dashed border-gray-300" />}
        </div>
      ))}
    </div>
  );
}

/* Step 3: Tech detection + scoring — live tech tags appearing, score counting */
const ALL_TECH = ['Shopify', 'Klaviyo', 'Google Analytics', 'Meta Pixel', 'Razorpay', 'Hotjar', 'Segment', 'CleverTap', 'Stripe', 'Freshdesk', 'Zendesk', 'Mailchimp'];

function TimingVisual() {
  const [visibleTech, setVisibleTech] = useState(0);
  const [score, setScore] = useState(0);
  const [showWindow, setShowWindow] = useState(false);

  useEffect(() => {
    // Animate tech tags appearing one by one
    const techTimer = setInterval(() => {
      setVisibleTech(v => {
        if (v >= 8) return 8;
        return v + 1;
      });
    }, 350);

    // Animate score counting up
    const scoreTimer = setInterval(() => {
      setScore(s => {
        if (s >= 92) return 92;
        return s + 3;
      });
    }, 80);

    // Show buying window after tech + score done
    const windowTimer = setTimeout(() => setShowWindow(true), 3500);

    // Reset loop
    const resetTimer = setTimeout(() => {
      setVisibleTech(0);
      setScore(0);
      setShowWindow(false);
    }, 6000);

    return () => {
      clearInterval(techTimer);
      clearInterval(scoreTimer);
      clearTimeout(windowTimer);
      clearTimeout(resetTimer);
    };
  }, [visibleTech === 0 && score === 0 ? 0 : 1]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-trigger the loop
  useEffect(() => {
    if (visibleTech === 0 && score === 0 && !showWindow) {
      const t = setTimeout(() => setVisibleTech(1), 400);
      return () => clearTimeout(t);
    }
  }, [visibleTech, score, showWindow]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-md">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <BrandLogo domain="mamaearth.in" size={40} />
            <div>
              <p className="text-[14px] font-bold text-gray-900">Mamaearth</p>
              <p className="text-[11px] text-gray-400">Beauty & Personal Care · US · Pure D2C</p>
            </div>
          </div>
          <span className="rounded-lg border border-[#C94C1E]/20 bg-[#C94C1E]/10 px-2.5 py-1 font-mono text-[15px] font-bold text-[#C94C1E] tabular-nums transition-all">
            {Math.min(score, 92)}
          </span>
        </div>

        {/* Score bar */}
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 mb-3">
          <div className="h-full rounded-full bg-gradient-to-r from-[#e87f58] to-[#C94C1E] transition-all duration-300 ease-out" style={{ width: `${Math.min(score, 92)}%` }} />
        </div>

        {/* Detail pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {['2M+ MAU', 'iOS Only', 'Late Stage', 'New Product Launch'].map((p, i) => (
            <span key={p} className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-medium transition-all duration-300 ${
              i === 2 ? 'border-green-200 bg-green-50 text-green-600' :
              i === 3 ? 'border-amber-200 bg-amber-50 text-amber-600' :
              'border-gray-200 bg-gray-50 text-gray-600'
            }`} style={{ opacity: i < visibleTech / 2 ? 1 : 0.3, transition: 'opacity 0.3s ease' }}>{p}</span>
          ))}
        </div>

        {/* Tech stack — tags appear one by one */}
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Tech Stack Detected</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TECH.slice(0, 8).map((t, i) => (
            <span key={t}
              className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-[9px] font-semibold text-gray-600 transition-all duration-300"
              style={{
                opacity: i < visibleTech ? 1 : 0,
                transform: i < visibleTech ? 'scale(1)' : 'scale(0.8)',
                transition: `opacity 0.3s ease ${i * 50}ms, transform 0.3s ease ${i * 50}ms`,
              }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Buying window — slides in after analysis */}
      <div className="flex flex-col items-center gap-1.5" style={{ opacity: showWindow ? 1 : 0, transform: showWindow ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.5s ease' }}>
        <div className="h-5 w-px border-l-2 border-dashed border-[#C94C1E]/40" />
        <div className="flex items-center gap-2 rounded-full border border-[#C94C1E]/20 bg-[#C94C1E]/10 px-4 py-2 shadow-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#C94C1E] shadow-[0_0_8px_#C94C1E]" />
          <span className="text-[12px] font-semibold text-[#C94C1E]">Prime buying window — reach out now</span>
        </div>
      </div>
    </div>
  );
}

/* Step 4: Watchlist + export — live sync progress animation */
function DealVisual() {
  const [synced, setSynced] = useState(0);
  const [phase, setPhase] = useState<'list' | 'syncing' | 'done'>('list');

  useEffect(() => {
    // Phase 1: Show list
    const t1 = setTimeout(() => setPhase('syncing'), 1500);
    // Phase 2: Sync progress
    const t2 = setTimeout(() => {
      const interval = setInterval(() => {
        setSynced(s => {
          if (s >= 12) { clearInterval(interval); return 12; }
          return s + 1;
        });
      }, 150);
      return () => clearInterval(interval);
    }, 1800);
    // Phase 3: Done
    const t3 = setTimeout(() => setPhase('done'), 4000);
    // Reset loop
    const t4 = setTimeout(() => {
      setPhase('list');
      setSynced(0);
    }, 6500);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [phase === 'list' && synced === 0 ? 0 : 1]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-trigger loop
  useEffect(() => {
    if (phase === 'list' && synced === 0) {
      const t = setTimeout(() => setPhase('list'), 200);
      return () => clearTimeout(t);
    }
  }, [phase, synced]);

  const accounts = [
    { domain: 'mamaearth.in', n: 'Mamaearth', s: 92 },
    { domain: 'sugarcosmetics.com', n: 'Sugar Cosmetics', s: 85 },
    { domain: 'plumgoodness.com', n: 'Plum Goodness', s: 94 },
  ];

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-bold text-gray-800">High-Intent D2C Brands</span>
          <span className="text-[10px] text-gray-400 font-medium">12 accounts</span>
        </div>

        {accounts.map((a, idx) => (
          <div key={a.n} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-2.5">
              <BrandLogo domain={a.domain} size={28} />
              <span className="text-[12px] font-semibold text-gray-800">{a.n}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Sync checkmark animates in */}
              <svg className="w-3.5 h-3.5 transition-all duration-300"
                style={{ opacity: synced > idx ? 1 : 0, transform: synced > idx ? 'scale(1)' : 'scale(0)' }}
                viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill="#10B981" />
                <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[12px] font-bold font-mono text-[#C94C1E]">{a.s}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons — CRM button shows progress */}
      <div className="flex gap-2">
        <div className="flex-1 relative overflow-hidden flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#C94C1E] text-white shadow-md">
          {/* Progress bar inside button */}
          {phase === 'syncing' && (
            <div className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-300 ease-out" style={{ width: `${(synced / 12) * 100}%` }} />
          )}
          <span className="relative text-[11px] font-bold">
            {phase === 'syncing' ? `Syncing ${synced}/12...` : phase === 'done' ? '✓ Synced!' : 'Export to CRM'}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm">
          <span className="text-[11px] font-bold">Download CSV</span>
        </div>
      </div>

      {/* Success banner — slides in when done */}
      <div className="flex items-center gap-2.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 shadow-sm mx-auto transition-all duration-500"
        style={{ opacity: phase === 'done' ? 1 : 0, transform: phase === 'done' ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)' }}>
        <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[12px] font-bold text-emerald-600">12 accounts synced to HubSpot</span>
      </div>
    </div>
  );
}

/* ── Steps Data ──────────────────────────────────────────────────────────── */
const STEPS = [
  {
    number: '01',
    title: 'Find brands that match your ICP',
    desc: 'Filter by category, geography, funding stage, tech stack, traffic — whatever matters to your team. No more guessing from LinkedIn.',
    Visual: DiscoverVisual,
  },
  {
    number: '02',
    title: 'Spot buying signals before competitors',
    desc: 'A brand just raised a Series B? Opened 5 new stores? Hired a VP of Growth? You\'ll know within hours, not weeks.',
    Visual: SignalsVisual,
  },
  {
    number: '03',
    title: 'Score and prioritize accounts',
    desc: 'Every brand gets a score based on tech maturity, growth trajectory, and recent activity. Focus on the ones most likely to buy.',
    Visual: TimingVisual,
  },
  {
    number: '04',
    title: 'Push to CRM and start outreach',
    desc: 'One click to sync a shortlist to HubSpot, Salesforce, or a CSV. Your team reaches out with context, not cold intros.',
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
    <section className="flex min-h-screen w-full flex-col justify-center bg-[#f1f2f4] px-4 py-12 sm:px-6 sm:py-20 font-sans md:px-10 lg:px-16">
      <style>{styles}</style>

      <div className="mx-auto w-full max-w-[1300px]">
        <div className="mx-auto mb-14 max-w-6xl text-center lg:mb-16">
          <h2 className="text-[24px] font-bold leading-[1.1] tracking-tight text-gray-900 md:text-[36px] lg:text-[36px]">
            From cold list to closed deal in 4 steps
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600 md:text-xl">
            Most sales teams waste weeks researching accounts. Here&rsquo;s how our customers cut that to minutes.
          </p>
        </div>

        <div
          className="rounded-[16px] sm:rounded-[28px] border border-gray-200/80 bg-[#f8f8f9] p-3 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)] md:p-6 lg:p-7"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: 'pan-y' }}
        >
          <div className="flex flex-col gap-5 sm:gap-7 md:flex-row md:items-stretch md:gap-8">
            <div className="relative flex w-full flex-col justify-between md:w-1/2 md:min-h-[430px] md:pb-14">
              <div key={activeStep} className="animate-slide-up-fade">
                <div className="mb-3 sm:mb-4 font-mono text-[18px] sm:text-[22px] font-medium tracking-wide text-gray-400">{currentData.number}</div>
                <h3 className="mb-3 sm:mb-5 pr-4 text-[22px] sm:text-[28px] font-bold leading-[1.2] text-gray-900 md:text-[38px]">{currentData.title}</h3>
                <p className="pr-3 text-[15px] sm:text-[18px] leading-relaxed text-gray-600">{currentData.desc}</p>
              </div>

              <div className="mt-6 sm:mt-10 flex w-full max-w-[460px] items-center gap-3 sm:gap-5 md:absolute md:bottom-0 md:left-0">
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

            <div className="relative flex h-[280px] sm:h-[340px] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-[16px] sm:rounded-[24px] border border-gray-200 bg-white p-3 sm:p-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)] md:h-[390px] md:w-1/2 lg:h-[430px] lg:p-6">
              <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_75%_30%,rgba(201,76,30,0.07),transparent_45%),linear-gradient(to_bottom,rgba(248,250,252,0.6),rgba(255,255,255,0.2))]" />
              <div key={activeStep} className="relative z-10 flex h-full w-full animate-subtle-fade items-center justify-center">
                <ActiveVisual />
              </div>
              {/* Step indicator */}
              <div className="pointer-events-none absolute top-4 right-4 z-20">
                <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                  Step {currentData.number} of 04
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
