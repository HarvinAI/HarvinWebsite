'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/components/ThemeProvider';
import { useModal } from '@/components/ModalContext';

/* ── Icons ──────────────────────────────────────────────────────────────────*/
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
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isLoggedIn = status === 'authenticated' && !!session?.user;
  const userName = session?.user?.name || 'User';
  const userEmail = session?.user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

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

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = () => setDropdownOpen(false);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [dropdownOpen]);

  const close = () => setMenuOpen(false);

  const handleLogout = () => {
    ['harvin_user', 'harvin_onboarding', 'harvin_dashboard_filters'].forEach(k => {
      try { localStorage.removeItem(k); } catch { /* */ }
    });
    signOut({ callbackUrl: '/' });
  };

  const navLinks = [
    { label: 'Product', href: '/product' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Blog',    href: '/blog'    },
  ];

  return (
    <>
      {/* ═══ HEADER BAR ═══ */}
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

          {/* LEFT: Logo + Nav links */}
          <div className="flex items-center gap-6 flex-shrink-0">
            <Link href="/" aria-label="HarvinAI home" className="flex items-center gap-0.5">
              <div className="h-8 w-9 overflow-hidden flex-shrink-0">
                <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto max-w-none" />
              </div>
              <span className="font-bricolage font-bold text-[24px] tracking-normal text-slate-900 dark:text-white leading-none">
                Harvin<span className="font-semibold opacity-40">AI</span>
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
              {/* Dashboard link — only for logged-in users */}
              {isLoggedIn && (
                <li>
                  <Link href="/dashboard"
                    className="inline-block px-3 py-1.5 text-[15px] font-medium rounded-md transition-all duration-150
                               text-slate-600 dark:text-slate-300
                               hover:text-slate-900 dark:hover:text-white
                               hover:bg-slate-100 dark:hover:bg-white/[0.07]
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:ring-offset-2">
                    Dashboard
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* SPACER */}
          <div className="flex-1" />

          {/* RIGHT: Theme + Auth (desktop only) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme toggle */}
            <button onClick={onToggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 flex-shrink-0
                         text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white
                         hover:bg-slate-100 dark:hover:bg-white/[0.07] border border-slate-200 dark:border-white/[0.1]">
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>

            {isLoggedIn ? (
              /* ── Logged-in: Avatar dropdown ── */
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}
                  className="flex items-center gap-2.5 h-9 pl-1 pr-3 rounded-full transition-all duration-150
                             border border-slate-200 dark:border-white/[0.1]
                             hover:bg-slate-50 dark:hover:bg-white/[0.05]
                             hover:border-slate-300 dark:hover:border-white/20"
                >
                  <div className="w-7 h-7 rounded-full bg-[#C94C1E] flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                    {userName}
                  </span>
                  <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 14 14" fill="none">
                    <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Dropdown */}
                {dropdownOpen && (
                  <div className="absolute right-0 top-[calc(100%+6px)] w-[220px] rounded-xl overflow-hidden
                                  bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/[0.1]
                                  shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
                      <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{userName}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{userEmail}</p>
                    </div>
                    <div className="py-1.5">
                      <Link href="/dashboard" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium
                                   text-slate-600 dark:text-slate-300
                                   hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                          <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
                          <rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>
                        </svg>
                        Dashboard
                      </Link>
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium
                                   text-red-500 dark:text-red-400
                                   hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                          <path d="M6 14H3.33A1.33 1.33 0 012 12.67V3.33A1.33 1.33 0 013.33 2H6M11 11.33L14 8l-3-3.33M14 8H6"/>
                        </svg>
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── Not logged in: Sign in + Early access ── */
              <>
                <Link href="/signin"
                  className="inline-flex items-center px-4 py-1.5 rounded-btn text-[14px] font-semibold transition-all duration-150
                             text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/[0.18]
                             hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-white/40
                             hover:bg-slate-50 dark:hover:bg-white/[0.06]
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500">
                  Sign in
                </Link>

                <button
                  onClick={() => openModal('early-access')}
                  className="inline-flex items-center px-4 py-1.5 rounded-btn text-[14px] font-semibold transition-all duration-150
                             text-white bg-ember-500 shadow-[0_1px_4px_rgba(201,76,30,0.3)]
                             hover:bg-ember-400 hover:shadow-[0_4px_14px_rgba(201,76,30,0.4)]
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500">
                  Get early access
                </button>
              </>
            )}
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

      {/* ═══ BACKDROP ═══ */}
      <div
        onClick={close}
        aria-hidden="true"
        className={[
          'fixed inset-0 z-[55] bg-black/40 backdrop-blur-[2px] md:hidden',
          'transition-opacity duration-300',
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* ═══ RIGHT DRAWER (mobile) ═══ */}
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
            <span className="font-bricolage font-extrabold text-[18px] tracking-normal text-slate-900 dark:text-white leading-none">
              Harvin<span className="font-normal opacity-40 ml-[2px]">AI</span>
            </span>
          </Link>

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
          {/* User info (mobile, logged in) */}
          {isLoggedIn && (
            <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06]">
              <div className="w-9 h-9 rounded-full bg-[#C94C1E] flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  userInitial
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{userName}</p>
                <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
              </div>
            </div>
          )}

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
            {isLoggedIn && (
              <li>
                <Link href="/dashboard" onClick={close}
                  className="flex items-center justify-between px-3 py-3 rounded-md transition-all duration-150
                             text-[15px] font-medium
                             text-slate-700 dark:text-slate-300
                             hover:text-slate-900 dark:hover:text-white
                             hover:bg-slate-100 dark:hover:bg-white/[0.07]">
                  Dashboard
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            )}
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
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" onClick={close}
                className="w-full text-center py-2.5 rounded-btn text-[14px] font-semibold transition-all duration-150
                           text-white bg-ember-500 hover:bg-ember-400
                           shadow-[0_2px_8px_rgba(201,76,30,0.3)]">
                Go to Dashboard
              </Link>
              <button onClick={() => { close(); handleLogout(); }}
                className="w-full text-center py-2.5 rounded-btn text-[14px] font-semibold transition-all duration-150
                           text-red-500 dark:text-red-400
                           border border-red-200 dark:border-red-800/40
                           hover:bg-red-50 dark:hover:bg-red-500/10">
                Sign out
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default Navbar;
