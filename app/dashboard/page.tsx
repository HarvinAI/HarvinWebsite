'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, Building2, TrendingUp, Bell, Search,
  LogOut, Settings, LayoutDashboard, BookMarked,
  BarChart3, Clock, ChevronRight,
} from 'lucide-react';

type User    = { type: string; name: string; email: string };
type Answers = { goal?: 'outreach' | 'research' | 'trends'; jobRole?: string; companyName?: string; persona?: string };

const GOAL_LABELS: Record<string, string> = {
  outreach: 'Finding companies to outreach',
  research: 'Competitive research',
  trends:   'Tracking market trends',
};

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard',      active: true  },
  { icon: Building2,       label: 'Brand Database', active: false },
  { icon: Zap,             label: 'Live Signals',   active: false },
  { icon: BookMarked,      label: 'Watchlists',     active: false },
  { icon: BarChart3,       label: 'Analytics',      active: false },
  { icon: Settings,        label: 'Settings',       active: false },
];

const SIGNAL_PREVIEW = [
  { initial: 'P', bg: '#C94C1E', name: 'Plum Goodness',   sub: 'Beauty · Mumbai',      signal: 'Got funded for $8.2M in Series B',        score: 94, tag: 'Funding'   },
  { initial: 'M', bg: '#343330', name: 'Mokobara',         sub: 'Luggage · Bangalore',  signal: 'Hired a VP of Growth',                    score: 82, tag: 'Hiring'    },
  { initial: 'S', bg: '#A93D18', name: 'Sugar Cosmetics',  sub: 'Beauty · Mumbai',      signal: 'Launched Android app',                    score: 91, tag: 'Digital'   },
  { initial: 'B', bg: '#1A9A82', name: 'Bombay Shaving',   sub: 'Grooming · Delhi',     signal: '3 new retail stores opened in Bangalore', score: 87, tag: 'Expansion' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user,    setUser]    = useState<User | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [ready,   setReady]   = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('harvin_user');
    const o = localStorage.getItem('harvin_onboarding');
    if (!u) { router.replace('/signin'); return; }
    setUser(JSON.parse(u));
    if (o) setAnswers(JSON.parse(o).answers ?? {});
    setReady(true);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('harvin_user');
    localStorage.removeItem('harvin_onboarding');
    router.push('/signin');
  };

  if (!ready) return null;

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-[220px] flex-shrink-0 flex-col bg-white border-r border-slate-200 fixed top-0 left-0 bottom-0 z-40">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="" className="h-7 w-7" />
            <span className="font-jakarta font-bold text-[18px] tracking-[-0.02em] text-slate-900 leading-none">
              Harvin<span className="font-normal opacity-35">AI</span>
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {NAV.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              type="button"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium w-full text-left transition-colors ${
                active
                  ? 'bg-ember-50 text-ember-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.7} className={active ? 'text-ember-500' : ''} />
              {label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-ember-100 flex items-center justify-center text-ember-700 text-[12px] font-bold flex-shrink-0">
              {firstName[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-800 truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-slate-400 hover:text-slate-700 hover:bg-slate-50 w-full transition-colors"
          >
            <LogOut size={14} strokeWidth={1.7} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="flex-1 md:ml-[220px] flex flex-col min-h-screen">

        {/* Top bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h1 className="text-[16px] font-semibold text-slate-900">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[13px] text-slate-400 cursor-text">
              <Search size={13} strokeWidth={1.8} />
              <span>Search brands…</span>
            </div>
            <button className="relative w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
              <Bell size={15} strokeWidth={1.8} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-ember-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-8 max-w-[1100px] w-full mx-auto">

          {/* Welcome banner */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0C0B09] to-[#1a150f] p-7 mb-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full"
                 style={{ background: 'radial-gradient(circle, rgba(201,76,30,0.2) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
            <div className="relative">
              <p className="text-[13px] font-medium text-ember-400 mb-2">Welcome aboard 🎉</p>
              <h2 className="text-[24px] font-bold text-white tracking-[-0.02em] mb-2">
                Hi {firstName}, you&apos;re all set!
              </h2>
              <p className="text-[14px] text-white/55 max-w-[500px] leading-relaxed">
                {answers.goal
                  ? `Your dashboard is being personalised for ${GOAL_LABELS[answers.goal]?.toLowerCase() ?? 'your goals'}.`
                  : 'Your personalised D2C brand intelligence dashboard is almost ready.'
                } We&apos;re actively building the platform — you&apos;ll get early access soon.
              </p>
              <div className="mt-5 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[13px] font-medium text-emerald-400">You&apos;re on the early access list</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            {[
              { icon: Building2,  label: 'Brands tracked',    value: '500K+', sub: 'D2C brands in database',  color: 'text-blue-600',   bg: 'bg-blue-50'   },
              { icon: Zap,        label: 'Live signals today', value: '—',     sub: 'Available on launch',     color: 'text-amber-600',  bg: 'bg-amber-50'  },
              { icon: TrendingUp, label: 'Intent matches',     value: '—',     sub: 'Available on launch',     color: 'text-emerald-600',bg: 'bg-emerald-50'},
              { icon: Clock,      label: 'Est. launch',        value: 'Soon',  sub: 'You\'ll be notified',     color: 'text-ember-600',  bg: 'bg-ember-50'  },
            ].map(({ icon: Icon, label, value, sub, color, bg }) => (
              <div key={label} className="rounded-xl bg-white border border-slate-200 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                  <Icon size={15} className={color} strokeWidth={2} />
                </div>
                <p className="text-[22px] font-bold text-slate-900 tracking-[-0.02em] leading-none mb-1">{value}</p>
                <p className="text-[12px] font-medium text-slate-600">{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

            {/* Signal preview */}
            <div className="rounded-xl bg-white border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-ember-500" strokeWidth={2.5} />
                  <p className="text-[14px] font-semibold text-slate-900">Live D2C Signals</p>
                </div>
                <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Preview
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {SIGNAL_PREVIEW.map((b) => (
                  <div key={b.name} className="flex items-start gap-3.5 px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div
                      className="w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0 text-white font-bold text-[13px]"
                      style={{ backgroundColor: b.bg }}
                    >
                      {b.initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{b.name}</p>
                        <span className="text-[12px] font-bold font-mono text-ember-500 bg-ember-50 px-1.5 py-0.5 rounded flex-shrink-0">{b.score}</span>
                      </div>
                      <p className="text-[12px] text-slate-500 truncate">{b.signal}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3.5 border-t border-slate-100">
                <p className="text-[12px] text-slate-400 text-center">
                  Full signal feed unlocks on platform launch
                </p>
              </div>
            </div>

            {/* Your profile summary */}
            <div className="flex flex-col gap-4">

              <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <p className="text-[13px] font-semibold text-slate-900 mb-4">Your profile</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Goal',    value: GOAL_LABELS[answers.goal ?? ''] ?? '—' },
                    { label: 'Role',    value: answers.jobRole    ?? '—' },
                    { label: 'Company', value: answers.companyName ?? '—' },
                    { label: 'Type',    value: answers.persona ? answers.persona.charAt(0).toUpperCase() + answers.persona.slice(1) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between gap-2">
                      <span className="text-[12px] text-slate-400 flex-shrink-0">{label}</span>
                      <span className="text-[12px] font-medium text-slate-700 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-ember-200 bg-ember-50 p-5">
                <p className="text-[13px] font-semibold text-ember-800 mb-1.5">What&apos;s coming</p>
                <ul className="flex flex-col gap-2">
                  {['Live signal feed for 500K+ brands','Intent scoring & buying windows',
                    'Automated prospect watchlists','CRM & Slack integrations'].map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <ChevronRight size={13} className="text-ember-500 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span className="text-[12px] text-ember-700 leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
