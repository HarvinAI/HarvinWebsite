'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useModal } from '@/components/ModalContext';

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
          <div className="flex flex-col justify-center gap-5 sm:gap-7 px-6 py-10 sm:px-10 sm:py-14 lg:px-14">

            {/* Badge */}
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
              Get started
            </p>

            {/* Headline */}
            <h2 className="font-sans font-semibold leading-[1.08] tracking-[-0.025em]
                            text-[clamp(30px,3.5vw,48px)]
                            text-slate-900 dark:text-white">
              See it working<br />
              <span className="text-ember-500">on your target market</span>
            </h2>

            {/* Sub */}
            <p className="text-[16px] font-sans text-slate-500 dark:text-slate-400 leading-relaxed -mt-2">
              30-minute call. We&rsquo;ll pull live signals for brands you actually sell to and show you accounts you haven&rsquo;t found yet.
            </p>

            {/* Email + CTA */}
            <form
              onSubmit={(e) => { e.preventDefault(); openModal('early-access'); }}
              className="flex flex-col sm:flex-row w-full max-w-[460px] rounded-xl overflow-hidden
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
                No credit card required. Free for the first 14 days.
              </span>
            </div>
          </div>

          {/* ── Right: product screenshot ────────────────────────────────── */}
          <div className="relative flex items-center
                           bg-slate-100/50 dark:bg-white/[0.02]
                           border-t lg:border-t-0 lg:border-l
                           border-slate-200 dark:border-white/[0.08]
                           p-4 sm:p-6 lg:p-8 overflow-hidden min-h-[200px] sm:min-h-[320px]">
            {/*
              Replace with a screenshot of your signals/watchlist view.
              Save as /public/signals-preview.png
            */}
            <div className="w-full rounded-xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-slate-200/60 dark:border-white/[0.08] md:translate-x-4 lg:translate-x-6 md:scale-105 lg:scale-110 origin-left">
              <img
                src="/signals-preview.png"
                alt="Live D2C buying signals — funding, expansion, hiring"
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
