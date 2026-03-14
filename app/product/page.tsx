'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CTA from '@/components/CTA';
import { useRef, useEffect, useState, useCallback } from 'react';
import { useModal } from '@/components/ModalContext';
import {
  Search, Zap, Monitor, TrendingUp,
  Check, ArrowRight, Building2, ShoppingBag, Cpu, Briefcase,
  Target, Users, Layers, DollarSign, Store, Smartphone,
  ExternalLink, Star, Pencil, Trash2, ChevronDown,
  Radar, Bell, Plus, Bookmark,
} from 'lucide-react';

/* ── Keyframe styles ─────────────────────────────────────────────────────── */
const pageStyles = `
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0; }
  }
  @keyframes heroGlow {
    0%, 100% { opacity: 0.5; transform: translate(-50%, 0) scale(1); }
    50%      { opacity: 0.8; transform: translate(-50%, 0) scale(1.08); }
  }
  @keyframes floatUp {
    from { opacity: 0; transform: translateY(40px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-30px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(30px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes countReveal {
    from { opacity: 0; transform: translateY(16px) scale(0.9); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes subtleFadeIn {
    from { opacity: 0; transform: scale(0.985); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes scanSweep {
    0%   { transform: translateY(6%);  }
    46%  { transform: translateY(80%); }
    54%  { transform: translateY(80%); }
    100% { transform: translateY(6%);  }
  }
  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
  }
  .animate-float-up  { animation: floatUp 0.7s cubic-bezier(0.16,1,0.3,1) both; }
  .animate-scale-in  { animation: scaleIn 0.6s cubic-bezier(0.16,1,0.3,1) both; }
  .animate-slide-left  { animation: slideInLeft 0.65s cubic-bezier(0.16,1,0.3,1) both; }
  .animate-slide-right { animation: slideInRight 0.65s cubic-bezier(0.16,1,0.3,1) both; }
  .animate-count     { animation: countReveal 0.5s cubic-bezier(0.16,1,0.3,1) both; }

  .shimmer-border {
    background: linear-gradient(90deg, transparent 0%, rgba(201,76,30,0.3) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 3s ease-in-out infinite;
  }
`;

/* ── Scroll-triggered animation hook ─────────────────────────────────────── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}


/* ── Animated counter hook ───────────────────────────────────────────────── */
function useCounter(end: number, start: boolean, duration = 1400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, end, duration]);
  return count;
}

/* ── Hero stat chip with counter ─────────────────────────────────────────── */
function HeroStat({ numEnd, suffix, prefix, label, ready, delay }: {
  numEnd: number; suffix: string; prefix?: string; label: string; ready: boolean; delay: number;
}) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [ready, delay]);

  const count = useCounter(numEnd, started);
  const formatted = numEnd >= 1000 ? count.toLocaleString() : count;

  return (
    <span className="font-bold text-slate-900 dark:text-white tabular-nums">
      {prefix}{formatted}{suffix}
    </span>
  );
}

/* ── Hero typewriter word ─────────────────────────────────────────────────── */
const HERO_WORDS = ['revenue teams', 'sales leaders', 'growth teams', 'market analysts', 'deal closers'];
const TYPE_SPEED = 80;
const DELETE_SPEED = 50;
const PAUSE_AFTER_TYPE = 2000;
const PAUSE_AFTER_DELETE = 400;

function HeroRotatingWord({ heroReady }: { heroReady: boolean }) {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!heroReady) return;

    const currentWord = HERO_WORDS[wordIndex];

    if (!isDeleting && displayed === currentWord) {
      // Finished typing — pause then start deleting
      const t = setTimeout(() => setIsDeleting(true), PAUSE_AFTER_TYPE);
      return () => clearTimeout(t);
    }

    if (isDeleting && displayed === '') {
      // Finished deleting — move to next word
      const t = setTimeout(() => {
        setIsDeleting(false);
        setWordIndex(i => (i + 1) % HERO_WORDS.length);
      }, PAUSE_AFTER_DELETE);
      return () => clearTimeout(t);
    }

    const speed = isDeleting ? DELETE_SPEED : TYPE_SPEED;
    const t = setTimeout(() => {
      setDisplayed(
        isDeleting
          ? currentWord.slice(0, displayed.length - 1)
          : currentWord.slice(0, displayed.length + 1)
      );
    }, speed);

    return () => clearTimeout(t);
  }, [heroReady, displayed, isDeleting, wordIndex]);

  // Start typing the first word once hero is ready
  useEffect(() => {
    if (heroReady && displayed === '' && !isDeleting) {
      const t = setTimeout(() => setDisplayed(HERO_WORDS[wordIndex].slice(0, 1)), 600);
      return () => clearTimeout(t);
    }
  }, [heroReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={`inline-block text-[#C94C1E] relative
                      ${heroReady ? 'opacity-100' : 'opacity-0'}`}>
      {displayed}
      <span className="inline-block w-[3px] h-[0.85em] bg-[#C94C1E] ml-0.5 align-baseline
                       rounded-sm animate-[heroGlow_1s_step-end_infinite]"
            style={{ animation: 'blink 1s step-end infinite' }} />
      {displayed.length > 0 && (
        <span className="absolute -bottom-1 left-0 h-[3px] rounded-full bg-[#C94C1E]/30
                         transition-all duration-200"
              style={{ width: `${(displayed.length / HERO_WORDS[wordIndex].length) * 100}%` }} />
      )}
    </span>
  );
}

/* ── Data ────────────────────────────────────────────────────────────────── */

const AUDIENCE = [
  {
    icon: Target,
    title: 'Sales & BDR Teams',
    desc: 'Find high-intent D2C brands ready to buy. Stop cold-calling — start warm-selling with real-time buying signals.',
    stat: '3×',
    statLabel: 'more qualified meetings',
    gradient: 'from-[#C94C1E]/10 to-[#C94C1E]/5',
  },
  {
    icon: Users,
    title: 'Account-Based Marketing',
    desc: 'Build target account lists from 500K+ D2C brands. Track competitor customers, identify greenfield accounts, and time your outreach perfectly.',
    stat: '60%',
    statLabel: 'faster ICP matching',
    gradient: 'from-[#1A9A82]/10 to-[#1A9A82]/5',
  },
  {
    icon: Briefcase,
    title: 'Revenue & Growth Leaders',
    desc: 'Get a real-time view of D2C market movements — funding, hiring, expansion. Build pipeline around the signals that actually predict deals.',
    stat: '10–15',
    statLabel: 'qualified brands/month',
    gradient: 'from-[#2563EB]/10 to-[#2563EB]/5',
  },
];


const USE_CASES = [
  {
    icon: Cpu,
    title: 'SaaS & Martech Vendors',
    desc: 'Selling ecommerce tools, CRMs, logistics, or marketing platforms to D2C brands? Find the ones actively evaluating or about to churn from a competitor.',
    example: 'A Shopify Plus agency used HarvinAI to identify 34 brands migrating from Magento in Q1 — closed 8 deals.',
    color: '#C94C1E',
  },
  {
    icon: Building2,
    title: 'Agencies & Consultants',
    desc: 'Digital marketing, growth, and creative agencies can prospect D2C brands by scale, category, and growth signals to pitch at the right moment.',
    example: 'A performance marketing agency built a watchlist of recently-funded beauty brands — 4× pipeline in 60 days.',
    color: '#1A9A82',
  },
  {
    icon: ShoppingBag,
    title: 'Logistics & Fulfillment',
    desc: 'Identify D2C brands expanding to new geographies or opening physical stores. Reach out with a logistics proposal before they sign with a competitor.',
    example: 'A 3PL provider tracked store-opening signals — landed 6 new D2C clients in a single quarter.',
    color: '#2563EB',
  },
];


/* ── HIW Animated Visuals ─────────────────────────────────────────────── */

const ALL_ACCOUNTS_HIW = [
  { i: 'M', c: '#C94C1E', name: 'Mamaearth', cat: 'Beauty · US · Pure D2C', tech: 8, signals: 1, tags: ['Shopify', 'Klaviyo'] },
  { i: 'B', c: '#1A9A82', name: 'Bunnings', cat: 'Retail · Australia · Omnichannel', tech: 9, signals: 2, tags: ['Shiprocket', 'Shopify'] },
  { i: 'I', c: '#0058A3', name: 'Ikea', cat: 'Home · India · Omnichannel', tech: 29, signals: 2, tags: ['Meta Pixel', 'Hotjar'] },
  { i: 'S', c: '#A93D18', name: 'Sugar', cat: 'Beauty · Mumbai · D2C', tech: 12, signals: 3, tags: ['Shopify', 'WebEngage'] },
  { i: 'P', c: '#343330', name: 'Plum', cat: 'Beauty · Mumbai · Pure D2C', tech: 15, signals: 1, tags: ['Magento', 'Segment'] },
  { i: 'N', c: '#4A4842', name: 'Noise', cat: 'Electronics · Gurgaon · D2C', tech: 11, signals: 2, tags: ['Custom', 'MoEngage'] },
];

const ALL_FILTERS_HIW = [
  ['Beauty & Personal Care', 'India', 'Series B+', 'Omnichannel'],
  ['Electronics & Tech', 'US', 'Series A+', 'Pure D2C'],
  ['Home & Living', 'Global', 'Bootstrapped', 'D2C + Marketplace'],
];

function DiscoverVisual() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCycle(c => c + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const filterSet = ALL_FILTERS_HIW[cycle % ALL_FILTERS_HIW.length];
  const startIdx = (cycle * 2) % ALL_ACCOUNTS_HIW.length;
  const cards = [0, 1, 2].map(j => ALL_ACCOUNTS_HIW[(startIdx + j) % ALL_ACCOUNTS_HIW.length]);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 shadow-sm">
        <svg className="h-4 w-4 flex-shrink-0 text-slate-400" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="font-sans text-[12px] text-slate-400">Search 500K+ brands...</span>
        <span className="w-px h-4 bg-[#C94C1E] ml-auto" style={{ animation: 'subtleFadeIn 0.8s ease infinite alternate' }} />
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {filterSet.map((f, i) => (
          <span key={`${cycle}-${f}`}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all duration-500 ${
              i < 2 ? 'border-[#C94C1E]/30 bg-[#C94C1E]/5 text-[#C94C1E] dark:border-[#C94C1E]/40 dark:bg-[#C94C1E]/10' : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
            style={{ animation: 'slideUpFade 0.4s ease forwards', animationDelay: `${i * 80}ms` }}>
            {f} {i < 2 && <span className="opacity-50">×</span>}
          </span>
        ))}
      </div>

      {cards.map((a, idx) => (
        <div key={`${cycle}-${a.name}`}
          className="rounded-xl border border-slate-100 dark:border-white/[0.06] bg-white dark:bg-slate-800/80 p-3 shadow-sm"
          style={{ animation: 'slideUpFade 0.45s ease forwards', animationDelay: `${200 + idx * 100}ms`, opacity: 0 }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: a.c }}>{a.i}</div>
              <span className="text-[13px] font-bold text-slate-900 dark:text-white">{a.name}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">{a.tech} tech</span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold">{a.signals} signal{a.signals > 1 ? 's' : ''}</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 ml-9">{a.cat}</p>
        </div>
      ))}
    </div>
  );
}

const ALL_SIGNALS_HIW = [
  { icon: '💰', label: 'Raised ₹280Cr Series D', brand: 'Mamaearth', type: 'Funding', color: '#C94C1E' },
  { icon: '🏪', label: 'Opened 14 stores', brand: 'Sugar Cosmetics', type: 'Expansion', color: '#1A9A82' },
  { icon: '📱', label: 'Launched Android app', brand: 'boAt', type: 'Digital', color: '#7C3AED' },
  { icon: '👤', label: 'Hiring VP Growth', brand: 'Mokobara', type: 'Hiring', color: '#2563EB' },
  { icon: '💰', label: 'Raised $12M Series C', brand: 'Noise', type: 'Funding', color: '#C94C1E' },
  { icon: '🏪', label: '5 new stores in tier-2', brand: 'Wakefit', type: 'Expansion', color: '#1A9A82' },
  { icon: '📱', label: 'Relaunched D2C site', brand: 'Lenskart', type: 'Digital', color: '#7C3AED' },
  { icon: '👤', label: 'New CTO appointed', brand: 'Plum Goodness', type: 'Hiring', color: '#2563EB' },
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

  const visible = [0, 1, 2, 3].map(j => ALL_SIGNALS_HIW[(offset + j) % ALL_SIGNALS_HIW.length]);
  const times = ['Just now', '2m ago', '18m ago', '1h ago'];

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">Live Signals</span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'subtleFadeIn 1s ease infinite alternate' }} />
          {count} today
        </span>
      </div>

      {visible.map((s, i) => (
        <div key={`${offset}-${i}`} className="relative"
          style={{ animation: 'slideUpFade 0.4s ease forwards', animationDelay: `${i * 60}ms`, opacity: 0 }}>
          <div className={`flex items-center gap-3 rounded-xl border bg-white dark:bg-slate-800/80 p-3 shadow-sm transition-all duration-300 ${
            i === 0 ? 'border-[#C94C1E]/20 ring-1 ring-[#C94C1E]/10' : 'border-slate-100 dark:border-white/[0.06]'
          }`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-slate-700/60 text-[18px] leading-none flex-shrink-0">
              {s.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-900 dark:text-white leading-tight">{s.label}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.brand} · {times[i]}</p>
            </div>
            <span className="rounded-md border px-1.5 py-0.5 text-[9px] font-bold flex-shrink-0"
              style={{ backgroundColor: `${s.color}10`, color: s.color, borderColor: `${s.color}20` }}>
              {s.type}
            </span>
          </div>
          {i < 3 && <div className="absolute -bottom-2.5 left-[28px] z-0 h-3 w-px border-l border-dashed border-slate-300 dark:border-slate-600" />}
        </div>
      ))}
    </div>
  );
}

const ALL_TECH_HIW = ['Shopify', 'Klaviyo', 'Google Analytics', 'Meta Pixel', 'Razorpay', 'Hotjar', 'Segment', 'CleverTap'];

function TimingVisual() {
  const [visibleTech, setVisibleTech] = useState(0);
  const [score, setScore] = useState(0);
  const [showWindow, setShowWindow] = useState(false);

  useEffect(() => {
    const techTimer = setInterval(() => {
      setVisibleTech(v => v >= 8 ? 8 : v + 1);
    }, 350);
    const scoreTimer = setInterval(() => {
      setScore(s => s >= 92 ? 92 : s + 3);
    }, 80);
    const windowTimer = setTimeout(() => setShowWindow(true), 3500);
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

  useEffect(() => {
    if (visibleTech === 0 && score === 0 && !showWindow) {
      const t = setTimeout(() => setVisibleTech(1), 400);
      return () => clearTimeout(t);
    }
  }, [visibleTech, score, showWindow]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-2xl border border-slate-100 dark:border-white/[0.08] bg-white dark:bg-slate-800/80 p-4 shadow-md">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-[14px] font-bold text-white shadow-sm" style={{ backgroundColor: '#C94C1E' }}>M</div>
            <div>
              <p className="text-[14px] font-bold text-slate-900 dark:text-white">Mamaearth</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Beauty & Personal Care · US · Pure D2C</p>
            </div>
          </div>
          <span className="rounded-lg border border-[#C94C1E]/20 bg-[#C94C1E]/10 px-2.5 py-1 font-mono text-[15px] font-bold text-[#C94C1E] tabular-nums transition-all">
            {Math.min(score, 92)}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700 mb-3">
          <div className="h-full rounded-full bg-gradient-to-r from-[#e87f58] to-[#C94C1E] transition-all duration-300 ease-out" style={{ width: `${Math.min(score, 92)}%` }} />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {['2M+ MAU', 'iOS Only', 'Late Stage', 'New Product Launch'].map((p, i) => (
            <span key={p} className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-medium transition-all duration-300 ${
              i === 2 ? 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400' :
              i === 3 ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
              'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
            }`} style={{ opacity: i < visibleTech / 2 ? 1 : 0.3, transition: 'opacity 0.3s ease' }}>{p}</span>
          ))}
        </div>

        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Tech Stack Detected</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TECH_HIW.map((t, i) => (
            <span key={t}
              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-white/[0.06] text-[9px] font-semibold text-slate-600 dark:text-slate-400 transition-all duration-300"
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

      <div className="flex flex-col items-center gap-1.5" style={{ opacity: showWindow ? 1 : 0, transform: showWindow ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.5s ease' }}>
        <div className="h-5 w-px border-l-2 border-dashed border-[#C94C1E]/40" />
        <div className="flex items-center gap-2 rounded-full border border-[#C94C1E]/20 bg-[#C94C1E]/10 px-4 py-2 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#C94C1E] shadow-[0_0_8px_#C94C1E]" style={{ animation: 'subtleFadeIn 1s ease infinite alternate' }} />
          <span className="text-[12px] font-semibold text-[#C94C1E]">Prime buying window — reach out now</span>
        </div>
      </div>
    </div>
  );
}

function DealVisual() {
  const [synced, setSynced] = useState(0);
  const [phase, setPhase] = useState<'list' | 'syncing' | 'done'>('list');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('syncing'), 1500);
    const t2 = setTimeout(() => {
      const interval = setInterval(() => {
        setSynced(s => {
          if (s >= 12) { clearInterval(interval); return 12; }
          return s + 1;
        });
      }, 150);
      return () => clearInterval(interval);
    }, 1800);
    const t3 = setTimeout(() => setPhase('done'), 4000);
    const t4 = setTimeout(() => {
      setPhase('list');
      setSynced(0);
    }, 6500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [phase === 'list' && synced === 0 ? 0 : 1]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === 'list' && synced === 0) {
      const t = setTimeout(() => setPhase('list'), 200);
      return () => clearTimeout(t);
    }
  }, [phase, synced]);

  const accounts = [
    { i: 'M', c: '#C94C1E', n: 'Mamaearth', s: 92 },
    { i: 'S', c: '#A93D18', n: 'Sugar Cosmetics', s: 85 },
    { i: 'P', c: '#343330', n: 'Plum Goodness', s: 94 },
  ];

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-xl border border-slate-100 dark:border-white/[0.08] bg-white dark:bg-slate-800/80 p-4 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-bold text-slate-800 dark:text-white">🎯 High-Intent D2C Brands</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">12 accounts</span>
        </div>

        {accounts.map((a, idx) => (
          <div key={a.n} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-white/[0.04] last:border-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: a.c }}>{a.i}</div>
              <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200">{a.n}</span>
            </div>
            <div className="flex items-center gap-2">
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

      <div className="flex gap-2">
        <div className="flex-1 relative overflow-hidden flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#C94C1E] text-white shadow-md">
          {phase === 'syncing' && (
            <div className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-300 ease-out" style={{ width: `${(synced / 12) * 100}%` }} />
          )}
          <span className="relative text-[11px] font-bold">
            {phase === 'syncing' ? `Syncing ${synced}/12...` : phase === 'done' ? '✓ Synced!' : 'Export to CRM'}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm">
          <span className="text-[11px] font-bold">Download CSV</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 shadow-sm mx-auto transition-all duration-500"
        style={{ opacity: phase === 'done' ? 1 : 0, transform: phase === 'done' ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)' }}>
        <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">12 accounts synced to HubSpot</span>
      </div>
    </div>
  );
}

/* ── HIW Steps data ──────────────────────────────────────────────────────── */
const HIW_STEPS = [
  {
    number: '01',
    icon: Search,
    title: 'Discover your ICP accounts',
    desc: 'Filter 500K+ D2C brands by category, geography, funding stage, tech stack, traffic, business model, and more. Find the accounts that match your Ideal Customer Profile in seconds.',
    features: ['13 advanced filter categories', 'D2C-specific taxonomy', 'Priority scores per account'],
    color: '#C94C1E',
    Visual: DiscoverVisual,
  },
  {
    number: '02',
    icon: Zap,
    title: 'Track real-time buying signals',
    desc: 'Get notified the moment a target account raises funding, opens new stores, launches an app, or hires key roles — the signals that predict buying windows.',
    features: ['Funding, hiring, expansion alerts', '<5 min average latency', 'Slack, email & CRM delivery'],
    color: '#1A9A82',
    Visual: SignalsVisual,
  },
  {
    number: '03',
    icon: Monitor,
    title: 'Analyze tech stack & timing',
    desc: 'See every brand\'s full technology stack — ecommerce platform, CRM, payment gateway, marketing tools. Identify displacement opportunities and calculate intent scores.',
    features: ['4,000+ tech signatures detected', 'Competitive displacement insights', 'Intent score 0–100'],
    color: '#2563EB',
    Visual: TimingVisual,
  },
  {
    number: '04',
    icon: TrendingUp,
    title: 'Export & close deals',
    desc: 'Build watchlists, sync to HubSpot or Salesforce, or export as CSV. Reach out with full context — tech stack, signals, intent score — at the perfect moment.',
    features: ['HubSpot & Salesforce sync', 'Custom watchlists', 'CSV export with full context'],
    color: '#7C3AED',
    Visual: DealVisual,
  },
];

/* ── HIW Step component — content left, animated visual right ────────────── */
function HowItWorksStep({ step, index }: { step: typeof HIW_STEPS[0]; index: number }) {
  const reveal = useReveal(0.15);
  const isEven = index % 2 === 0;

  return (
    <div ref={reveal.ref} className="relative">
      <div
        className={`group rounded-2xl border border-slate-200 dark:border-white/[0.08]
                     bg-white dark:bg-slate-900/60
                     hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]
                     hover:border-slate-300 dark:hover:border-white/[0.14]
                     transition-all duration-500 overflow-hidden
                     ${reveal.visible ? (isEven ? 'animate-slide-left' : 'animate-slide-right') : 'opacity-0'}`}
        style={reveal.visible ? { animationDelay: `${index * 100}ms` } : undefined}
      >
        {/* Top accent line */}
        <div className="h-[2px] w-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
             style={{ background: `linear-gradient(to right, transparent, ${step.color}, transparent)` }} />

        <div className="flex flex-col lg:flex-row">
          {/* Left — content */}
          <div className="flex-1 px-8 py-8 lg:py-10 lg:px-10 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-5">
              <span className="font-mono text-[28px] font-bold tracking-wide"
                    style={{ color: step.color }}>
                {step.number}
              </span>
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center
                              transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                   style={{ backgroundColor: `${step.color}15`, boxShadow: `0 0 0 1px ${step.color}20` }}>
                <step.icon size={22} style={{ color: step.color }} />
              </div>
            </div>

            <h3 className="text-[22px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-white mb-3
                           group-hover:text-[#C94C1E] dark:group-hover:text-[#C94C1E] transition-colors duration-300">
              {step.title}
            </h3>
            <p className="text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 mb-6 max-w-[440px]">
              {step.desc}
            </p>

            <div className="flex flex-col gap-3">
              {step.features.map((f, fi) => (
                <div key={f}
                     className="flex items-center gap-2.5 text-[14px] text-slate-700 dark:text-slate-300
                                transition-all duration-300 hover:translate-x-1"
                     style={reveal.visible ? { animation: `floatUp 0.5s cubic-bezier(0.16,1,0.3,1) ${300 + index * 100 + fi * 80}ms both` } : { opacity: 0 }}>
                  <div className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0
                                  transition-transform duration-300 group-hover:scale-110"
                       style={{ backgroundColor: `${step.color}15` }}>
                    <Check size={12} style={{ color: step.color }} strokeWidth={2.5} />
                  </div>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Right — live animated visual */}
          <div className="lg:w-[480px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-white/[0.06]
                          relative overflow-hidden">
            {/* Radial glow background */}
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: `radial-gradient(circle at 50% 50%, ${step.color}08, transparent 70%)` }} />

            {/* Scan sweep */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-full" style={{ animation: 'scanSweep 4.2s cubic-bezier(0.37, 0, 0.63, 1) infinite' }}>
              <div className="absolute left-0 right-0 top-0 h-[80px]"
                   style={{ background: `linear-gradient(to bottom, ${step.color}15, ${step.color}06, transparent)` }} />
              <div className="absolute left-0 right-0 top-0 h-[1.5px]"
                   style={{
                     background: `linear-gradient(to right, transparent 2%, ${step.color}80 15%, ${step.color} 40%, ${step.color}80 85%, transparent 98%)`,
                     boxShadow: `0 0 6px 1px ${step.color}50, 0 2px 16px ${step.color}30`,
                   }} />
            </div>

            <div className="relative z-10 p-6 lg:p-8 flex items-center justify-center min-h-[320px] lg:min-h-[380px]">
              <div className="w-full max-w-[380px]">
                <step.Visual />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connector */}
      {index < HIW_STEPS.length - 1 && (
        <div className="hidden md:flex justify-center py-1">
          <div className={`w-px h-8 transition-all duration-700 ${reveal.visible ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'}`}
               style={{
                 background: `linear-gradient(to bottom, ${step.color}40, ${HIW_STEPS[index + 1].color}40)`,
                 transitionDelay: `${400 + index * 100}ms`,
               }} />
        </div>
      )}
    </div>
  );
}

/* ── Audience card with own scroll trigger ───────────────────────────────── */
function AudienceCard({ item, index }: { item: typeof AUDIENCE[0]; index: number }) {
  const reveal = useReveal(0.15);

  return (
    <div
      ref={reveal.ref}
      className={`group relative rounded-2xl border border-slate-200 dark:border-white/[0.08]
                   bg-white dark:bg-slate-900/60 p-8 overflow-hidden
                   hover:shadow-[0_12px_40px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]
                   hover:border-slate-300 dark:hover:border-white/[0.14]
                   transition-all duration-500 hover:-translate-y-1
                   ${reveal.visible ? 'animate-float-up' : 'opacity-0'}`}
      style={reveal.visible ? { animationDelay: `${index * 120}ms` } : undefined}
    >
      {/* Gradient bg on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

      <div className="relative">
        <div className="flex items-start justify-between mb-6">
          <div className="h-13 w-13 rounded-2xl bg-[#C94C1E]/10 flex items-center justify-center
                          ring-1 ring-[#C94C1E]/10 group-hover:bg-[#C94C1E]/[0.18]
                          transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-3deg]"
               style={{ height: 52, width: 52 }}>
            <item.icon size={24} className="text-[#C94C1E] transition-transform duration-300 group-hover:scale-110" />
          </div>
          <div className="text-right">
            <p className="text-[28px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white leading-none
                          transition-transform duration-300 group-hover:scale-105 origin-right">
              {item.stat}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {item.statLabel}
            </p>
          </div>
        </div>
        <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-white mb-2.5
                       transition-colors duration-300 group-hover:text-[#C94C1E]">
          {item.title}
        </h3>
        <p className="text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
          {item.desc}
        </p>
      </div>
    </div>
  );
}

/* ── Use case card with own scroll trigger ───────────────────────────────── */
function UseCaseCard({ uc, index }: { uc: typeof USE_CASES[0]; index: number }) {
  const reveal = useReveal(0.15);

  return (
    <div
      ref={reveal.ref}
      className={`group relative rounded-2xl border border-slate-200 dark:border-white/[0.08]
                   bg-white dark:bg-slate-900/60 p-8 flex flex-col overflow-hidden
                   hover:shadow-[0_12px_40px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]
                   hover:border-slate-300 dark:hover:border-white/[0.14]
                   transition-all duration-500 hover:-translate-y-1
                   ${reveal.visible ? 'animate-scale-in' : 'opacity-0'}`}
      style={reveal.visible ? { animationDelay: `${index * 120}ms` } : undefined}
    >
      {/* Corner accent glow */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
           style={{ background: `radial-gradient(circle at 100% 0%, ${uc.color}12, transparent 70%)` }} />

      <div className="relative">
        <div className="h-13 w-13 rounded-2xl flex items-center justify-center
                        ring-1 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 mb-6"
             style={{ height: 52, width: 52, backgroundColor: `${uc.color}15`, boxShadow: `0 0 0 1px ${uc.color}20` }}>
          <uc.icon size={24} style={{ color: uc.color }} />
        </div>

        <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-white mb-2.5
                       transition-colors duration-300 group-hover:text-[#C94C1E]">
          {uc.title}
        </h3>
        <p className="text-[14px] leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
          {uc.desc}
        </p>
      </div>

      {/* Example quote */}
      <div className="mt-auto pt-5 border-t border-slate-100 dark:border-white/[0.06] relative">
        <div className="absolute top-5 left-0 text-[40px] leading-none font-serif opacity-10"
             style={{ color: uc.color }}>&ldquo;</div>
        <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 pl-6">
          {uc.example}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE MOCKUPS — exact replicas of real dashboard UI
═══════════════════════════════════════════════════════════════════════════ */

/* ── 1. Account Explorer Mockup ──────────────────────────────────────────── */
function AccountExplorerMockup() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141414]/60 overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#141414]">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#C94C1E]" />
          <span className="text-[14px] font-bold text-slate-800 dark:text-white">Account Explorer</span>
          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded">3,924 results</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-slate-500 border border-slate-200 dark:border-white/[0.1] px-2 py-0.5 rounded-md">Sort</span>
          <span className="text-[10px] font-medium text-slate-500 border border-slate-200 dark:border-white/[0.1] px-2 py-0.5 rounded-md">Export</span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-5 py-2.5 flex items-center gap-2 border-b border-slate-50 dark:border-white/[0.03] flex-wrap">
        {['Beauty & Personal Care', 'India', 'Series B+', 'Omnichannel'].map(f => (
          <span key={f} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-[#C94C1E]/20 bg-[#C94C1E]/5 text-[#C94C1E]">
            {f} <span className="opacity-50 cursor-pointer">×</span>
          </span>
        ))}
        <span className="text-[10px] text-[#C94C1E] font-medium cursor-pointer ml-1">Clear all</span>
      </div>

      {/* Account cards */}
      <div className="p-3 space-y-2">
        {[
          { name: 'Mamaearth', domain: 'mamaearth.in', cat: 'Beauty & Personal Care', region: 'India', model: 'Pure D2C', tech: 8, signals: 1, traffic: '2M+', app: 'iOS Only', funding: 'Late Stage', techTags: ['Shopify', 'Klaviyo', 'GA'], signalTags: ['New Product Launch'], bg: '#C94C1E', i: 'M' },
          { name: 'Sugar Cosmetics', domain: 'sugarcosmetics.com', cat: 'Beauty & Personal Care', region: 'India', model: 'Omnichannel', tech: 12, signals: 3, traffic: '500K-2M', app: 'Both iOS & Android', funding: 'Series A+', techTags: ['Shopify', 'WebEngage'], signalTags: ['Recently Funded', 'App Launched'], bg: '#A93D18', i: 'S' },
          { name: 'Plum Goodness', domain: 'plumgoodness.com', cat: 'Beauty & Personal Care', region: 'India', model: 'Pure D2C', tech: 15, signals: 1, traffic: '100K-500K', app: 'No App', funding: 'Series B+', techTags: ['Magento', 'Segment'], signalTags: ['Recently Funded'], bg: '#343330', i: 'P' },
        ].map(a => (
          <div key={a.name} className="bg-white dark:bg-[#141414]/60 border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-white/[0.12] transition-all group">
            <div className="flex">
              {/* Checkbox */}
              <div className="w-9 flex items-start justify-center pt-3.5 border-r border-slate-100 dark:border-white/[0.04] flex-shrink-0">
                <div className="w-3.5 h-3.5 rounded border border-slate-300 dark:border-white/[0.12]" />
              </div>
              <div className="flex-1 min-w-0 px-3 py-3">
                {/* Row 1 */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: a.bg }}>{a.i}</div>
                  <span className="text-[13px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors">{a.name}</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold">
                    <Layers size={8} />{a.tech} tech
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[9px] font-bold">{a.signals} signal{a.signals > 1 ? 's' : ''}</span>
                  <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                    {a.techTags.map(t => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[8px] font-semibold text-slate-600 dark:text-neutral-300">{t}</span>
                    ))}
                  </div>
                </div>
                {/* Row 2 */}
                <p className="text-[10px] text-slate-500 dark:text-neutral-400 mb-1 ml-9">{a.cat} · {a.region} · {a.model}</p>
                {/* Row 3 */}
                <div className="flex items-center gap-1.5 ml-9 mb-1 flex-wrap">
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.04] text-[8px] font-medium text-slate-600 dark:text-neutral-300">
                    <TrendingUp size={8} className="text-blue-400" />{a.traffic} MAU
                  </span>
                  {a.app !== 'No App' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.04] text-[8px] font-medium text-slate-600 dark:text-neutral-300">
                      <Smartphone size={8} className="text-violet-400" />{a.app}
                    </span>
                  )}
                </div>
                {/* Row 4 */}
                <div className="flex items-center gap-2 ml-9">
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-green-600">
                    <DollarSign size={9} className="text-green-500" />{a.funding}
                  </span>
                  {a.signalTags.map(s => (
                    <span key={s} className="inline-flex items-center gap-0.5 text-[9px] text-slate-500 dark:text-neutral-400">
                      <Target size={8} className="text-amber-400" />{s}
                    </span>
                  ))}
                </div>
              </div>
              {/* Visit */}
              <div className="w-8 flex items-start justify-center pt-3.5 border-l border-slate-100 dark:border-white/[0.04] flex-shrink-0 text-slate-300 dark:text-neutral-600">
                <ExternalLink size={12} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 2. Watchlists Mockup ────────────────────────────────────────────────── */
function WatchlistsMockup() {
  return (
    <div className="space-y-3">
      {/* Watchlist grid */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-slate-500 dark:text-neutral-400">4 watchlists</span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C94C1E] text-white text-[10px] font-bold">
          <Plus size={12} /> New Watchlist
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {[
          { name: 'Competitor Customers', count: 24, date: '2d ago', color: '#EF4444' },
          { name: 'Recently Funded', count: 18, date: '1d ago', color: '#3B82F6' },
          { name: 'Greenfield Opportunities', count: 31, date: 'Today', color: '#22C55E' },
          { name: 'High-Intent Beauty', count: 12, date: '5d ago', color: '#F59E0B' },
        ].map(wl => (
          <div key={wl.name}
            className="bg-white dark:bg-[#141414]/60 rounded-xl border border-slate-200 dark:border-white/[0.08] p-4 hover:shadow-md hover:border-slate-300 dark:hover:border-white/[0.12] transition-all cursor-pointer group">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: wl.color }} />
                <h3 className="text-[13px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors">{wl.name}</h3>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400"><Pencil size={10} /></span>
                <span className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={10} /></span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-neutral-500">
              <span className="font-semibold text-slate-600 dark:text-neutral-300">{wl.count} accounts</span>
              <span className="text-slate-200 dark:text-white/10">&bull;</span>
              <span>Updated {wl.date}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Live watchlist detail preview */}
      <div className="mt-3 rounded-xl bg-slate-900 dark:bg-slate-800/90 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-1.5">
            <Bell size={10} className="text-slate-400" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">Active Signals</span>
          </div>
          <span className="text-[9px] font-medium text-emerald-500 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-500" /> Live
          </span>
        </div>
        {[
          { name: 'Competitor Customers', signals: 5, trend: '+12%', color: '#EF4444' },
          { name: 'Recently Funded', signals: 12, trend: '+34%', color: '#3B82F6' },
          { name: 'Greenfield Opportunities', signals: 8, trend: '+18%', color: '#22C55E' },
        ].map(r => (
          <div key={r.name} className="flex items-center justify-between rounded-lg bg-white/[0.06] hover:bg-white/[0.1] px-3 py-2.5 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full flex-shrink-0 ring-2 ring-white/10" style={{ backgroundColor: r.color }} />
              <span className="text-[11px] font-medium text-slate-200">{r.name}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[9px] font-medium text-emerald-400 flex items-center gap-0.5">
                <TrendingUp size={8} />{r.trend}
              </span>
              <span className="text-[10px] font-semibold text-[#C94C1E] bg-[#C94C1E]/10 px-1.5 py-0.5 rounded-md">{r.signals} new</span>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between px-2 pt-1">
          <span className="text-[9px] text-slate-500">25 total signals this week</span>
          <span className="text-[9px] font-medium text-[#C94C1E]">View all</span>
        </div>
      </div>
    </div>
  );
}

/* ── 3. Market Intelligence Mockup ───────────────────────────────────────── */
function MarketIntelMockup() {
  return (
    <div className="space-y-3">
      {/* Period toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400 dark:text-neutral-500">Beauty, Fashion, Food & Bev · India</span>
        <div className="flex items-center gap-0.5 bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-lg p-0.5">
          {['This Week', 'Last 2 Weeks', 'Last Month'].map((p, i) => (
            <span key={p} className={`px-2.5 py-1 rounded-md text-[9px] font-semibold transition-all ${i === 0 ? 'bg-[#C94C1E] text-white shadow-sm' : 'text-slate-500 dark:text-neutral-400'}`}>{p}</span>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'FUNDING', value: '7', sub: '+3 vs last week', icon: <DollarSign size={12} /> },
          { label: 'STORES', value: '18', sub: 'across 5 brands', icon: <Store size={12} /> },
          { label: 'APPS', value: '4', sub: '3 iOS-first', icon: <Smartphone size={12} /> },
          { label: 'HIRES', value: '11', sub: 'VP+ level', icon: <Users size={12} /> },
          { label: 'GROWTH', value: '9', sub: '>30% QoQ', icon: <TrendingUp size={12} /> },
        ].map(c => (
          <div key={c.label} className="bg-white dark:bg-[#141414]/60 border border-slate-200 dark:border-white/[0.08] rounded-xl p-3 hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[7px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">{c.label}</span>
              <span className="text-slate-300 dark:text-neutral-600">{c.icon}</span>
            </div>
            <p className="text-[20px] font-extrabold leading-none text-slate-800 dark:text-white mb-0.5">{c.value}</p>
            <p className="text-[8px] text-slate-400 dark:text-neutral-500 font-medium">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Signal accordion sections */}
      <div className="space-y-1.5">
        {[
          { label: 'Funding Activity', icon: <DollarSign size={14} />, color: 'text-amber-400', bg: 'bg-amber-400/10', count: 3, expanded: true,
            signals: [
              { brand: 'Mamaearth', domain: 'mamaearth.in', headline: 'Raised $30M Series D led by Sequoia Capital', date: '2 days ago' },
              { brand: 'boAt', domain: 'boat-lifestyle.com', headline: 'IPO filing — valued at $1.5B', date: '3 days ago' },
            ]},
          { label: 'Store Expansion', icon: <Store size={14} />, color: 'text-blue-400', bg: 'bg-blue-400/10', count: 2, expanded: false, signals: [] },
          { label: 'App Launches', icon: <Smartphone size={14} />, color: 'text-violet-400', bg: 'bg-violet-400/10', count: 2, expanded: false, signals: [] },
          { label: 'Key Hiring', icon: <Users size={14} />, color: 'text-cyan-400', bg: 'bg-cyan-400/10', count: 2, expanded: false, signals: [] },
        ].map(section => (
          <div key={section.label} className={`bg-white dark:bg-[#141414]/60 border rounded-xl transition-all ${section.expanded ? 'border-slate-300 dark:border-white/[0.12] shadow-sm' : 'border-slate-200 dark:border-white/[0.08]'}`}>
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg ${section.bg} flex items-center justify-center ${section.color}`}>
                  {section.icon}
                </div>
                <span className="text-[12px] font-bold text-slate-800 dark:text-white">{section.label}</span>
                <span className="w-5 h-5 rounded-full bg-[#C94C1E]/10 text-[#C94C1E] text-[9px] font-bold flex items-center justify-center">{section.count}</span>
              </div>
              <ChevronDown size={14} className={`text-slate-300 dark:text-neutral-600 transition-transform duration-200 ${section.expanded ? 'rotate-180' : ''}`} />
            </div>
            {section.expanded && section.signals.length > 0 && (
              <div className="px-4 pb-3 space-y-2 border-t border-slate-100 dark:border-white/[0.06] pt-2.5">
                {section.signals.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50/70 dark:bg-white/[0.04] rounded-lg group/sig">
                    <div className="w-7 h-7 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-slate-500">{s.brand[0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-white">{s.brand}</span>
                        <span className="text-[9px] text-slate-400 dark:text-neutral-500">{s.domain}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-neutral-300 leading-snug">{s.headline}</p>
                    </div>
                    <span className="text-[9px] text-slate-400 dark:text-neutral-500 font-medium flex-shrink-0">{s.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 4. Smart Alerts Mockup ──────────────────────────────────────────────── */
function SmartAlertsMockup() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-[#C94C1E]" strokeWidth={2.5} />
          <span className="text-[11px] font-semibold tracking-[0.06em] uppercase text-slate-500 dark:text-slate-400">Live D2C Signals</span>
        </div>
        <span className="text-[9px] font-mono text-emerald-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Updated just now
        </span>
      </div>

      {[
        { initial: 'P', bg: '#C94C1E', name: 'Plum Goodness', sub: 'Beauty · Mumbai', signal: 'Got funded for $8.2M in Series B from Faering Capital', score: 94, tag: 'Funding', tagColor: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', ago: '2d ago' },
        { initial: 'M', bg: '#343330', name: 'Mokobara', sub: 'Luggage · Bangalore', signal: 'Hired a VP of Growth — tool purchases expected in 90d', score: 82, tag: 'Hiring', tagColor: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', ago: '5d ago' },
        { initial: 'S', bg: '#A93D18', name: 'Sugar Cosmetics', sub: 'Beauty · Mumbai', signal: 'Launched Android app — now live on iOS + Android', score: 91, tag: 'Digital', tagColor: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400', ago: '1d ago' },
      ].map(b => (
        <div key={b.name} className="rounded-xl p-3.5 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-none">
          <div className="flex items-start justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-[11px]" style={{ backgroundColor: b.bg }}>{b.initial}</div>
              <div>
                <p className="text-[12px] font-semibold text-slate-900 dark:text-white leading-tight">{b.name}</p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500">{b.sub}</p>
              </div>
            </div>
            <span className="text-[11px] font-bold font-mono text-[#C94C1E] bg-[#C94C1E]/10 px-1.5 py-0.5 rounded-md flex-shrink-0">{b.score}</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">{b.signal}</p>
          <div className="flex items-center justify-between">
            <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full ${b.tagColor}`}>{b.tag}</span>
            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-600">{b.ago}</span>
          </div>
        </div>
      ))}

      <p className="text-center text-[9px] text-slate-400 dark:text-slate-600 mt-1">500,000+ D2C brands monitored in real time</p>
    </div>
  );
}

/* ── 5. Tech Scanner Mockup ──────────────────────────────────────────────── */
function TechScannerMockup() {
  return (
    <div className="space-y-3">
      {/* Scanner input */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] px-3 py-2">
        <Radar size={14} className="text-[#C94C1E] flex-shrink-0" />
        <span className="text-[11px] text-slate-400 flex-1">mamaearth.in</span>
        <span className="px-3 py-1 rounded-lg bg-[#C94C1E] text-white text-[10px] font-bold">Scan</span>
      </div>

      {/* Results header */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-[12px] font-bold text-[#C94C1E]">M</div>
        <div>
          <p className="text-[13px] font-bold text-slate-800 dark:text-white">Mamaearth</p>
          <p className="text-[9px] text-slate-400"><span className="font-mono text-[#C94C1E]">mamaearth.in</span> · 8 technologies across 6 categories</p>
        </div>
      </div>

      {/* Tech categories */}
      <div className="space-y-2.5">
        {[
          { cat: 'Ecommerce Platform', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: <Store size={12} />, techs: ['Shopify'] },
          { cat: 'Analytics', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: <TrendingUp size={12} />, techs: ['Google Analytics', 'Hotjar', 'Segment'] },
          { cat: 'Customer Engagement', color: 'text-pink-500', bg: 'bg-pink-500/10', icon: <Users size={12} />, techs: ['Klaviyo', 'CleverTap'] },
          { cat: 'Payment Processors', color: 'text-green-500', bg: 'bg-green-500/10', icon: <DollarSign size={12} />, techs: ['Razorpay'] },
          { cat: 'CDN', color: 'text-sky-500', bg: 'bg-sky-500/10', icon: <Monitor size={12} />, techs: ['Cloudflare'] },
        ].map(c => (
          <div key={c.cat}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`w-5 h-5 rounded-md ${c.bg} flex items-center justify-center ${c.color}`}>{c.icon}</span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wide">{c.cat}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-6">
              {c.techs.map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-[10px] font-medium text-slate-700 dark:text-neutral-200 hover:border-slate-300 transition-colors">
                  <span className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-white/[0.1] flex-shrink-0" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Features Section — assembles all mockups ────────────────────────────── */
const FEATURES = [
  {
    id: 'explorer',
    title: 'Account Explorer',
    desc: 'The most comprehensive D2C database. Filter by geography, category, business model, scale, tech stack, and funding status. Find exactly the accounts that match your ICP.',
    bullets: ['13 advanced filter categories', 'D2C-specific taxonomy with 500K+ brands', 'Priority scores per account', 'Bulk select and add to watchlists'],
    stat: '500K+',
    statLabel: 'D2C brands indexed',
    icon: Search,
    Mockup: AccountExplorerMockup,
    mockupWide: true,
  },
  {
    id: 'watchlists',
    title: 'Watchlists',
    desc: 'The core of HarvinAI. Create custom watchlists for competitive tracking, churn monitoring, deal sourcing, or prospect management. Get alerted the moment something changes.',
    bullets: ['Build from filters, manual add, or CSV import', 'Real-time Slack and email alerts', 'Aggregate trends across your watchlist', 'CRM sync to HubSpot & Salesforce'],
    stat: 'Real-time',
    statLabel: 'signal monitoring',
    icon: Bookmark,
    Mockup: WatchlistsMockup,
    mockupWide: false,
  },
  {
    id: 'market-intel',
    title: 'Market Intelligence',
    desc: 'Weekly D2C market trends — funding activity, omnichannel expansion, app adoption, and category momentum. The context that makes you the smartest person on the call.',
    bullets: ['Funding rounds tracked in real-time', 'Category trend analysis', 'Geographic expansion tracking', '6 signal categories with expandable detail'],
    stat: '2,400+',
    statLabel: 'signals tracked weekly',
    icon: TrendingUp,
    Mockup: MarketIntelMockup,
    mockupWide: true,
  },
  {
    id: 'alerts',
    title: 'Smart Alerts',
    desc: 'Push signals directly to Slack, email, or your CRM. Know the moment a target account fires a buying signal — with intent scores so you prioritize the right outreach.',
    bullets: ['Slack, email & CRM delivery', 'Intent scores 0–100 per account', 'Custom trigger rules', '<5 min average alert latency'],
    stat: '<5 min',
    statLabel: 'average alert latency',
    icon: Zap,
    Mockup: SmartAlertsMockup,
    mockupWide: false,
  },
  {
    id: 'tech-scanner',
    title: 'Tech Scanner',
    desc: 'See exactly which ecommerce platform, CRM, payment gateway, and marketing tools every D2C brand uses. Powered by our scanner with 4,000+ technology signatures.',
    bullets: ['4,000+ technologies detected', 'Competitive displacement insights', 'Migration & adoption signals', 'Scan any domain instantly for free'],
    stat: '4,000+',
    statLabel: 'tech signatures',
    icon: Radar,
    Mockup: TechScannerMockup,
    mockupWide: false,
  },
];

function FeatureBlock({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const reveal = useReveal(0.1);
  const isReversed = index % 2 !== 0;

  return (
    <div ref={reveal.ref}>
      <div
        className={`group rounded-2xl border border-slate-200 dark:border-white/[0.08]
                     bg-white dark:bg-slate-900/60 overflow-hidden
                     hover:shadow-[0_12px_40px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]
                     hover:border-slate-300 dark:hover:border-white/[0.14]
                     transition-all duration-500
                     ${reveal.visible ? 'animate-float-up' : 'opacity-0'}`}
        style={reveal.visible ? { animationDelay: `${index * 80}ms` } : undefined}
      >
        {/* Top accent */}
        <div className="h-[2px] w-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
             style={{ background: 'linear-gradient(to right, transparent, #C94C1E, transparent)' }} />

        <div className={`flex flex-col ${feature.mockupWide ? 'lg:flex-col' : isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
          {/* Text content */}
          <div className={`${feature.mockupWide ? 'w-full' : 'lg:w-[45%]'} p-8 lg:p-10 flex flex-col justify-center`}>
            <div className="flex items-start justify-between mb-5">
              <div className="h-12 w-12 rounded-xl bg-[#C94C1E]/10 flex items-center justify-center
                              ring-1 ring-[#C94C1E]/10 group-hover:bg-[#C94C1E]/[0.18]
                              transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-3deg]">
                <feature.icon size={22} className="text-[#C94C1E]" />
              </div>
              <div className="text-right">
                <p className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white leading-none">{feature.stat}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{feature.statLabel}</p>
              </div>
            </div>

            <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white mb-3
                           group-hover:text-[#C94C1E] transition-colors duration-300">
              {feature.title}
            </h3>
            <p className="text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
              {feature.desc}
            </p>

            <div className="h-px bg-slate-100 dark:bg-white/[0.06] mb-5" />

            <ul className="space-y-3">
              {feature.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[14px] text-slate-700 dark:text-slate-300
                                       transition-all duration-300 hover:translate-x-1">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-[#C94C1E]/10 flex items-center justify-center flex-shrink-0">
                    <Check size={12} className="text-[#C94C1E]" strokeWidth={2.5} />
                  </div>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup */}
          <div className={`${feature.mockupWide ? 'w-full' : 'lg:w-[55%]'}
                          ${isReversed && !feature.mockupWide ? 'lg:border-r' : feature.mockupWide ? 'border-t' : 'lg:border-l'}
                          border-slate-100 dark:border-white/[0.06]
                          bg-slate-50/60 dark:bg-white/[0.02]
                          p-5 lg:p-6 overflow-hidden`}>
            <feature.Mockup />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturesSection() {
  const headerReveal = useReveal();

  return (
    <>
      {/* Header */}
      <div
        ref={headerReveal.ref}
        className={`max-w-[620px] mx-auto text-center mb-16 transition-all duration-700
                    ${headerReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      >
        <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                        border border-[#C94C1E]/20 bg-[#C94C1E]/[0.06] mb-6
                        transition-all duration-500 delay-100
                        ${headerReveal.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C94C1E]">
            Platform Features
          </span>
        </div>
        <h2 className="text-[clamp(26px,4vw,44px)] font-semibold leading-[1.1] tracking-[-0.025em]
                       text-slate-900 dark:text-white mb-4">
          Everything you need to own the D2C market
        </h2>
        <p className="text-[16px] leading-relaxed text-slate-500 dark:text-slate-400">
          Five integrated modules with the exact interface your team will use — from discovery to deal close.
        </p>
      </div>

      {/* Feature blocks */}
      <div className="space-y-8">
        {FEATURES.map((feature, i) => (
          <FeatureBlock key={feature.id} feature={feature} index={i} />
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════════════ */

export default function ProductPage() {
  const { openModal } = useModal();

  const heroReveal = useReveal(0.05);
  const audienceHeader = useReveal();
  const stepsHeader = useReveal();
  const useCasesHeader = useReveal();

  /* Hero text animation state */
  const [heroReady, setHeroReady] = useState(false);
  useEffect(() => {
    if (heroReveal.visible) {
      const t = setTimeout(() => setHeroReady(true), 100);
      return () => clearTimeout(t);
    }
  }, [heroReveal.visible]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
      <style>{pageStyles}</style>
      <Navbar />
      <div className="pt-[64px]">

        {/* ═══ HERO ═══════════════════════════════════════════════════════════ */}
        <section ref={heroReveal.ref} className="relative overflow-hidden
                   bg-gradient-to-b from-slate-50 via-white to-white
                   dark:from-slate-900/60 dark:via-slate-950 dark:to-slate-950">
          {/* Animated radial glow */}
          <div className="pointer-events-none absolute top-[-80px] left-1/2 w-[1100px] h-[700px]"
               style={{ animation: 'heroGlow 8s ease-in-out infinite' }}>
            <div className="w-full h-full
                            bg-[radial-gradient(ellipse_at_center,rgba(201,76,30,0.06),transparent_65%)]
                            dark:bg-[radial-gradient(ellipse_at_center,rgba(201,76,30,0.10),transparent_65%)]" />
          </div>

          {/* Grid pattern overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
               style={{
                 backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
                 backgroundSize: '60px 60px',
               }} />

          <div className="relative z-10 max-w-[1000px] mx-auto px-6 pt-28 pb-24 text-center">

            {/* Badge */}
            <div
              className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8
                          border border-[#C94C1E]/20 bg-[#C94C1E]/[0.06]
                          backdrop-blur-sm
                          transition-all duration-700
                          ${heroReady ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
            >
              
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C94C1E]">
                D2C Intelligence Platform
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-sans font-bold tracking-[-0.03em] leading-[1.08] mb-7
                           text-[clamp(32px,5.5vw,64px)]
                           text-slate-900 dark:text-slate-50">
              <span className={`inline-block transition-all duration-700 delay-[150ms]
                               ${heroReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                The D2C intelligence platform
              </span>
              <br />
              <span className={`inline-block transition-all duration-700 delay-[300ms]
                               ${heroReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                built for{' '}
                <HeroRotatingWord heroReady={heroReady} />
              </span>
            </h1>

            {/* Sub */}
            <p className={`text-[17px] leading-relaxed text-slate-500 dark:text-slate-400
                          max-w-[600px] mx-auto mb-10
                          transition-all duration-700 delay-[500ms]
                          ${heroReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              HarvinAI tracks 500K+ D2C brands, detects real-time buying signals, and tells your team
              exactly <em className="not-italic font-medium text-slate-700 dark:text-slate-300">who to sell to and when</em>.
              Stop guessing. Start closing.
            </p>

            {/* CTAs */}
            <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 mb-16
                            transition-all duration-700 delay-[650ms]
                            ${heroReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <button
                onClick={() => openModal('early-access')}
                className="group/btn inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full text-[15px] font-semibold
                           text-white bg-[#C94C1E] shadow-[0_2px_12px_rgba(201,76,30,0.35)]
                           hover:bg-[#b8431a] hover:shadow-[0_8px_30px_rgba(201,76,30,0.5)]
                           hover:scale-[1.03] active:scale-[0.98]
                           transition-all duration-200"
              >
                Get early access
                <ArrowRight size={16} className="transition-transform duration-200 group-hover/btn:translate-x-1" />
              </button>
              <a href="/pricing"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[15px] font-semibold
                           text-slate-700 dark:text-slate-300
                           border border-slate-300 dark:border-white/[0.18]
                           hover:text-slate-900 dark:hover:text-white
                           hover:border-slate-400 dark:hover:border-white/40
                           hover:bg-slate-50 dark:hover:bg-white/[0.06]
                           hover:scale-[1.02] active:scale-[0.98]
                           transition-all duration-200"
              >
                View pricing
              </a>
            </div>

            {/* Stat highlights */}
            <div className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-3
                            transition-all duration-700 delay-[800ms]
                            ${heroReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {[
                { numEnd: 500, suffix: 'K+', label: 'D2C brands' },
                { numEnd: 4000, suffix: '+', label: 'Tech signatures' },
                { numEnd: 5, suffix: ' min', prefix: '<', label: 'Signal latency' },
                { numEnd: 2400, suffix: '+', label: 'Weekly signals' },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-2 text-[14px]"
                  style={heroReady ? { animation: `floatUp 0.5s cubic-bezier(0.16,1,0.3,1) ${800 + i * 100}ms both` } : { opacity: 0 }}>
                  <HeroStat numEnd={s.numEnd} suffix={s.suffix} prefix={s.prefix} label={s.label} ready={heroReady} delay={800 + i * 100} />
                  <span className="text-slate-400 dark:text-slate-500">{s.label}</span>
                  {i < 3 && <span className="hidden sm:inline-block w-px h-3.5 bg-slate-200 dark:bg-white/[0.1] ml-6" />}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom fade into next section */}
          <div className="absolute bottom-0 inset-x-0 h-16
                          bg-gradient-to-t from-slate-50 to-transparent
                          dark:from-slate-900/40 dark:to-transparent pointer-events-none" />
        </section>


        {/* ═══ WHO IT'S FOR ══════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900/40
                            border-y border-slate-200 dark:border-white/[0.06]
                            relative overflow-hidden">

          <div className="relative max-w-[1100px] mx-auto">
            {/* Header */}
            <div
              ref={audienceHeader.ref}
              className={`max-w-[620px] mx-auto text-center mb-16 transition-all duration-700
                          ${audienceHeader.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            >
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                              border border-[#C94C1E]/20 bg-[#C94C1E]/[0.06] mb-6
                              transition-all duration-500 delay-100
                              ${audienceHeader.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C94C1E]">
                  Who it&apos;s for
                </span>
              </div>
              <h2 className="text-[clamp(26px,4vw,44px)] font-semibold leading-[1.1] tracking-[-0.025em]
                             text-slate-900 dark:text-white mb-4">
                Built for teams that sell to D2C brands
              </h2>
              <p className="text-[16px] leading-relaxed text-slate-500 dark:text-slate-400">
                Whether you&apos;re a SaaS vendor, agency, or service provider —
                HarvinAI gives you the intelligence edge to find, qualify, and close D2C deals faster.
              </p>
            </div>

            {/* Cards — each triggers individually */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {AUDIENCE.map((item, i) => (
                <AudienceCard key={item.title} item={item} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS — 4 STEPS ════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900/30
                            border-y border-slate-200 dark:border-white/[0.06]">
          <div className="max-w-[1100px] mx-auto">
            {/* Header */}
            <div
              ref={stepsHeader.ref}
              className={`max-w-[620px] mx-auto text-center mb-16 transition-all duration-700
                          ${stepsHeader.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            >
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                              border border-[#C94C1E]/20 bg-[#C94C1E]/[0.06] mb-6
                              transition-all duration-500 delay-100
                              ${stepsHeader.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C94C1E]">
                  How it works
                </span>
              </div>
              <h2 className="text-[clamp(26px,4vw,44px)] font-semibold leading-[1.1] tracking-[-0.025em]
                             text-slate-900 dark:text-white mb-4">
                From signal to signed deal in 4 steps
              </h2>
              <p className="text-[16px] leading-relaxed text-slate-500 dark:text-slate-400">
                HarvinAI turns raw market intelligence into qualified pipeline — automatically.
              </p>
            </div>

            {/* Steps — each triggers individually with animated visuals */}
            <div className="space-y-3">
              {HIW_STEPS.map((step, i) => (
                <HowItWorksStep key={step.number} step={step} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FEATURES — LIVE UI PREVIEWS ═════════════════════════════════ */}
        <section className="py-24 px-6">
          <div className="max-w-[1200px] mx-auto">
            <FeaturesSection />
          </div>
        </section>

        {/* ═══ USE CASES ═════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900/30 border-y border-slate-200 dark:border-white/[0.06]">
          <div className="max-w-[1100px] mx-auto">
            {/* Header */}
            <div
              ref={useCasesHeader.ref}
              className={`max-w-[620px] mx-auto text-center mb-16 transition-all duration-700
                          ${useCasesHeader.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            >
              <h2 className="text-[clamp(26px,4vw,44px)] font-semibold leading-[1.1] tracking-[-0.025em]
                             text-slate-900 dark:text-white mb-4">
                How teams use HarvinAI
              </h2>
              <p className="text-[16px] leading-relaxed text-slate-500 dark:text-slate-400">
                Real results from teams selling into the D2C ecosystem.
              </p>
            </div>

            {/* Cards — each triggers individually */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {USE_CASES.map((uc, i) => (
                <UseCaseCard key={uc.title} uc={uc} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══════════════════════════════════════════════════════════ */}
        <CTA />

      </div>
      <Footer />
    </div>
  );
}
