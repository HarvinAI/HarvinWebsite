'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, SkipForward, Check, ChevronDown, Zap, Search, TrendingUp, Building2, Globe, Briefcase, User, Mail } from 'lucide-react';

/* ── Types ───────────────────────────────────────────────────────────────── */
type Persona = 'saas' | 'agency' | 'investor' | 'freelancer' | 'other';
type Goal = 'outreach' | 'research' | 'trends';

type Answers = {
  fullName?: string;
  email?: string;
  persona?: Persona;
  companyName?: string;
  jobRole?: string;
  heardFrom?: string[];
  goal?: Goal;
  industries?: string[];
  geoFocus?: string[];
  companyStage?: string;
  revenueRange?: string;
  businessModel?: string;
  techStackInterest?: boolean;
  techCategories?: string[];
  companiesToTrack?: string;
};

/* ── Step config ─────────────────────────────────────────────────────────── */
const PERSONAS: { id: Persona; icon: string; label: string }[] = [
  { id: 'saas',       icon: '🏢', label: 'SaaS Company' },
  { id: 'agency',     icon: '📣', label: 'Marketing Agency' },
  { id: 'investor',   icon: '💰', label: 'Investor' },
  { id: 'freelancer', icon: '💻', label: 'Freelancer' },
  { id: 'other',      icon: '✨', label: 'Other' },
];

const JOB_ROLES = [
  'Founder / CEO', 'Co-Founder / CTO', 'Head of Sales', 'Sales Manager',
  'Account Executive', 'Business Development', 'Marketing Lead',
  'Growth Manager', 'Product Manager', 'Consultant', 'Other',
];

const HEARD_FROM = [
  'LinkedIn', 'Twitter / X', 'Google Search', 'Friend / Colleague',
  'Product Hunt', 'Newsletter', 'YouTube', 'Podcast', 'Other',
];

const GOALS: { id: Goal; icon: React.ReactNode; title: string; desc: string; bestFor: string; features: string[] }[] = [
  {
    id: 'outreach',
    icon: <Search size={20} strokeWidth={2} />,
    title: 'Find Companies to Outreach',
    desc: 'Build prospect lists, find leads, and discover potential customers or partners in the D2C ecosystem.',
    bestFor: 'SaaS Companies \u00b7 Marketing Agencies \u00b7 Sales Teams \u00b7 Tech Vendors',
    features: [
      'Contact information displayed prominently',
      'Company size, tech stack & funding details visible',
      '"Export to CSV" and "Add to List" features enabled',
      '"Similar Companies" widget on every company profile',
      'Decision-maker information highlighted',
    ],
  },
  {
    id: 'research',
    icon: <Briefcase size={20} strokeWidth={2} />,
    title: 'Competitive Research',
    desc: 'Analyze competitors, understand their strategies, and benchmark your performance against the market.',
    bestFor: 'Freelancers \u00b7 Founders \u00b7 Product Managers \u00b7 Marketing Teams',
    features: [
      '"Companies Similar to Yours" section featured',
      'Tech stack analysis and comparison tools',
      'Business model and strategy breakdowns',
      'Growth metrics and funding history tracked',
      'Side-by-side comparison views available',
    ],
  },
  {
    id: 'trends',
    icon: <TrendingUp size={20} strokeWidth={2} />,
    title: 'Market Trends',
    desc: 'Track industry trends, spot emerging patterns, and discover market opportunities before the competition.',
    bestFor: 'Investors \u00b7 Analysts \u00b7 Market Researchers',
    features: [
      'Trending categories and segments highlighted',
      'Growth charts and statistical dashboards',
      'Funding rounds and valuations tracked',
      '"Emerging Companies" discovery section',
      'Advanced data export and reporting tools',
    ],
  },
];

const ECOMMERCE_INDUSTRIES = [
  'Fashion & Apparel', 'Footwear', 'Fashion Accessories', 'Jewelry',
  'Beauty & Personal Care', 'Food & Beverage', 'Home & Living',
  'Health & Wellness', 'Baby & Kids', 'Pet Products',
  'Electronics & Tech', 'Outdoor & Recreation', 'Office & Stationery',
];

const DIGITAL_INDUSTRIES = [
  'EdTech', 'FinTech', 'Health & Wellness Services', 'Telecom',
  'Streaming / OTT', 'Music & Audio Streaming', 'Gaming',
  'News & Media', 'Insurance', 'Travel & Ticketing',
  'Food Delivery', 'Transportation Booking',
];

const GEO_REGIONS = [
  'United States & Canada', 'Europe', 'India', 'China',
  'Southeast Asia', 'Global / All Regions', 'Japan',
  'South Korea', 'Australia & New Zealand', 'Latin America',
  'Middle East & Africa',
];

const COMPANY_STAGES = ['Early Stage', 'Growth Stage', 'Late Stage', 'Public', 'All Stages'];
const REVENUE_RANGES = ['<$10M', '$10M\u2013$100M', '$100M+', 'All Sizes'];
const BUSINESS_MODELS = ['Subscription', 'Marketplace', 'One-time Purchase', 'All Models'];
const TECH_CATEGORIES = [
  'Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Custom Stack',
  'React / Next.js', 'Node.js', 'Python / Django', 'AWS', 'GCP',
  'Stripe', 'Razorpay', 'Segment', 'Mixpanel', 'HubSpot',
];

const STEPS = [
  { number: '01', title: 'Basic Information',          subtitle: 'Tell us a bit about yourself',                   optional: false },
  { number: '02', title: 'Primary Goal',               subtitle: 'What will you use HarvinAI for?',                optional: false },
  { number: '03', title: 'Industry & Geographic Focus', subtitle: 'What sectors and regions interest you?',          optional: false },
  { number: '04', title: 'Deep Dive & Refinement',     subtitle: 'Fine-tune your preferences (optional)',           optional: true  },
];

/* ── Persona → Goal mapping ──────────────────────────────────────────────── */
function defaultGoalForPersona(p?: Persona): Goal | undefined {
  if (p === 'saas' || p === 'agency') return 'outreach';
  if (p === 'investor') return 'trends';
  if (p === 'freelancer') return 'research';
  return undefined;
}

/* ── Sub-components ──────────────────────────────────────────────────────── */
function PersonaCard({ selected, onClick, icon, label }: {
  selected: boolean; onClick: () => void; icon: string; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-150 ${
        selected
          ? 'border-ember-500 bg-ember-50 shadow-[0_0_0_3px_rgba(201,76,30,0.1)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span className="text-[24px] leading-none">{icon}</span>
      <p className={`text-[13px] font-semibold leading-snug ${selected ? 'text-ember-700' : 'text-slate-700'}`}>{label}</p>
    </button>
  );
}

function GoalCard({ selected, onClick, goal }: {
  selected: boolean; onClick: () => void;
  goal: typeof GOALS[number];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border text-left transition-all duration-200 ${
        selected
          ? 'border-ember-500 bg-ember-50/50 shadow-[0_0_0_3px_rgba(201,76,30,0.1)]'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-3 mb-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            selected ? 'bg-ember-100 text-ember-600' : 'bg-slate-100 text-slate-500'
          }`}>
            {goal.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[15px] font-semibold leading-snug ${selected ? 'text-ember-700' : 'text-slate-900'}`}>
              {goal.title}
            </p>
            <p className="mt-1 text-[13px] text-slate-500 leading-snug">{goal.desc}</p>
          </div>
          <div className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
            selected ? 'border-ember-500 bg-ember-500' : 'border-slate-300'
          }`}>
            {selected && <Check size={10} strokeWidth={3} className="text-white" />}
          </div>
        </div>
        <div className={`mt-2 text-[11px] font-medium px-2 py-1 rounded-md inline-block ${
          selected ? 'bg-ember-100 text-ember-600' : 'bg-slate-100 text-slate-500'
        }`}>
          Best For: {goal.bestFor}
        </div>
      </div>

      {/* Expanded features */}
      {selected && (
        <div className="border-t border-ember-200 px-5 py-4">
          <ul className="flex flex-col gap-1.5">
            {goal.features.map(f => (
              <li key={f} className="flex items-start gap-2 text-[12px] text-ember-700 leading-snug">
                <Check size={12} strokeWidth={2.5} className="text-ember-500 flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('harvin_onboarding');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.completed) { router.replace('/dashboard'); return; }
      if (parsed.step !== undefined) setStep(parsed.step);
      if (parsed.answers) setAnswers(parsed.answers);
    }

    // Pre-fill from localStorage user data
    const user = localStorage.getItem('harvin_user');
    if (user) {
      const u = JSON.parse(user);
      setAnswers(prev => ({
        ...prev,
        fullName: prev.fullName || u.name || '',
        email: prev.email || u.email || '',
      }));
    }
  }, [router]);

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

  const skip = () => {
    // Apply defaults when skipping step 4
    const defaulted: Answers = {
      ...answers,
      companyStage: answers.companyStage || 'All Stages',
      revenueRange: answers.revenueRange || 'All Sizes',
      businessModel: answers.businessModel || 'All Models',
      techStackInterest: answers.techStackInterest ?? false,
      companiesToTrack: answers.companiesToTrack || '',
    };
    setAnswers(defaulted);
    localStorage.setItem('harvin_onboarding', JSON.stringify({ step: STEPS.length, answers: defaulted, completed: true }));
    router.push('/dashboard');
  };

  const skipToDashboard = () => {
    const defaulted: Answers = {
      ...answers,
      companyStage: 'All Stages',
      revenueRange: 'All Sizes',
      businessModel: 'All Models',
      techStackInterest: false,
      companiesToTrack: '',
    };
    setAnswers(defaulted);
    localStorage.setItem('harvin_onboarding', JSON.stringify({ step: STEPS.length, answers: defaulted, completed: true }));
    router.push('/dashboard');
  };

  const set = (patch: Partial<Answers>) => setAnswers(prev => ({ ...prev, ...patch }));

  const toggleInArray = (key: keyof Answers, value: string) => {
    const arr = (answers[key] as string[] | undefined) ?? [];
    set({ [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] } as Partial<Answers>);
  };

  const canProceed = () => {
    if (step === 0) return !!(answers.fullName?.trim() && answers.email?.trim() && answers.persona);
    if (step === 1) return !!answers.goal;
    if (step === 2) return true; // industries/geo are optional
    return true; // step 4 is optional
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
      <div className="flex-1 flex items-start justify-center px-4 py-10 sm:py-14">
        <div
          className={`w-full ${step === 2 ? 'max-w-[580px]' : 'max-w-[520px]'}`}
          style={{
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${direction === 'forward' ? '16px' : '-16px'})`
              : 'translateX(0)',
            transition: 'opacity 0.18s ease, transform 0.18s ease',
          }}
        >
          {/* Step header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
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
            <div className="flex flex-col gap-5">
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
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                  {PERSONAS.map(p => (
                    <PersonaCard
                      key={p.id}
                      selected={answers.persona === p.id}
                      onClick={() => {
                        const newGoal = defaultGoalForPersona(p.id);
                        set({
                          persona: p.id,
                          jobRole: p.id === 'freelancer' ? 'Freelancer/Independent' : answers.jobRole,
                          ...(newGoal && !answers.goal ? { goal: newGoal } : {}),
                        });
                      }}
                      icon={p.icon}
                      label={p.label}
                    />
                  ))}
                </div>
              </div>

              {/* Company Name */}
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

              {/* Job Role — hidden when freelancer */}
              {answers.persona && answers.persona !== 'freelancer' && (
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-2">
                    Job Role
                  </label>
                  <SelectDropdown
                    value={answers.jobRole ?? ''}
                    onChange={v => set({ jobRole: v })}
                    options={JOB_ROLES}
                    placeholder="Select your role..."
                  />
                </div>
              )}

              {/* How Did You Hear */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-3">
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

          {/* ── Step 2: Primary Goal Selection ───────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-slate-500 mb-1">
                This is the highest-impact decision. It shapes your dashboard layout, data prioritization, and available features.
              </p>
              {GOALS.map(g => (
                <GoalCard
                  key={g.id}
                  selected={answers.goal === g.id}
                  onClick={() => set({ goal: g.id })}
                  goal={g}
                />
              ))}
            </div>
          )}

          {/* ── Step 3: Industry & Geographic Focus ──────────────────── */}
          {step === 2 && (
            <div className="flex flex-col gap-6">
              {/* Industry Selection */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-[14px] font-semibold text-slate-800 mb-4">Industry Selection</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* E-Commerce column */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[13px] font-semibold text-slate-700">
                        <span className="text-ember-500 mr-1">&#9632;</span> E-Commerce Brands ({ECOMMERCE_INDUSTRIES.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = answers.industries ?? [];
                          const allSelected = ECOMMERCE_INDUSTRIES.every(i => cur.includes(i));
                          set({
                            industries: allSelected
                              ? cur.filter(i => !ECOMMERCE_INDUSTRIES.includes(i))
                              : [...new Set([...cur, ...ECOMMERCE_INDUSTRIES])],
                          });
                        }}
                        className="text-[11px] font-medium text-ember-500 hover:text-ember-600 transition-colors"
                      >
                        {ECOMMERCE_INDUSTRIES.every(i => (answers.industries ?? []).includes(i)) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {ECOMMERCE_INDUSTRIES.map(ind => (
                        <button
                          key={ind}
                          type="button"
                          onClick={() => toggleInArray('industries', ind)}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-left transition-all duration-150 ${
                            (answers.industries ?? []).includes(ind)
                              ? 'bg-ember-50 text-ember-700 font-medium'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            (answers.industries ?? []).includes(ind)
                              ? 'border-ember-500 bg-ember-500'
                              : 'border-slate-300'
                          }`}>
                            {(answers.industries ?? []).includes(ind) && (
                              <Check size={10} strokeWidth={3} className="text-white" />
                            )}
                          </div>
                          {ind}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Digital Services column */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[13px] font-semibold text-slate-700">
                        <span className="text-blue-500 mr-1">&#9632;</span> Digital Service Brands ({DIGITAL_INDUSTRIES.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = answers.industries ?? [];
                          const allSelected = DIGITAL_INDUSTRIES.every(i => cur.includes(i));
                          set({
                            industries: allSelected
                              ? cur.filter(i => !DIGITAL_INDUSTRIES.includes(i))
                              : [...new Set([...cur, ...DIGITAL_INDUSTRIES])],
                          });
                        }}
                        className="text-[11px] font-medium text-ember-500 hover:text-ember-600 transition-colors"
                      >
                        {DIGITAL_INDUSTRIES.every(i => (answers.industries ?? []).includes(i)) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {DIGITAL_INDUSTRIES.map(ind => (
                        <button
                          key={ind}
                          type="button"
                          onClick={() => toggleInArray('industries', ind)}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-left transition-all duration-150 ${
                            (answers.industries ?? []).includes(ind)
                              ? 'bg-ember-50 text-ember-700 font-medium'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            (answers.industries ?? []).includes(ind)
                              ? 'border-ember-500 bg-ember-500'
                              : 'border-slate-300'
                          }`}>
                            {(answers.industries ?? []).includes(ind) && (
                              <Check size={10} strokeWidth={3} className="text-white" />
                            )}
                          </div>
                          {ind}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Geographic Focus */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-[14px] font-semibold text-slate-800 mb-4">
                  <Globe size={15} strokeWidth={2} className="inline mr-1.5 text-slate-500" />
                  Geographic Focus
                </p>
                <div className="flex flex-wrap gap-2">
                  {GEO_REGIONS.map(r => (
                    <Chip
                      key={r}
                      label={r}
                      selected={(answers.geoFocus ?? []).includes(r)}
                      onClick={() => toggleInArray('geoFocus', r)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Deep Dive & Refinement ───────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              {/* Skip banner */}
              <button
                type="button"
                onClick={skipToDashboard}
                className="w-full flex items-center justify-between rounded-xl border border-ember-200 bg-ember-50 px-5 py-4 text-left hover:bg-ember-100 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Zap size={18} strokeWidth={2} className="text-ember-500" />
                  <div>
                    <p className="text-[14px] font-semibold text-ember-800">Skip to Dashboard</p>
                    <p className="text-[12px] text-ember-600/70">We&apos;ll apply sensible defaults. You can refine later in settings.</p>
                  </div>
                </div>
                <ArrowRight size={16} strokeWidth={2} className="text-ember-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Company Stage */}
              <div>
                <p className="text-[13px] font-semibold text-slate-700 mb-3">Company Stage</p>
                <div className="flex flex-wrap gap-2">
                  {COMPANY_STAGES.map(s => (
                    <Chip key={s} label={s} selected={answers.companyStage === s} onClick={() => set({ companyStage: s })} />
                  ))}
                </div>
              </div>

              {/* Revenue Range — shown for outreach & research */}
              {(answers.goal === 'outreach' || answers.goal === 'research') && (
                <div>
                  <p className="text-[13px] font-semibold text-slate-700 mb-3">Revenue Range</p>
                  <div className="flex flex-wrap gap-2">
                    {REVENUE_RANGES.map(r => (
                      <Chip key={r} label={r} selected={answers.revenueRange === r} onClick={() => set({ revenueRange: r })} />
                    ))}
                  </div>
                </div>
              )}

              {/* Business Model */}
              <div>
                <p className="text-[13px] font-semibold text-slate-700 mb-3">Business Model</p>
                <div className="flex flex-wrap gap-2">
                  {BUSINESS_MODELS.map(m => (
                    <Chip key={m} label={m} selected={answers.businessModel === m} onClick={() => set({ businessModel: m })} />
                  ))}
                </div>
              </div>

              {/* Tech Stack Interest — shown for outreach & research */}
              {(answers.goal === 'outreach' || answers.goal === 'research') && (
                <div>
                  <p className="text-[13px] font-semibold text-slate-700 mb-3">Interested in tech stack data?</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => set({ techStackInterest: true })}
                      className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                        answers.techStackInterest === true
                          ? 'border-ember-500 bg-ember-500 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => set({ techStackInterest: false, techCategories: [] })}
                      className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                        answers.techStackInterest === false
                          ? 'border-ember-500 bg-ember-500 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      No
                    </button>
                  </div>

                  {answers.techStackInterest && (
                    <div className="mt-3 flex flex-wrap gap-2">
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
              )}

              {/* Companies to Track — shown for research & trends */}
              {(answers.goal === 'research' || answers.goal === 'trends') && (
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
              )}

              {/* Bottom skip */}
              <button
                type="button"
                onClick={skipToDashboard}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-slate-200 bg-white
                           text-[13px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all"
              >
                <SkipForward size={14} strokeWidth={2} />
                Skip and go to Dashboard
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
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
              {current.optional && step === 3 && (
                <button
                  type="button"
                  onClick={skip}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium
                             text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150"
                >
                  Skip
                  <SkipForward size={14} strokeWidth={2} />
                </button>
              )}

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
