'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Check } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const STEPS = [
  { label: 'Syncing your preferences', duration: 1200 },
  { label: 'Building your dashboard', duration: 1400 },
  { label: 'Loading brand intelligence', duration: 1000 },
  { label: 'Almost ready...', duration: 800 },
];

export default function SyncingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Verify onboarding was completed
    const o = localStorage.getItem('harvin_onboarding');
    if (!o) { router.replace('/onboarding'); return; }
    try {
      const parsed = JSON.parse(o);
      if (!parsed.completed) { router.replace('/onboarding'); return; }
    } catch { router.replace('/onboarding'); return; }

    // Clear any old saved filters so dashboard starts fresh from onboarding
    localStorage.removeItem('harvin_dashboard_filters');

    let stepIdx = 0;
    let progressVal = 0;

    const progressInterval = setInterval(() => {
      progressVal += 1.2;
      if (progressVal > 100) progressVal = 100;
      setProgress(progressVal);
    }, 50);

    function advanceStep() {
      if (stepIdx < STEPS.length - 1) {
        stepIdx++;
        setCurrentStep(stepIdx);
        setTimeout(advanceStep, STEPS[stepIdx].duration);
      } else {
        setTimeout(() => {
          setDone(true);
          clearInterval(progressInterval);
          setProgress(100);
          setTimeout(() => router.replace('/dashboard'), 600);
        }, STEPS[stepIdx].duration);
      }
    }

    setTimeout(advanceStep, STEPS[0].duration);

    return () => clearInterval(progressInterval);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-4">
      <ThemeToggle />
      {/* Logo */}
      <div className="flex items-center gap-0.5 mb-12">
        <div className="h-8 w-9 overflow-hidden flex-shrink-0">
          <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto max-w-none" />
        </div>
        <span className="font-bricolage font-bold text-[24px] tracking-normal text-slate-900 dark:text-white leading-none">Harvin<span className="font-semibold opacity-40">AI</span></span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md">
        {/* Progress bar */}
        <div className="h-1 bg-slate-200 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#C94C1E] to-[#e07040] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-10">
          {STEPS.map((step, i) => {
            const isActive = i === currentStep && !done;
            const isComplete = i < currentStep || done;

            return (
              <div
                key={i}
                className={`flex items-center gap-4 transition-all duration-500 ${
                  i > currentStep && !done ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                }`}
              >
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-400 ${
                  isComplete
                    ? 'bg-emerald-500 scale-100'
                    : isActive
                      ? 'bg-[#C94C1E] scale-110'
                      : 'bg-slate-200 scale-100'
                }`}>
                  {isComplete ? (
                    <Check size={14} className="text-white" strokeWidth={3} />
                  ) : isActive ? (
                    <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                  )}
                </div>

                {/* Label */}
                <span className={`text-[15px] font-medium transition-colors duration-300 ${
                  isComplete
                    ? 'text-emerald-600'
                    : isActive
                      ? 'text-slate-800'
                      : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Done message */}
        <div className={`text-center transition-all duration-500 ${done ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="text-[16px] font-semibold text-slate-800">Your dashboard is ready!</p>
          <p className="text-[13px] text-slate-400 mt-1">Redirecting you now...</p>
        </div>
      </div>
    </div>
  );
}
