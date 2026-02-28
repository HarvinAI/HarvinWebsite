import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ember: {
          50:  '#FEF3EE',
          100: '#FDDECB',
          200: '#FBBA93',
          300: '#F48E56',
          400: '#E56B2C',
          500: '#C94C1E',
          600: '#A93D18',
          700: '#832F13',
          800: '#5E220E',
          900: '#3D160A',
        },
        slate: {
          50:  '#F8F8F7',
          100: '#EFEFED',
          200: '#DDDCD8',
          300: '#C2C0BA',
          400: '#9A978F',
          500: '#6E6B63',
          600: '#4A4842',
          700: '#343330',
          800: '#232220',
          950: '#0D0D0C',
        },
      },
      fontFamily: {
        sans:    ['var(--font-sans)',    'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia',   'serif'     ],
        mono:    ['var(--font-mono)',    'monospace'               ],
        kyiv:    ['var(--font-kyiv)',    'system-ui', 'sans-serif'],
        jakarta: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        btn:   '8px',
        card:  '12px',
        modal: '16px',
      },
      animation: {
        marquee:  'marquee 45s linear infinite',
        scan:     'scan 6s linear infinite',
        'fade-up': 'fadeUp 0.6s ease-out forwards',
      },
      keyframes: {
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        scan: {
          '0%':   { top: '-4px'  },
          '100%': { top: '100%' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
      },
    },
  },
  plugins: [],
};

export default config;
