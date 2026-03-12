'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowRight, ArrowLeft, Check, ChevronDown, Building2, User, Mail, Link2, Monitor, Megaphone, LineChart, PenTool, Layers, Package, Wifi, Shirt, Sparkles, UtensilsCrossed, Heart, Sofa, Cpu, Baby, PawPrint, Gem, Dumbbell, Bath, LayoutGrid, Globe, Tag, Sprout, Rocket, Store, Users, ShoppingBag, Link as LinkIcon } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

/* ── Types ───────────────────────────────────────────────────────────────── */
type Persona = 'saas' | 'agency' | 'investor' | 'freelancer' | 'other';
type BrandType = 'physical' | 'digital';

type Answers = {
  fullName?: string;
  email?: string;
  persona?: Persona;
  companyName?: string;
  companyLink?: string;
  jobRole?: string;
  heardFrom?: string[];
  categories?: string[];
  geoFocus?: string[];
  brandSize?: string[];
  brandTypes?: BrandType[];
  channelMix?: string[];
  offlineStores?: string;
  revenueModel?: string[];
  mau?: string;
  companySize?: string[];
  revenueRange?: string[];
  techStackInterest?: boolean;
  techCategories?: string[];
  companiesToTrack?: string;
};

/* ── Step config ─────────────────────────────────────────────────────────── */
const PERSONAS: { id: Persona; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: 'saas',       icon: <Monitor size={18} strokeWidth={1.8} />,   label: 'SaaS Company',      desc: 'Tech vendors selling to D2C brands' },
  { id: 'agency',     icon: <Megaphone size={18} strokeWidth={1.8} />, label: 'Marketing Agency',   desc: 'Agencies serving D2C clients' },
  { id: 'investor',   icon: <LineChart size={18} strokeWidth={1.8} />, label: 'Investor',           desc: 'VCs, angels & fund managers' },
  { id: 'freelancer', icon: <PenTool size={18} strokeWidth={1.8} />,   label: 'Freelancer',         desc: 'Independent consultants & contractors' },
  { id: 'other',      icon: <Layers size={18} strokeWidth={1.8} />,    label: 'Other',              desc: 'Anyone exploring the ecosystem' },
];

const JOB_ROLES = [
  'Owner/Founder', 'Marketing', 'Sales',
  'Growth', 'Other',
];

const HEARD_FROM = [
  'LinkedIn', 'Twitter / X', 'Google Search', 'Friend / Colleague',
  'Product Hunt', 'Newsletter', 'YouTube', 'Podcast', 'Other',
];

const GEO_REGIONS = [
  'India', 'United States', 'United Kingdom', 'Southeast Asia',
  'Middle East', 'Europe', 'Australia', 'Canada', 'Latin America', 'Africa', 'Global',
];

const D2C_CATEGORIES: { label: string; icon: React.ReactNode; color: string }[] = [
  { label: 'Fashion & Apparel',      icon: <Shirt size={14} strokeWidth={2} />,              color: 'text-pink-500' },
  { label: 'Beauty & Skincare',      icon: <Sparkles size={14} strokeWidth={2} />,            color: 'text-rose-500' },
  { label: 'Food & Beverage',        icon: <UtensilsCrossed size={14} strokeWidth={2} />,     color: 'text-orange-500' },
  { label: 'Health & Wellness',      icon: <Heart size={14} strokeWidth={2} />,               color: 'text-emerald-500' },
  { label: 'Home & Living',          icon: <Sofa size={14} strokeWidth={2} />,                color: 'text-amber-600' },
  { label: 'Electronics & Gadgets',  icon: <Cpu size={14} strokeWidth={2} />,                 color: 'text-blue-500' },
  { label: 'Baby & Kids',            icon: <Baby size={14} strokeWidth={2} />,                color: 'text-yellow-500' },
  { label: 'Pet Care',               icon: <PawPrint size={14} strokeWidth={2} />,            color: 'text-teal-500' },
  { label: 'Jewelry & Accessories',  icon: <Gem size={14} strokeWidth={2} />,                 color: 'text-violet-500' },
  { label: 'Fitness & Sports',       icon: <Dumbbell size={14} strokeWidth={2} />,            color: 'text-red-500' },
  { label: 'Personal Care',          icon: <Bath size={14} strokeWidth={2} />,                color: 'text-cyan-500' },
  { label: 'All Categories',         icon: <LayoutGrid size={14} strokeWidth={2} />,          color: 'text-slate-500' },
];

const BRAND_TYPE_OPTIONS: { id: BrandType; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: 'physical', icon: <Package size={22} strokeWidth={1.6} />, label: 'Physical Product Brand',  desc: 'D2C brands selling physical goods directly to consumers' },
  { id: 'digital',  icon: <Wifi size={22} strokeWidth={1.6} />,    label: 'Digital Product / Service', desc: 'SaaS, apps, subscriptions & online services' },
];

const BRAND_SIZES: { id: string; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: 'emerging',    icon: <Sprout size={22} strokeWidth={1.6} />,    label: 'Emerging Brands',     desc: 'Smaller brands, early stage (under 200K MAU)' },
  { id: 'growing',     icon: <Rocket size={22} strokeWidth={1.6} />,    label: 'Growing Brands',      desc: 'Mid-size, scaling fast (200K \u2013 2M MAU)' },
  { id: 'established', icon: <Building2 size={22} strokeWidth={1.6} />, label: 'Established Brands',  desc: 'Large brands, market leaders (2M+ MAU)' },
];

const CHANNEL_MIX_OPTIONS: { id: string; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: 'website_only',      icon: <Globe size={18} strokeWidth={1.6} />,      label: 'Own Website',            desc: 'Brands with their own online store' },
  { id: 'marketplace_only',  icon: <ShoppingBag size={18} strokeWidth={1.6} />,label: 'Marketplace',            desc: 'Brands selling on Amazon, Flipkart, etc.' },
  { id: 'omnichannel',       icon: <LinkIcon size={18} strokeWidth={1.6} />,   label: 'Website + Marketplace',  desc: 'Brands present on both channels' },
  { id: 'offline_retail',    icon: <Store size={18} strokeWidth={1.6} />,      label: 'Offline Retail',         desc: 'Brands with physical store locations' },
];

const REVENUE_MODELS = ['Subscription', 'Transactional', 'Hybrid', 'Any'];

const STEPS = [
  { number: '01', title: 'Basic Information',                       subtitle: 'Tell us a bit about yourself',                                                          optional: false },
  { number: '02', title: 'What D2C brands do you want to track?',  subtitle: 'Tell us what matters to you. We\u2019ll fill your dashboard with relevant brands and signals.', optional: false },
];

/* ── Sub-components ──────────────────────────────────────────────────────── */
function PersonaCard({ selected, onClick, icon, label, desc }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; label: string; desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all duration-150 ${
        selected
          ? 'border-ember-500 bg-ember-50 shadow-[0_0_0_3px_rgba(201,76,30,0.1)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        selected ? 'bg-ember-100 text-ember-600' : 'bg-slate-100 text-slate-500'
      }`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] font-semibold leading-snug ${selected ? 'text-ember-700' : 'text-slate-900'}`}>{label}</p>
        <p className="mt-0.5 text-[12px] text-slate-500 leading-snug">{desc}</p>
      </div>
      <div className={`h-5 w-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
        selected ? 'border-ember-500 bg-ember-500' : 'border-slate-300'
      }`}>
        {selected && <Check size={10} strokeWidth={3} className="text-white" />}
      </div>
    </button>
  );
}

function Chip({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 ${
        selected
          ? 'border-ember-500 bg-ember-500 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

function SelectDropdown({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full h-11 rounded-xl border border-slate-200 bg-white px-4 pr-10
                   text-[14px] appearance-none cursor-pointer
                   focus:outline-none focus:border-ember-400 transition-colors ${
          value ? 'text-slate-800' : 'text-slate-400'
        }`}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={16} strokeWidth={2} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [animating, setAnimating] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  // Admin gate
  useEffect(() => {
    if (status === 'loading') return;
    if (session && (session as unknown as Record<string, unknown>).isAdmin === false) {
      router.replace('/thankyou');
    }
  }, [session, status, router]);

  // Sync Google OAuth session → localStorage
  useEffect(() => {
    if (session?.user) {
      const existing = localStorage.getItem('harvin_user');
      if (!existing) {
        localStorage.setItem('harvin_user', JSON.stringify({
          type: 'google',
          name: session.user.name ?? '',
          email: session.user.email ?? '',
        }));
      }
    }
  }, [session]);

  useEffect(() => {
    const saved = localStorage.getItem('harvin_onboarding');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.completed) { router.replace('/dashboard'); return; }
        if (parsed.step !== undefined) setStep(Math.min(parsed.step, STEPS.length - 1));
        if (parsed.answers) setAnswers(parsed.answers);
      } catch (_e) { /* ignore corrupt data */ }
    }

    // Pre-fill from localStorage user data or session
    const user = localStorage.getItem('harvin_user');
    if (user) {
      try {
        const u = JSON.parse(user);
        if (u.type === 'google') setIsGoogleUser(true);
        setAnswers(prev => ({
          ...prev,
          fullName: prev.fullName || u.name || '',
          email: prev.email || u.email || '',
        }));
      } catch (_e) { /* ignore */ }
    } else if (session?.user) {
      setIsGoogleUser(true);
      setAnswers(prev => ({
        ...prev,
        fullName: prev.fullName || session.user?.name || '',
        email: prev.email || session.user?.email || '',
      }));
    }
  }, [router, session]);

  const save = (newAnswers: Answers, newStep: number) => {
    localStorage.setItem('harvin_onboarding', JSON.stringify({ step: newStep, answers: newAnswers }));
  };

  const navigate = (to: number) => {
    if (animating) return;
    setDirection(to > step ? 'forward' : 'back');
    setAnimating(true);
    setTimeout(() => {
      setStep(to);
      setAnimating(false);
    }, 180);
  };

  const goNext = () => {
    const next = step + 1;
    save(answers, next);
    if (next >= STEPS.length) {
      localStorage.setItem('harvin_onboarding', JSON.stringify({ step: next, answers, completed: true }));
      // Persist completion to DB so it works across browsers/devices
      const email = answers.email || session?.user?.email;
      if (email) {
        fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }).catch(() => {});
      }
      router.push('/syncing');
    } else {
      navigate(next);
    }
  };

  const goBack = () => {
    if (step > 0) navigate(step - 1);
  };

  const set = (patch: Partial<Answers>) => setAnswers(prev => ({ ...prev, ...patch }));

  const toggleInArray = (key: keyof Answers, value: string) => {
    const arr = (answers[key] as string[] | undefined) ?? [];
    set({ [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] } as Partial<Answers>);
  };

  const toggleBrandType = (bt: BrandType) => {
    const cur = answers.brandTypes ?? [];
    const next = cur.includes(bt) ? cur.filter(x => x !== bt) : [...cur, bt];
    set({
      brandTypes: next,
      ...(bt === 'physical' && cur.includes(bt) ? { channelMix: [], offlineStores: '' } : {}),
      ...(bt === 'digital' && cur.includes(bt) ? { revenueModel: undefined } : {}),
    });
  };

  const toggleChannelMix = (id: string) => {
    const cur = answers.channelMix ?? [];
    set({ channelMix: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] });
  };

  const hasPhysical = (answers.brandTypes ?? []).includes('physical');
  const hasDigital = (answers.brandTypes ?? []).includes('digital');
  const showMau = (hasPhysical || hasDigital) &&
    !((answers.channelMix ?? []).length === 1 && (answers.channelMix ?? []).includes('marketplace_only'));

  const canProceed = () => {
    if (step === 0) {
      if (isGoogleUser) return !!(answers.fullName?.trim() && answers.email?.trim() && answers.persona);
      return !!answers.persona;
    }
    if (step === 1) return (answers.categories ?? []).length > 0 && (answers.geoFocus ?? []).length > 0;
    return false;
  };

  const progress = ((step) / STEPS.length) * 100;
  const current = STEPS[step];

  return (
    <div className="min-h-screen bg-[#f7f7f8] flex flex-col">
      <ThemeToggle />

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <div className="h-8 w-9 overflow-hidden flex-shrink-0">
            <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto max-w-none" />
          </div>
          <span className="font-bricolage font-bold text-[24px] tracking-normal text-slate-900 dark:text-white leading-none">
            Harvin<span className="font-semibold opacity-40">AI</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < step ? 'bg-ember-500 w-6' : i === step ? 'bg-ember-500 w-10' : 'bg-slate-200 w-6'
                }`}
              />
            ))}
          </div>
          <span className="text-[12px] font-medium text-slate-400">
            {step + 1} / {STEPS.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-slate-100">
        <div
          className="h-full bg-ember-500 transition-all duration-500 ease-out"
          style={{ width: `${progress + (1 / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:py-8">
        <div
          className="w-full max-w-[680px]"
          style={{
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${direction === 'forward' ? '16px' : '-16px'})`
              : 'translateX(0)',
            transition: 'opacity 0.18s ease, transform 0.18s ease',
          }}
        >
          {/* Step header */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[12px] font-medium text-slate-400 tracking-[0.06em]">
                STEP {current.number}
              </span>
              {current.optional && (
                <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  Optional
                </span>
              )}
            </div>
            <h1 className="text-[26px] font-bold text-slate-900 tracking-[-0.02em] leading-[1.2] mb-1.5">
              {current.title}
            </h1>
            <p className="text-[15px] text-slate-500">{current.subtitle}</p>
          </div>

          {/* ── Step 1: Basic Information ────────────────────────────── */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              {/* Name & Email — only for Google users (credentials users filled these at signup) */}
              {isGoogleUser && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-2">
                        Full Name <span className="text-ember-500">*</span>
                      </label>
                      <div className="relative">
                        <User size={15} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="John Doe"
                          value={answers.fullName ?? ''}
                          onChange={e => set({ fullName: e.target.value })}
                          className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-4
                                     text-[14px] text-slate-800 placeholder:text-slate-400
                                     focus:outline-none focus:border-ember-400 transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-2">
                        Email <span className="text-ember-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail size={15} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          placeholder="john@company.com"
                          value={answers.email ?? ''}
                          onChange={e => set({ email: e.target.value })}
                          className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-4
                                     text-[14px] text-slate-800 placeholder:text-slate-400
                                     focus:outline-none focus:border-ember-400 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Company Name & Link — only for Google users */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-2">
                        Company Name <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <div className="relative">
                        <Building2 size={15} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="e.g. Acme Inc."
                          value={answers.companyName ?? ''}
                          onChange={e => set({ companyName: e.target.value })}
                          className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-4
                                     text-[14px] text-slate-800 placeholder:text-slate-400
                                     focus:outline-none focus:border-ember-400 transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-2">
                        Company Website <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <div className="relative">
                        <Link2 size={15} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="yourcompany.com"
                          value={answers.companyLink ?? ''}
                          onChange={e => set({ companyLink: e.target.value })}
                          className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-4
                                     text-[14px] text-slate-800 placeholder:text-slate-400
                                     focus:outline-none focus:border-ember-400 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Persona selection — shown for all users */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-3">
                  What Describes You Best <span className="text-ember-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PERSONAS.map(p => (
                    <PersonaCard
                      key={p.id}
                      selected={answers.persona === p.id}
                      onClick={() => {
                        set({
                          persona: p.id,
                          jobRole: p.id === 'freelancer' ? 'Freelancer/Independent' : answers.jobRole,
                        });
                      }}
                      icon={p.icon}
                      label={p.label}
                      desc={p.desc}
                    />
                  ))}
                </div>
              </div>

              {/* Job Role & How Did You Hear — only for Google users */}
              {isGoogleUser && (
                <>
                  {answers.persona && answers.persona !== 'freelancer' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[13px] font-semibold text-slate-700 mb-2">
                          Job Function
                        </label>
                        <SelectDropdown
                          value={answers.jobRole ?? ''}
                          onChange={v => set({ jobRole: v })}
                          options={JOB_ROLES}
                          placeholder="Select your role..."
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-2">
                      How Did You Hear About Us? <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {HEARD_FROM.map(s => (
                        <Chip
                          key={s}
                          label={s}
                          selected={(answers.heardFrom ?? []).includes(s)}
                          onClick={() => toggleInArray('heardFrom', s)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Target Companies ─────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-8">

              {/* ─── Which categories? ─── */}
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Package size={15} strokeWidth={2} className="text-amber-600" />
                  </div>
                  <h3 className="text-[16px] font-bold text-slate-900 tracking-[-0.01em]">
                    Which categories? <span className="text-ember-500 text-[13px]">*</span>
                  </h3>
                </div>
                <p className="text-[13px] text-slate-500 mb-3.5 ml-[38px]">
                  Pick the D2C categories you care about. Select as many as you want.
                </p>
                <div className="flex flex-wrap gap-2">
                  {D2C_CATEGORIES.map(cat => {
                    const sel = (answers.categories ?? []).includes(cat.label);
                    const isAll = cat.label === 'All Categories';
                    return (
                      <button
                        key={cat.label}
                        type="button"
                        onClick={() => {
                          if (isAll) {
                            const cur = answers.categories ?? [];
                            set({ categories: cur.includes('All Categories') ? [] : ['All Categories'] });
                          } else {
                            const cur = (answers.categories ?? []).filter(x => x !== 'All Categories');
                            set({ categories: cur.includes(cat.label) ? cur.filter(x => x !== cat.label) : [...cur, cat.label] });
                          }
                        }}
                        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all duration-150 ${
                          sel
                            ? 'border-ember-500 bg-ember-50 text-ember-700 shadow-[0_0_0_2px_rgba(201,76,30,0.08)]'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={sel ? 'text-ember-500' : cat.color}>{cat.icon}</span>
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── Which markets? ─── */}
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Globe size={15} strokeWidth={2} className="text-blue-600" />
                  </div>
                  <h3 className="text-[16px] font-bold text-slate-900 tracking-[-0.01em]">
                    Which markets? <span className="text-ember-500 text-[13px]">*</span>
                  </h3>
                </div>
                <p className="text-[13px] text-slate-500 mb-3.5 ml-[38px]">
                  Where are the brands you want to track? We&apos;ll prioritize data from these regions.
                </p>
                <div className="flex flex-wrap gap-2">
                  {GEO_REGIONS.map(g => {
                    const sel = (answers.geoFocus ?? []).includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          const cur = answers.geoFocus ?? [];
                          if (g === 'Global') {
                            set({ geoFocus: cur.includes('Global') ? [] : ['Global'] });
                          } else {
                            const without = cur.filter(x => x !== 'Global');
                            set({ geoFocus: without.includes(g) ? without.filter(x => x !== g) : [...without, g] });
                          }
                        }}
                        className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all duration-150 ${
                          sel
                            ? 'border-ember-500 bg-ember-50 text-ember-700 shadow-[0_0_0_2px_rgba(201,76,30,0.08)]'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── What size of brands? ─── */}
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Tag size={15} strokeWidth={2} className="text-emerald-600" />
                  </div>
                  <h3 className="text-[16px] font-bold text-slate-900 tracking-[-0.01em]">
                    What size of brands?
                  </h3>
                </div>
                <p className="text-[13px] text-slate-500 mb-3.5 ml-[38px]">
                  This helps us rank brands in your feed. You&apos;ll still see all sizes — this just puts your preferred size on top.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {BRAND_SIZES.map(bs => {
                    const sel = (answers.brandSize ?? []).includes(bs.id);
                    return (
                      <button
                        key={bs.id}
                        type="button"
                        onClick={() => toggleInArray('brandSize', bs.id)}
                        className={`flex flex-col items-center text-center rounded-xl border px-3 py-5 transition-all duration-150 ${
                          sel
                            ? 'border-ember-500 bg-ember-50 shadow-[0_0_0_2px_rgba(201,76,30,0.08)]'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${
                          sel ? 'bg-ember-100 text-ember-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {bs.icon}
                        </div>
                        <p className={`text-[13px] font-semibold leading-snug ${sel ? 'text-ember-700' : 'text-slate-900'}`}>
                          {bs.label}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                          {bs.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── Which sales channels matter? ─── */}
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                    <ShoppingBag size={15} strokeWidth={2} className="text-violet-600" />
                  </div>
                  <h3 className="text-[16px] font-bold text-slate-900 tracking-[-0.01em]">
                    Which sales channels matter?
                  </h3>
                </div>
                <p className="text-[13px] text-slate-500 mb-3.5 ml-[38px]">
                  What kind of D2C brands are most useful to you? Pick all that apply.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CHANNEL_MIX_OPTIONS.map(ch => {
                    const sel = (answers.channelMix ?? []).includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => toggleChannelMix(ch.id)}
                        className={`flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all duration-150 ${
                          sel
                            ? 'border-ember-500 bg-ember-50 shadow-[0_0_0_2px_rgba(201,76,30,0.08)]'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          sel ? 'bg-ember-100 text-ember-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {ch.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[13px] font-semibold leading-snug ${sel ? 'text-ember-700' : 'text-slate-900'}`}>
                            {ch.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">{ch.desc}</p>
                        </div>
                        <div className={`w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
                          sel ? 'border-ember-500 bg-ember-500' : 'border-slate-300'
                        }`}>
                          {sel && <Check size={10} strokeWidth={3} className="text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium
                         text-slate-500 hover:text-slate-800 hover:bg-slate-100
                         transition-all duration-150 disabled:opacity-0 disabled:pointer-events-none"
            >
              <ArrowLeft size={15} strokeWidth={2} />
              Back
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl
                           text-[14px] font-semibold text-white bg-ember-500
                           hover:bg-ember-400
                           shadow-[0_2px_8px_rgba(201,76,30,0.3)]
                           hover:shadow-[0_4px_16px_rgba(201,76,30,0.4)]
                           transition-all duration-200
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {step === STEPS.length - 1 ? 'Get started' : 'Continue'}
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
