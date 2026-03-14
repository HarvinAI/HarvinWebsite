'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app error boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0A0A0A] p-6">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">⚠</div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {error?.message?.includes('fetch')
            ? 'Could not load data — the server may be busy. Please try again.'
            : 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg bg-[#C94C1E] text-white text-sm font-medium hover:bg-[#B3421A] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
