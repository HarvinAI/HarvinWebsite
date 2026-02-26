'use client';

import { useState } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import { useModal } from '@/components/ModalContext';

const SIGNALS = [
  {
    initial: 'P', bg: '#C94C1E',
    name: 'Plum Goodness', sub: 'Beauty · Mumbai',
    signal: 'Got funded for $8.2M in Series B from Faering Capital',
    score: 94, tag: 'Funding',
    tagColor: 'bg-amber-50 text-amber-700',
    ago: '2d ago',
  },
  {
    initial: 'M', bg: '#343330',
    name: 'Mokobara', sub: 'Luggage · Bangalore',
    signal: 'Hired a VP of Growth — tool purchases expected in 90d',
    score: 82, tag: 'Hiring',
    tagColor: 'bg-blue-50 text-blue-700',
    ago: '5d ago',
  },
  {
    initial: 'S', bg: '#A93D18',
    name: 'Sugar Cosmetics', sub: 'Beauty · Mumbai',
    signal: 'Launched Android app — now live on iOS + Android',
    score: 91, tag: 'Digital',
    tagColor: 'bg-violet-50 text-violet-700',
    ago: '1d ago',
  },
];

export default function CTA() {
  const { openModal } = useModal();
  const [email, setEmail] = useState('');

  return (
    <section className="bg-slate-50 dark:bg-slate-950 py-20 px-4 sm:px-6 lg:px-8
                         border-t border-slate-200 dark:border-white/[0.06]">

      {/* ── Outer box ─────────────────────────────────────────────────────── */}
      <div className="max-w-[1300px] mx-auto rounded-2xl overflow-hidden
                       border border-slate-200 dark:border-white/[0.08]
                       shadow-[0_4px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_40px_rgba(0,0,0,0.35)]
                       bg-white dark:bg-[#0F0E0C]">

        <div className="grid grid-cols-1 lg:grid-cols-2">

          {/* ── Left: headline + form ──────────────────────────────────────── */}
          <div className="flex flex-col justify-center gap-7 px-10 py-14 lg:px-14">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full w-fit
                             bg-ember-50 dark:bg-ember-500/10
                             border border-ember-200 dark:border-ember-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-ember-500 animate-pulse" />
              <span className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase
                               text-ember-600 dark:text-ember-400">
                Book a demo
              </span>
            </div>

            {/* Headline */}
            <h2 className="font-display font-semibold leading-[1.08] tracking-[-0.025em]
                            text-[clamp(30px,3.5vw,48px)]
                            text-slate-900 dark:text-white">
              Ready to identify<br />
              <span className="text-ember-500">10–15 qualified</span><br />
              D2C brands per month?
            </h2>

            {/* Sub */}
            <p className="text-[16px] font-sans text-slate-500 dark:text-slate-400 leading-relaxed -mt-2">
              Get started with a 30-minute demo and see live D2C signals for your target market.
            </p>

            {/* Email + CTA */}
            <form
              onSubmit={(e) => { e.preventDefault(); openModal('early-access'); }}
              className="flex w-full max-w-[460px] rounded-xl overflow-hidden
                         border border-slate-200 dark:border-white/[0.12]
                         bg-slate-50 dark:bg-white/[0.04]
                         focus-within:border-ember-400 dark:focus-within:border-ember-500/60
                         transition-colors shadow-sm"
            >
              <input
                type="email"
                placeholder="What's your work email?"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="flex-1 min-w-0 px-4 py-3.5 text-[14px] font-sans
                           text-slate-800 dark:text-white placeholder:text-slate-400
                           bg-transparent outline-none border-none"
              />
              <button
                type="submit"
                className="flex-shrink-0 px-5 py-3.5 m-1 rounded-lg
                           bg-ember-500 hover:bg-ember-400
                           text-white text-[14px] font-semibold font-sans
                           shadow-[0_2px_8px_rgba(201,76,30,0.3)]
                           hover:shadow-[0_4px_16px_rgba(201,76,30,0.45)]
                           transition-all duration-200 whitespace-nowrap"
              >
                Book a Demo
              </button>
            </form>

            {/* Social proof */}
            <div className="flex items-center gap-2 -mt-2">
              <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" strokeWidth={2} />
              <span className="text-[13px] font-sans text-slate-400 dark:text-slate-500">
                Join{' '}
                <span className="text-slate-600 dark:text-slate-300 font-medium">200+ sales teams</span>
                {' '}finding D2C opportunities
              </span>
            </div>
          </div>

          {/* ── Right: live signals preview ────────────────────────────────── */}
          <div className="flex items-center justify-center
                           bg-slate-50 dark:bg-white/[0.02]
                           border-t lg:border-t-0 lg:border-l
                           border-slate-200 dark:border-white/[0.08]
                           px-8 py-12">

            <div className="w-full max-w-[380px] flex flex-col gap-3">

              {/* Card header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Zap size={13} className="text-ember-500" strokeWidth={2.5} />
                  <span className="text-[12px] font-semibold font-sans tracking-[0.06em] uppercase
                                   text-slate-500 dark:text-slate-400">
                    Live D2C Signals
                  </span>
                </div>
                <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Updated just now
                </span>
              </div>

              {/* Signal rows */}
              {SIGNALS.map((b) => (
                <div
                  key={b.name}
                  className="rounded-xl p-4 bg-white dark:bg-white/[0.04]
                             border border-slate-200 dark:border-white/[0.08]
                             shadow-[0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-none"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-[7px] flex items-center justify-center
                                   flex-shrink-0 text-white font-bold text-[13px]"
                        style={{ backgroundColor: b.bg }}
                      >
                        {b.initial}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-slate-900 dark:text-white leading-tight">
                          {b.name}
                        </p>
                        <p className="text-[11px] font-sans text-slate-400 dark:text-slate-500">
                          {b.sub}
                        </p>
                      </div>
                    </div>
                    <span className="text-[12px] font-bold font-mono text-ember-500
                                     bg-ember-50 dark:bg-ember-900/20 px-1.5 py-0.5 rounded-md flex-shrink-0">
                      {b.score}
                    </span>
                  </div>
                  <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 leading-relaxed mb-2.5">
                    {b.signal}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${b.tagColor} dark:bg-white/[0.07] dark:text-white/60`}>
                      {b.tag}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-600">
                      {b.ago}
                    </span>
                  </div>
                </div>
              ))}

              {/* Footer */}
              <p className="text-center text-[11.5px] font-sans text-slate-400 dark:text-slate-600 mt-1">
                500,000+ D2C brands monitored in real time
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
