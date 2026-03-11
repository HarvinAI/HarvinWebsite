'use client';

import { useTheme } from '@/components/ThemeProvider';

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed top-4 right-4 z-50 w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150
                 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white
                 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700
                 border border-slate-200 dark:border-white/[0.1]
                 shadow-sm hover:shadow-md"
    >
      {isDark ? (
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
          <path d="M17.5 11.5A7.5 7.5 0 1 1 8.5 2.5a5.5 5.5 0 0 0 9 9z"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
