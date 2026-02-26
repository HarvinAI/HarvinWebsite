'use client';

import { useState } from 'react';
import { X, ArrowRight, CheckCircle } from 'lucide-react';

export type ModalType = 'early-access' | 'talk-to-sales';

interface Props {
  open: boolean;
  type: ModalType;
  onClose: () => void;
}

type FormState = { name: string; email: string; company: string; role: string; message: string };
const INITIAL: FormState = { name: '', email: '', company: '', role: '', message: '' };

export default function EarlyAccessModal({ open, type, onClose }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSales = type === 'talk-to-sales';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 1000);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => { setForm(INITIAL); setSubmitted(false); }, 300);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={handleClose} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[480px] rounded-2xl bg-white dark:bg-[#141311] shadow-2xl border border-slate-200 dark:border-white/[0.08]">

        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg
                     text-slate-400 hover:text-slate-700 dark:hover:text-white
                     hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
        >
          <X size={16} />
        </button>

        <div className="px-8 py-8">
          {!submitted ? (
            <>
              <div className="mb-6">
                <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">
                  {isSales ? 'Talk to our sales team' : 'Get early access'}
                </h2>
                <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">
                  {isSales
                    ? "Tell us about your team and we'll get back within 24 hours."
                    : 'Be among the first to find D2C opportunities with HarvinAI.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Full name *</span>
                    <input
                      required
                      type="text"
                      placeholder="Rahul Sharma"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="h-10 px-3 rounded-lg border border-slate-200 dark:border-white/[0.12]
                                 bg-slate-50 dark:bg-white/[0.05] text-[14px] text-slate-900 dark:text-white
                                 placeholder:text-slate-400 focus:outline-none focus:border-ember-500
                                 dark:focus:border-ember-500 transition-colors"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Work email *</span>
                    <input
                      required
                      type="email"
                      placeholder="you@company.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="h-10 px-3 rounded-lg border border-slate-200 dark:border-white/[0.12]
                                 bg-slate-50 dark:bg-white/[0.05] text-[14px] text-slate-900 dark:text-white
                                 placeholder:text-slate-400 focus:outline-none focus:border-ember-500
                                 dark:focus:border-ember-500 transition-colors"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Company *</span>
                  <input
                    required
                    type="text"
                    placeholder="Acme Corp"
                    value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    className="h-10 px-3 rounded-lg border border-slate-200 dark:border-white/[0.12]
                               bg-slate-50 dark:bg-white/[0.05] text-[14px] text-slate-900 dark:text-white
                               placeholder:text-slate-400 focus:outline-none focus:border-ember-500
                               dark:focus:border-ember-500 transition-colors"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Your role *</span>
                  <input
                    required
                    type="text"
                    placeholder="Head of Sales"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="h-10 px-3 rounded-lg border border-slate-200 dark:border-white/[0.12]
                               bg-slate-50 dark:bg-white/[0.05] text-[14px] text-slate-900 dark:text-white
                               placeholder:text-slate-400 focus:outline-none focus:border-ember-500
                               dark:focus:border-ember-500 transition-colors"
                  />
                </label>

                {isSales && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Message</span>
                    <textarea
                      rows={3}
                      placeholder="Tell us about your use case..."
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      className="px-3 py-2.5 rounded-lg border border-slate-200 dark:border-white/[0.12]
                                 bg-slate-50 dark:bg-white/[0.05] text-[14px] text-slate-900 dark:text-white
                                 placeholder:text-slate-400 focus:outline-none focus:border-ember-500
                                 dark:focus:border-ember-500 transition-colors resize-none"
                    />
                  </label>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 w-full h-11 rounded-[10px] bg-ember-500 hover:bg-ember-400 text-white
                             text-[14px] font-semibold flex items-center justify-center gap-2
                             shadow-[0_2px_10px_rgba(201,76,30,0.35)] hover:shadow-[0_6px_20px_rgba(201,76,30,0.5)]
                             transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <>
                      {isSales ? 'Send message' : 'Request early access'}
                      <ArrowRight size={15} strokeWidth={2.5} />
                    </>
                  )}
                </button>

                <p className="text-center text-[12px] text-slate-400 dark:text-slate-500">
                  No credit card required · We&apos;ll never spam you
                </p>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-14 h-14 rounded-full bg-ember-50 dark:bg-ember-500/15 flex items-center justify-center mb-4">
                <CheckCircle size={28} className="text-ember-500" strokeWidth={1.8} />
              </div>
              <h2 className="text-[20px] font-semibold text-slate-900 dark:text-white mb-2">
                {isSales ? 'Message received!' : "You're on the list!"}
              </h2>
              <p className="text-[14px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-[320px]">
                {isSales
                  ? 'Our sales team will reach out within 24 hours.'
                  : "We'll send early access details to your email. Thanks for your interest in HarvinAI!"}
              </p>
              <button
                onClick={handleClose}
                className="mt-6 px-6 py-2.5 rounded-[10px] border border-slate-200 dark:border-white/[0.15]
                           text-[14px] font-semibold text-slate-700 dark:text-slate-300
                           hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
