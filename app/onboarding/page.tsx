'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowRight, ArrowLeft, Check, ChevronDown, Building2, User, Mail, Link2, Monitor, Megaphone, LineChart, PenTool, Layers, Package, Wifi, Store, Users } from 'lucide-react';

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
  brandTypes?: BrandType[];
  channelMix?: string[];
  offlineStores?: string;
  revenueModel?: string;
  mau?: string;
  companySize?: string;
  revenueRange?: string;
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

const BRAND_TYPE_OPTIONS: { id: BrandType; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: 'physical', icon: <Package size={20} strokeWidth={1.8} />, label: 'Physical Product Brand (D2C)', desc: 'Brands selling physical goods directly to consumers' },
  { id: 'digital',  icon: <Wifi size={20} strokeWidth={1.8} />,    label: 'Digital Product / Service',     desc: 'SaaS, apps, digital subscriptions & online services' },
];

const CHANNEL_MIX_OPTIONS = [
  { id: 'website_only',      label: 'Website Only',                        desc: 'Brands with their own e-commerce website' },
  { id: 'marketplace_only',  label: 'Marketplace Only',                    desc: 'Brands selling exclusively on marketplaces' },
  { id: 'omnichannel',       label: 'Website + Marketplace (Omnichannel)', desc: 'Brands present on both channels' },
  { id: 'offline_retail',    label: 'Offline Retail Presence',              desc: 'Brands with physical store locations' },
];

const REVENUE_MODELS = ['Subscription', 'Transactional', 'Hybrid', 'Any'];

const COMPANY_SIZES = ['Micro (0\u201310)', 'SMB (11\u201350)', 'Mid-Market (51\u2013500)', 'Enterprise (500+)'];
const REVENUE_RANGES = ['<$10M', '$10M\u2013$100M', '$100M+', 'All'];
const TECH_CATEGORIES = [
  'Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Custom Stack',
  'React / Next.js', 'Node.js', 'Python / Django', 'AWS', 'GCP',
  'Stripe', 'Razorpay', 'Segment', 'Mixpanel', 'HubSpot',
];

const STEPS = [
  { number: '01', title: 'Basic Information',  subtitle: 'Tell us a bit about yourself',                optional: false },
  { number: '02', title: 'Target Companies',   subtitle: 'Define the D2C brands you want to discover',  optional: false },
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
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [animating, setAnimating] = useState(false);

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
        if (parsed.step !== undefined) setStep(parsed.step);
        if (parsed.answers) setAnswers(parsed.answers);
      } catch { /* ignore corrupt data */ }
    }

    // Pre-fill from localStorage user data or session
    const user = localStorage.getItem('harvin_user');
    if (user) {
      try {
        const u = JSON.parse(user);
        setAnswers(prev => ({
          ...prev,
          fullName: prev.fullName || u.name || '',
          email: prev.email || u.email || '',
        }));
      } catch { /* ignore */ }
    } else if (session?.user) {
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
      router.push('/dashboard');
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
      // Clear sub-options when deselecting
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
    if (step === 0) return !!(answers.fullName?.trim() && answers.email?.trim() && answers.persona);
    if (step === 1) return (answers.brandTypes ?? []).length > 0;
    return false;
  };

  const progress = ((step) / STEPS.length) * 100;
  const current = STEPS[step];

  return (
    <div className="min-h-screen bg-[#f7f7f8] flex flex-col">

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
          <span className="font-jakarta font-bold text-[18px] tracking-[-0.02em] text-slate-900 leading-none">
            Harvin<span className="font-normal opacity-35">AI</span>
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
              {/* Name & Email */}
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

              {/* Persona selection */}
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

              {/* Company Name & Link */}
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
                      type="url"
                      placeholder="https://yourcompany.com"
                      value={answers.companyLink ?? ''}
                      onChange={e => set({ companyLink: e.target.value })}
                      className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-4
                                 text-[14px] text-slate-800 placeholder:text-slate-400
                                 focus:outline-none focus:border-ember-400 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Job Role — hidden when freelancer */}
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

              {/* How Did You Hear */}
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
            </div>
          )}

          {/* ── Step 2: Target Companies ─────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              {/* Company Size & Revenue Range — top row */}
              <div className="grid grid-cols-2 gap-0 rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="p-4 border-r border-slate-200">
                  <p className="text-[13px] font-semibold text-slate-700 mb-2">Target Company Size</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {COMPANY_SIZES.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set({ companySize: s })}
                        className={`rounded-lg border px-3 py-2 text-[12px] font-medium text-center transition-all duration-150 ${
                          answers.companySize === s
                            ? 'border-ember-500 bg-ember-500 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-[13px] font-semibold text-slate-700 mb-2">Target Revenue</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {REVENUE_RANGES.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => set({ revenueRange: r })}
                        className={`rounded-lg border px-3 py-2 text-[12px] font-medium text-center transition-all duration-150 ${
                          answers.revenueRange === r
                            ? 'border-ember-500 bg-ember-500 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Brand type selection — can pick both */}
              <div>
                <p className="text-[13px] text-slate-500 mb-3">
                  Select one or both — you can target physical and digital brands at the same time.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BRAND_TYPE_OPTIONS.map(bt => (
                    <button
                      key={bt.id}
                      type="button"
                      onClick={() => toggleBrandType(bt.id)}
                      className={`flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all duration-150 ${
                        (answers.brandTypes ?? []).includes(bt.id)
                          ? 'border-ember-500 bg-ember-50 shadow-[0_0_0_3px_rgba(201,76,30,0.1)]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        (answers.brandTypes ?? []).includes(bt.id) ? 'bg-ember-100 text-ember-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {bt.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-semibold leading-snug ${
                          (answers.brandTypes ?? []).includes(bt.id) ? 'text-ember-700' : 'text-slate-900'
                        }`}>
                          {bt.label}
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-500 leading-snug">{bt.desc}</p>
                      </div>
                      <div className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                        (answers.brandTypes ?? []).includes(bt.id) ? 'border-ember-500 bg-ember-500' : 'border-slate-300'
                      }`}>
                        {(answers.brandTypes ?? []).includes(bt.id) && <Check size={11} strokeWidth={3} className="text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Physical: Channel Mix */}
              {hasPhysical && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={15} strokeWidth={2} className="text-ember-500" />
                    <p className="text-[13px] font-semibold text-slate-800">Which channel mix should the brand have?</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CHANNEL_MIX_OPTIONS.map(ch => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => toggleChannelMix(ch.id)}
                        className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left transition-all duration-150 ${
                          (answers.channelMix ?? []).includes(ch.id)
                            ? 'border-ember-500 bg-ember-50 text-ember-700 shadow-[0_0_0_3px_rgba(201,76,30,0.1)]'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                          (answers.channelMix ?? []).includes(ch.id) ? 'border-ember-500 bg-ember-500' : 'border-slate-300'
                        }`}>
                          {(answers.channelMix ?? []).includes(ch.id) && <Check size={9} strokeWidth={3} className="text-white" />}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium leading-snug">{ch.label}</p>
                          <p className="text-[11px] text-slate-400 leading-snug">{ch.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Offline stores count */}
                  {(answers.channelMix ?? []).includes('offline_retail') && (
                    <div className="mt-3">
                      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                        <Store size={13} strokeWidth={2} className="inline mr-1 text-slate-400" />
                        Minimum number of stores
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 10"
                        value={answers.offlineStores ?? ''}
                        onChange={e => set({ offlineStores: e.target.value })}
                        className="w-40 h-10 rounded-xl border border-slate-200 bg-slate-50 px-3
                                   text-[14px] text-slate-800 placeholder:text-slate-400
                                   focus:outline-none focus:border-ember-400 transition-colors"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Digital: Revenue Model */}
              {hasDigital && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wifi size={15} strokeWidth={2} className="text-blue-500" />
                    <p className="text-[13px] font-semibold text-slate-800">Target revenue model</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REVENUE_MODELS.map(rm => (
                      <Chip
                        key={rm}
                        label={rm}
                        selected={answers.revenueModel === rm}
                        onClick={() => set({ revenueModel: answers.revenueModel === rm ? undefined : rm })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* MAU — shown for all except marketplace only */}
              {showMau && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={15} strokeWidth={2} className="text-slate-500" />
                    <p className="text-[13px] font-semibold text-slate-800">
                      Minimum Monthly Active Users (MAU)
                    </p>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 50,000"
                    value={answers.mau ?? ''}
                    onChange={e => set({ mau: e.target.value })}
                    className="w-48 h-10 rounded-xl border border-slate-200 bg-slate-50 px-3
                               text-[14px] text-slate-800 placeholder:text-slate-400
                               focus:outline-none focus:border-ember-400 transition-colors"
                  />
                </div>
              )}

              {/* Tech Stack Interest */}
              <div>
                <p className="text-[13px] font-semibold text-slate-700 mb-2">Interested in tech stack data?</p>
                <div className="flex items-center gap-3">
                  <Chip label="Yes" selected={answers.techStackInterest === true} onClick={() => set({ techStackInterest: true })} />
                  <Chip label="No" selected={answers.techStackInterest === false} onClick={() => set({ techStackInterest: false, techCategories: [] })} />
                </div>

                {answers.techStackInterest && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {TECH_CATEGORIES.map(t => (
                      <Chip
                        key={t}
                        label={t}
                        selected={(answers.techCategories ?? []).includes(t)}
                        onClick={() => toggleInArray('techCategories', t)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Companies to Track */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-2">
                  Companies to Track <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mamaearth, boAt, Sugar Cosmetics..."
                  value={answers.companiesToTrack ?? ''}
                  onChange={e => set({ companiesToTrack: e.target.value })}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4
                             text-[14px] text-slate-800 placeholder:text-slate-400
                             focus:outline-none focus:border-ember-400 transition-colors"
                />
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
