import type { Metadata } from 'next';
import { JetBrains_Mono, Bricolage_Grotesque } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import { ModalProvider } from '@/components/ModalContext';
import SessionWrapper from '@/components/SessionWrapper';

/* ── Universal Sans (primary font) ────────────────────────────────────────── */
const universalSans = localFont({
  src: [
    { path: '../public/fonts/universalfont/74452ea3ef0f9101-s.p.woff2', weight: '400', style: 'normal'  },
    { path: '../public/fonts/universalfont/3d4419af2cf8609b-s.p.woff2', weight: '400', style: 'italic'  },
    { path: '../public/fonts/universalfont/904ef0a86fe32a00-s.p.woff2', weight: '600', style: 'normal'  },
    { path: '../public/fonts/universalfont/4dec29efcaeb336c-s.p.woff2', weight: '600', style: 'italic'  },
    { path: '../public/fonts/universalfont/d886a03bcda7ad8f-s.p.woff2', weight: '400', style: 'normal'  },
    { path: '../public/fonts/universalfont/f5a90156f8995c8c-s.p.woff2', weight: '600', style: 'normal'  },
  ],
  variable: '--font-sans',
  display:  'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-mono',
  display:  'swap',
});

const bricolageGrotesque = Bricolage_Grotesque({
  subsets:  ['latin'],
  variable: '--font-bricolage',
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
        className={`${universalSans.variable} ${jetbrainsMono.variable} ${bricolageGrotesque.variable}`}
      >
        <SessionWrapper>
          <ThemeProvider>
            <ModalProvider>
              {children}
            </ModalProvider>
          </ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
