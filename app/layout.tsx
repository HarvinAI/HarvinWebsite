import type { Metadata } from 'next';
import { DM_Sans, Fraunces, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import { ModalProvider } from '@/components/ModalContext';

/* ── Google fonts ─────────────────────────────────────────────────────────── */
const dmSans = DM_Sans({
  subsets:  ['latin'],
  variable: '--font-sans',
  display:  'swap',
});

const fraunces = Fraunces({
  subsets:  ['latin'],
  variable: '--font-display',
  display:  'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-mono',
  display:  'swap',
});

/* ── Self-hosted KyivType Sans ────────────────────────────────────────────── */
const kyivType = localFont({
  src: [
    { path: '../public/fonts/KyivTypeSans-Regular2.otf', weight: '400', style: 'normal' },
    { path: '../public/fonts/KyivTypeSans-Medium2.otf',  weight: '500', style: 'normal' },
    { path: '../public/fonts/KyivTypeSans-Bold2.otf',    weight: '700', style: 'normal' },
  ],
  variable: '--font-kyiv',
  display:  'swap',
});

/* ── Metadata ─────────────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title:       'HarvinAI — D2C Brand Intelligence',
  description: 'Never miss a D2C opportunity. Track 500K+ brands, real-time signals, and buying windows.',
};

/* ── Root layout ──────────────────────────────────────────────────────────── */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className=""
      suppressHydrationWarning
    >
      <body
        className={`${dmSans.variable} ${fraunces.variable} ${jetbrainsMono.variable} ${kyivType.variable}`}
      >
        <ThemeProvider>
          <ModalProvider>
            {children}
          </ModalProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
