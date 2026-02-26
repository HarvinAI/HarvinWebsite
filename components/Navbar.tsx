'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { useModal } from '@/components/ModalContext';

/* ── Icons ──────────────────────────────────────────────────────────────────*/
const SearchIcon = () => (
  <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SunIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const MoonIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M17.5 11.5A7.5 7.5 0 1 1 8.5 2.5a5.5 5.5 0 0 0 9 9z"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Component ──────────────────────────────────────────────────────────────*/
const Navbar = () => {
  const { isDark, toggle: onToggleTheme } = useTheme();
  const { openModal } = useModal();
  const [scrolled,      setScrolled]      = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  /* Scroll shadow */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Lock body scroll while drawer is open */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  const navLinks = [
    { label: 'Product', href: '/product' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Blog',    href: '/blog'    },
  ];

  return (
    <>
      {/* ════════════════════════════════════════════════════════════
          HEADER BAR
      ════════════════════════════════════════════════════════════ */}
      <header
        className={[
          'fixed top-0 inset-x-0 z-50 transition-all duration-200 backdrop-blur-xl',
          'border-b border-slate-200 dark:border-white/[0.08]',
          scrolled
            ? 'bg-white/95 dark:bg-[#0D0D0C]/90 shadow-[0_2px_16px_rgba(0,0,0,0.07)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.35)]'
            : 'bg-white/80 dark:bg-[#0D0D0C]/60',
        ].join(' ')}
      >
        <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center gap-8">

          {/* LEFT: Logo + divider + Nav links */}
          <div className="flex items-center gap-6 flex-shrink-0">
            <Link href="/" aria-label="HarvinAI home" className="flex items-center gap-2.5">
              <div className="h-8 w-8 overflow-hidden flex-shrink-0">
                <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto max-w-none" />
              </div>
              <span className="font-kyiv font-bold text-[24px] tracking-[-0.02em] text-slate-900 dark:text-white leading-none">
                Harvin<span className="font-normal opacity-40">AI</span>
              </span>
            </Link>

            <span className="hidden md:block w-px h-5 bg-slate-200 dark:bg-white/[0.12]" aria-hidden="true" />

            <ul className="hidden md:flex items-center gap-0.5 list-none m-0 p-0">
              {navLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href}
                    className="inline-block px-3 py-1.5 text-[15px] font-medium rounded-md transition-all duration-150
                               text-slate-600 dark:text-slate-300
                               hover:text-slate-900 dark:hover:text-white
                               hover:bg-slate-100 dark:hover:bg-white/[0.07]
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:ring-offset-2">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SPACER */}
          <div className="flex-1" />

          {/* RIGHT: Search + Theme + Buttons (desktop only) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Search */}
            <div
              onClick={() => document.getElementById('navbar-search')?.focus()}
              className={[
                'flex items-center gap-2.5 h-9 px-3.5 rounded-lg cursor-text w-[220px] border transition-all duration-150',
                searchFocused
                  ? 'bg-white dark:bg-white/[0.08] border-slate-300 dark:border-white/25 shadow-sm'
                  : 'bg-slate-100 dark:bg-white/[0.05] border-slate-200 dark:border-white/[0.1] hover:border-slate-300 dark:hover:border-white/20',
              ].join(' ')}
            >
              <SearchIcon />
              <input id="navbar-search" type="text" placeholder="Search brands..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="flex-1 min-w-0 bg-transparent text-[13px] outline-none border-none font-sans
                           text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" />
              <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[11px] flex-shrink-0
                              border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.05]
                              text-slate-400 dark:text-slate-500">
                ⌘K
              </kbd>
            </div>

            {/* Theme toggle */}
            <button onClick={onToggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 flex-shrink-0
                         text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white
                         hover:bg-slate-100 dark:hover:bg-white/[0.07] border border-slate-200 dark:border-white/[0.1]">
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Sign in */}
            <Link href="/signin"
              className="inline-flex items-center px-4 py-1.5 rounded-btn text-[14px] font-semibold transition-all duration-150
                         text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/[0.18]
                         hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-white/40
                         hover:bg-slate-50 dark:hover:bg-white/[0.06]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500">
              Sign in
            </Link>

            {/* Get early access */}
            <button
              onClick={() => openModal('early-access')}
              className="inline-flex items-center px-4 py-1.5 rounded-btn text-[14px] font-semibold transition-all duration-150
                         text-white bg-ember-500 shadow-[0_1px_4px_rgba(201,76,30,0.3)]
                         hover:bg-ember-400 hover:shadow-[0_4px_14px_rgba(201,76,30,0.4)]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500">
              Get early access
            </button>
          </div>

          {/* Hamburger — mobile / tablet */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            className="md:hidden ml-auto flex flex-col justify-center gap-[5px]
                       w-9 h-9 p-2 rounded-md transition-colors duration-150
                       hover:bg-slate-100 dark:hover:bg-white/[0.07]"
          >
            <span className="block w-full h-0.5 rounded-sm bg-slate-600 dark:bg-slate-300" />
            <span className="block w-full h-0.5 rounded-sm bg-slate-600 dark:bg-slate-300" />
            <span className="block w-4   h-0.5 rounded-sm bg-slate-600 dark:bg-slate-300" />
          </button>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════
          BACKDROP — click to close
      ════════════════════════════════════════════════════════════ */}
      <div
        onClick={close}
        aria-hidden="true"
        className={[
          'fixed inset-0 z-[55] bg-black/40 backdrop-blur-[2px] md:hidden',
          'transition-opacity duration-300',
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* ════════════════════════════════════════════════════════════
          RIGHT DRAWER
      ════════════════════════════════════════════════════════════ */}
      <aside
        aria-label="Navigation menu"
        aria-hidden={!menuOpen}
        className={[
          'fixed top-0 right-0 bottom-0 z-[60] md:hidden',
          'w-[85vw] max-w-[320px]',
          'flex flex-col',
          'bg-white dark:bg-[#0D0D0C]',
          'border-l border-slate-200 dark:border-white/[0.08]',
          'shadow-[-8px_0_32px_rgba(0,0,0,0.12)] dark:shadow-[-8px_0_32px_rgba(0,0,0,0.5)]',
          'transition-transform duration-300 ease-in-out',
          menuOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-[64px] border-b border-slate-200 dark:border-white/[0.08] flex-shrink-0">
          <Link href="/" onClick={close} className="flex items-center gap-2.5">
            <div className="h-7 w-7 overflow-hidden flex-shrink-0">
              <img src="/logo.svg" alt="" aria-hidden="true" className="h-7 w-auto max-w-none" />
            </div>
            <span className="font-kyiv font-bold text-[18px] tracking-[-0.02em] text-slate-900 dark:text-white leading-none">
              Harvin<span className="font-normal opacity-40">AI</span>
            </span>
          </Link>

          {/* Close button */}
          <button
            onClick={close}
            aria-label="Close navigation menu"
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-slate-500 dark:text-slate-400
                       hover:text-slate-900 dark:hover:text-white
                       hover:bg-slate-100 dark:hover:bg-white/[0.07]
                       transition-colors duration-150"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto flex flex-col px-4 py-4 gap-1">

          {/* Search */}
          <div className="flex items-center gap-2.5 h-10 px-3.5 rounded-lg mb-3
                          bg-slate-100 dark:bg-white/[0.06]
                          border border-slate-200 dark:border-white/[0.1]">
            <SearchIcon />
            <input type="text" placeholder="Search brands..."
              className="flex-1 bg-transparent text-[14px] outline-none font-sans
                         text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" />
          </div>

          {/* Nav links */}
          <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
            {navLinks.map(({ label, href }) => (
              <li key={label}>
                <Link href={href} onClick={close}
                  className="flex items-center justify-between px-3 py-3 rounded-md transition-all duration-150
                             text-[15px] font-medium
                             text-slate-700 dark:text-slate-300
                             hover:text-slate-900 dark:hover:text-white
                             hover:bg-slate-100 dark:hover:bg-white/[0.07]">
                  {label}
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>

          {/* Divider */}
          <div className="my-3 border-t border-slate-200 dark:border-white/[0.08]" />

          {/* Theme toggle row */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-md
                          bg-slate-50 dark:bg-white/[0.04]
                          border border-slate-200 dark:border-white/[0.07]">
            <span className="text-[14px] font-medium text-slate-600 dark:text-slate-400">
              {isDark ? 'Dark mode' : 'Light mode'}
            </span>
            <button onClick={onToggleTheme} aria-label={isDark ? 'Switch to light' : 'Switch to dark'}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150
                         text-slate-500 dark:text-slate-400
                         hover:text-slate-900 dark:hover:text-white
                         hover:bg-slate-200 dark:hover:bg-white/[0.1]">
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        {/* Drawer footer — CTA buttons */}
        <div className="flex-shrink-0 px-4 pb-6 pt-3 flex flex-col gap-2.5
                        border-t border-slate-200 dark:border-white/[0.08]">
          <Link href="/signin" onClick={close}
            className="w-full text-center py-2.5 rounded-btn text-[14px] font-semibold transition-all duration-150
                       text-slate-700 dark:text-slate-300
                       border border-slate-300 dark:border-white/[0.18]
                       hover:text-slate-900 dark:hover:text-white
                       hover:bg-slate-50 dark:hover:bg-white/[0.05]">
            Sign in
          </Link>
          <button
            onClick={() => { close(); openModal('early-access'); }}
            className="w-full text-center py-2.5 rounded-btn text-[14px] font-semibold transition-all duration-150
                       text-white bg-ember-500 hover:bg-ember-400
                       shadow-[0_2px_8px_rgba(201,76,30,0.3)]">
            Get early access
          </button>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
