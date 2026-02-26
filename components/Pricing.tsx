'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useModal } from '@/components/ModalContext';

/* ── Plan data ────────────────────────────────────────────────────────────── */
interface Plan {
  name:     string;
  price:    string;
  billing:  string;
  desc:     string;
  features: string[];
  cta:      string;
  ctaHref:  string;
  popular:  boolean;
}

const PLANS: Plan[] = [
  {
    name:    'Starter',
    price:   '250',
    billing: '/seat/month',
    desc:    'For individual contributors exploring D2C opportunities.',
    features: [
      'Full database access (500K+ accounts)',
      'Market Intelligence feed',
      'All 13 filters',
      'Up to 5 watchlists',
      'Daily/weekly email digest',
      '1 CRM integration',
      'CSV export',
    ],
    cta:     'Start free trial',
    ctaHref: '/early-access',
    popular: false,
  },
  {
    name:    'Business',
    price:   '400',
    billing: '/seat/month',
    desc:    'For teams that need real-time alerts and deeper integrations.',
    features: [
      'Everything in Starter',
      'Unlimited watchlists',
      'Real-time Slack alerts',
      'Both CRM integrations',
      'Chrome extension',
      'API access',
      'Priority support (24h)',
    ],
    cta:     'Start free trial',
    ctaHref: '/early-access',
    popular: true,
  },
  {
    name:    'Enterprise',
    price:   'Custom',
    billing: '',
    desc:    'For organizations needing custom data and dedicated support.',
    features: [
      'Everything in Business',
      '10+ seats',
      'Custom data requests',
      'White-label exports',
      'Dedicated CSM',
      'SLA commitments',
      'Quarterly business reviews',
    ],
    cta:     'Talk to sales',
    ctaHref: '/contact',
    popular: false,
  },
];

/* ── Feature row ──────────────────────────────────────────────────────────── */
function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <ArrowRight
        size={14}
        className="mt-[3px] flex-shrink-0 text-ember-500"
        strokeWidth={2}
      />
      <span className="text-[14px] font-sans leading-snug text-slate-600 dark:text-slate-400">
        {text}
      </span>
    </li>
  );
}

/* ── Animated glowing border (Business card only) ─────────────────────────── */
function GlowBorder({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative p-[2px] overflow-hidden" style={{ borderRadius: 16 }}>

      {/* Spinning sharp ring */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: '160%', height: '160%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
        }}
      >
        <div
          className="w-full h-full animate-spin"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0%, transparent 30%, #C94C1E 45%, #E56B2C 52%, #F48E56 55%, transparent 65%, transparent 100%)',
            animationDuration: '3s',
            animationTimingFunction: 'linear',
          }}
        />
      </div>

      {/* Spinning glow layer (blurred) */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: '160%', height: '160%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
        }}
      >
        <div
          className="w-full h-full animate-spin"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0%, transparent 25%, rgba(201,76,30,0.8) 45%, rgba(229,107,44,0.8) 55%, transparent 70%, transparent 100%)',
            filter: 'blur(14px)',
            animationDuration: '3s',
            animationTimingFunction: 'linear',
          }}
        />
      </div>

      {/* Foreground card */}
      <div
        className="relative bg-white dark:bg-[#141311]"
        style={{ borderRadius: 14, zIndex: 1 }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
interface CardProps {
  plan:      Plan;
  index:     number;
  active:    boolean;
  onCtaClick: () => void;
}

function PlanCard({ plan, index, active, onCtaClick }: CardProps) {
  const card = (
    <div
      className={`flex flex-col h-full px-7 py-8 ${plan.popular ? '' :
        `rounded-card border transition-all duration-300 group
         bg-white dark:bg-slate-900/50
         border-slate-200 dark:border-white/[0.08]
         shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none
         hover:border-slate-300 dark:hover:border-white/[0.15]
         hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]`
      }`}
    >

      {/* Plan name */}
      <p className={`text-[16px] font-semibold font-sans mb-4
                      ${plan.popular ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>
        {plan.name}
      </p>

      {/* Price */}
      <div className="flex items-end gap-1 mb-3">
        {plan.billing ? (
          <>
            <span className="font-display font-normal leading-none tracking-[-0.03em]
                              text-[clamp(40px,4vw,52px)] text-slate-900 dark:text-white">
              ${plan.price}
            </span>
            <span className="text-[14px] font-sans text-slate-400 dark:text-slate-500 mb-1.5">
              {plan.billing}
            </span>
          </>
        ) : (
          <span className="font-display font-normal leading-none tracking-[-0.03em]
                            text-[clamp(40px,4vw,52px)] text-slate-900 dark:text-white">
            {plan.price}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-[13px] font-sans leading-relaxed text-slate-500 dark:text-slate-400 mb-7">
        {plan.desc}
      </p>

      {/* Features */}
      <ul className="flex flex-col gap-3 flex-1 mb-8">
        {plan.features.map((f) => (
          <Feature key={f} text={f} />
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={onCtaClick}
        className={`w-full text-center py-3 rounded-btn text-[14px] font-semibold
                     font-sans transition-all duration-200
                     ${plan.popular
                       ? 'bg-ember-500 text-white shadow-[0_2px_10px_rgba(201,76,30,0.35)] hover:bg-ember-400 hover:shadow-[0_6px_20px_rgba(201,76,30,0.5)]'
                       : 'border border-slate-300 dark:border-white/[0.15] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:border-slate-400 dark:hover:border-white/30'
                     }`}
      >
        {plan.cta}
      </button>
    </div>
  );

  return (
    <div
      className="relative"
      style={{
        opacity:         active ? 1 : 0,
        transform:       active ? 'translateY(0)' : 'translateY(28px)',
        transition:      `opacity 0.55s ease ${index * 100}ms, transform 0.55s ease ${index * 100}ms`,
        paddingTop:      18,
      }}
    >
      {/* Badge sits outside GlowBorder so overflow-hidden doesn't clip it */}
      {plan.popular && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                           text-[11px] font-semibold font-sans tracking-wide uppercase
                           bg-ember-500 text-white
                           shadow-[0_4px_14px_rgba(201,76,30,0.5)]">
            Most Popular
          </span>
        </div>
      )}
      {plan.popular ? (
        <GlowBorder>{card}</GlowBorder>
      ) : (
        card
      )}
    </div>
  );
}

/* ── Section ──────────────────────────────────────────────────────────────── */
export default function Pricing() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const { openModal } = useModal();

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); obs.disconnect(); } },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-28 px-6
                 bg-slate-50 dark:bg-slate-950
                 border-t border-slate-200 dark:border-white/[0.06]"
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.055) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none hidden dark:block"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />

      {/* Top ember glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[240px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,76,30,0.09) 0%, transparent 65%)' }}
      />

      <div className="relative z-10 max-w-[1100px] mx-auto">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          className="text-center mb-16"
          style={{
            opacity:    active ? 1 : 0,
            transform:  active ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5
                           bg-ember-50 dark:bg-ember-500/10
                           border border-ember-200 dark:border-ember-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-ember-500 animate-pulse" />
            <p className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase text-ember-600 dark:text-ember-400">
              Pricing
            </p>
          </div>

          <h2 className="font-display font-normal leading-[1.05] tracking-[-0.025em] mb-4
                          text-[clamp(30px,4vw,52px)]
                          text-slate-900 dark:text-white">
            Start with one seat.<br className="hidden sm:block" /> Scale when ready.
          </h2>

          <p className="text-[15px] font-sans text-slate-500 dark:text-slate-400 mb-2">
            No minimum seats. No annual lock-in. Cancel anytime.
          </p>
          <p className="text-[15px] font-sans text-slate-600 dark:text-slate-300">
            Most teams recover Harvin's cost with{' '}
            <strong className="font-semibold text-slate-900 dark:text-white">
              one qualified D2C deal.
            </strong>
          </p>
        </div>

        {/* ── Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {PLANS.map((plan, i) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              index={i}
              active={active}
              onCtaClick={() => openModal(plan.ctaHref === '/contact' ? 'talk-to-sales' : 'early-access')}
            />
          ))}
        </div>

        {/* ── Footer note ─────────────────────────────────────────────── */}
        <p
          className="mt-10 text-center text-[13px] font-sans text-slate-400 dark:text-slate-600"
          style={{ opacity: active ? 1 : 0, transition: 'opacity 0.6s ease 0.7s' }}
        >
          All plans include a 14-day free trial · No credit card required
        </p>

      </div>
    </section>
  );
}
