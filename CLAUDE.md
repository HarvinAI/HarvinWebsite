# HarvinAI — Design System Rules for Figma MCP Integration

This document is the source of truth for translating Figma designs into code (and code into Figma) for this project. **Anything generated from a Figma file must conform to the tokens, primitives, and patterns below.** Do not invent new tokens, components, or libraries without first checking if an equivalent already exists.

---

## 0. TL;DR for the Figma MCP Workflow

When `use_figma`, `generate_figma_design`, or `get_design_context` produces code:

1. **Use Tailwind utility classes only** — no inline `style={{}}` props for things Tailwind can express, no CSS-in-JS, no CSS Modules.
2. **Colors must come from the Tailwind theme**: `ember-{50..900}` (brand) and `slate-{50..950}` (neutral). Status colors use the default Tailwind palette (`emerald-*`, `red-*`, `amber-*`).
3. **Always pair light/dark variants**: every visible color/background/border needs a `dark:` counterpart.
4. **Typography uses CSS variables** wired by `next/font` in `app/layout.tsx`: `font-sans` (Universal Sans, primary), `font-bricolage` (display/logo), `font-mono` (JetBrains Mono).
5. **Icons**: prefer `lucide-react`. Inline SVG only when an icon doesn't exist in Lucide or needs custom styling (e.g. logo, marquee glyphs).
6. **Component files live in `/components/*.tsx`** (PascalCase, single-component-per-file, default export, `'use client'` only when interactivity is needed).
7. **Routes live in `/app/<segment>/page.tsx`** (Next.js 16 App Router — already on Server Components by default).

---

## 1. Token Definitions

### Where tokens are defined

| Token type      | Source of truth                                 |
| --------------- | ----------------------------------------------- |
| Colors          | `tailwind.config.ts` → `theme.extend.colors`    |
| Font families   | `tailwind.config.ts` → `theme.extend.fontFamily` (CSS vars wired in `app/layout.tsx`) |
| Border radius   | `tailwind.config.ts` → `theme.extend.borderRadius` |
| Animations      | `tailwind.config.ts` → `theme.extend.animation` + `keyframes` |
| Global CSS / scrollbars / `@property` | `app/globals.css` |

> ⚠ There are **two** Tailwind config files: `tailwind.config.ts` (canonical) and `tailwind.config.js` (legacy). When changing tokens, update **both** until the `.js` file is deleted. The `.js` file references a `font-display`/`font-kyiv`/`font-jakarta` family that is no longer used — do not introduce new usages.

### Color palette (use these exact keys)

```ts
// tailwind.config.ts
ember: {  // brand orange — accents, CTAs, links
  50:'#FEF3EE', 100:'#FDDECB', 200:'#FBBA93', 300:'#F48E56',
  400:'#E56B2C', 500:'#C94C1E', 600:'#A93D18', 700:'#832F13',
  800:'#5E220E', 900:'#3D160A',
},
slate: {   // neutrals — backgrounds, text, borders
  50:'#F8F8F7', 100:'#EFEFED', 200:'#DDDCD8', 300:'#C2C0BA',
  400:'#9A978F', 500:'#6E6B63', 600:'#4A4842', 700:'#343330',
  800:'#232220', 950:'#0D0D0C',
},
```

- **Primary brand color**: `ember-500` (`#C94C1E`). Hover state: `ember-400`.
- **Page backgrounds**: `bg-slate-50` (light) / `bg-slate-950` (dark).
- **Body text**: `text-slate-900` (light) / `text-slate-100` or `text-white` (dark).
- **Secondary text**: `text-slate-500` (light) / `text-slate-400` (dark).
- **Borders**: `border-slate-200` (light) / `border-white/[0.06..0.12]` (dark — use translucent white, not slate, for dark borders).
- **Status**: success `emerald-500`, error `red-500`, warning `amber-500` (default Tailwind palette).

> When Figma supplies a raw hex (e.g. `#C94C1E`), **map it to the token** (`ember-500`) instead of writing the hex inline. Only fall back to bracket notation like `bg-[#0F0E0C]` for one-off dark-mode background colors that don't yet have a token (notably the deep card background `#0F0E0C` / footer black `#0C0B09` / drawer black `#0D0D0C`).

### Border radius tokens

```ts
borderRadius: { btn: '8px', card: '12px', modal: '16px' }
```

Use `rounded-btn` for buttons, `rounded-card` for cards/tiles, `rounded-modal` for dialogs. Tailwind's built-in `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` are also acceptable when the design calls for them.

### Animation tokens

```ts
animation: {
  marquee:  'marquee 45s linear infinite',     // brand ticker
  scan:     'scan 6s linear infinite',         // TechScanner laser line
  'fade-up':'fadeUp 0.6s ease-out forwards',   // entrance animation
}
```

Use `animate-marquee`, `animate-scan`, `animate-fade-up`. For one-off animations, define keyframes in `app/globals.css` or extend the config — do not use inline `style` keyframes.

### Token transformation system

None. Tokens are consumed **directly via Tailwind's JIT compiler**. There is no Style Dictionary, no design-tokens.json, no postcss transform other than `tailwindcss` + `autoprefixer`. If the Figma MCP returns raw tokens (CSS variables, JSON), translate them to Tailwind utility classes referencing the palette above.

---

## 2. Component Library

### Where components live

```
/components/         ← shared/marketing/site-wide components (default export, PascalCase)
/app/<route>/page.tsx ← page-level components
/app/<route>/*.tsx   ← route-scoped subcomponents (rare — usually inline)
```

Notable shared components and what they own:

| Component                | Responsibility                                            |
| ------------------------ | --------------------------------------------------------- |
| `Navbar.tsx`             | Fixed top nav, theme toggle, auth dropdown, mobile drawer |
| `Footer.tsx`             | Marketing footer (always-dark `#0C0B09`)                  |
| `Hero.tsx`               | Landing-page hero + ticker + dashboard screenshot         |
| `TechScanner.tsx`        | Domain-input scanner card (glow-border CTA)               |
| `CTA.tsx`                | Reusable "Book a Demo" section                            |
| `EarlyAccessModal.tsx`   | Lead-capture modal (driven by `ModalContext`)             |
| `LegalPageLayout.tsx`    | Wrapper for `/privacy`, `/terms`, etc. Exposes sub-primitives `LegalSection`, `LegalList`, `LegalLink`, `LegalContact` — use these when composing legal/marketing prose blocks. |
| `ThemeProvider.tsx`      | `useTheme()` hook; toggles `.dark` class on `<html>`      |
| `ModalContext.tsx`       | `useModal()` for opening `'early-access'` and friends     |
| `SessionWrapper.tsx`     | NextAuth session provider                                 |
| `ChatBot.tsx`            | Floating chat widget                                      |
| `DashboardTour.tsx`      | First-run product tour                                    |

### Component architecture rules

- **Functional components only**, default export, file name = component name (PascalCase).
- **Client vs Server**: omit `'use client'` for pure-render components. Add it when the component uses hooks (`useState`, `useEffect`, `useSession`, `useTheme`, `useModal`) or browser APIs.
- **Props**: typed inline (`{ title, children }: { title: string; children: React.ReactNode }`). No `interface FooProps` files; only extract to a named type if it's reused.
- **No `forwardRef`, no `displayName` boilerplate** unless an external lib (e.g. NextAuth) requires it.
- **Composition over variants**: there is no `cva`/`class-variance-authority` setup. Variants are expressed by passing className strings or by branching JSX inside the component (see `Navbar.tsx`'s logged-in vs logged-out branches).
- **Modals open through context**, not portals: `const { openModal } = useModal(); openModal('early-access')`.

### Documentation / Storybook

**None.** There is no Storybook, no MDX docs, no Chromatic. The components themselves are the docs — when Figma generates a new component, place it next to its closest neighbor in `/components/` and follow that neighbor's structure (className conventions, font sizes, dark mode pairing).

---

## 3. Frameworks & Libraries

| Layer            | Library                                                |
| ---------------- | ------------------------------------------------------ |
| Framework        | **Next.js 16.1.6** (App Router, React 19.2.3)          |
| Language         | TypeScript 5 (strict mode), `@/*` path alias to repo root |
| Styling          | **Tailwind CSS 3.4** + `autoprefixer` + `postcss`      |
| Icons            | **lucide-react ^0.575** (tree-shaken, JSX components)  |
| Auth             | next-auth ^4.24                                        |
| Data viz         | recharts ^3.8                                          |
| Backend / scripts| `mongodb`, `axios`, `puppeteer-*`, `@sparticuz/chromium` (server-only — listed in `serverExternalPackages`) |
| Build / bundler  | Next.js default (Turbopack in dev)                     |

### Allowed in the design / UI layer

- `react`, `react-dom`, `next/*` (`next/link`, `next/font`, `next/image` when adopted)
- `tailwindcss` utility classes
- `lucide-react` for icons
- `recharts` for charts on the dashboard
- `next-auth/react` for the session hook

### Not allowed (do not introduce)

- shadcn/ui, Radix UI, MUI, Chakra, Mantine, Headless UI — there is no shadcn registry installed and no `components/ui/*` directory. Build primitives manually with Tailwind to match the existing visual language.
- styled-components, emotion, vanilla-extract, CSS Modules
- clsx / classnames / cva — string concatenation or array-join is the current pattern (`[...].join(' ')` — see `Navbar.tsx`)
- New icon libraries (heroicons, react-icons, etc.) — use Lucide

If a Figma design clearly requires shadcn or Radix-style behavior (combobox, popover, focus traps), confirm with the user before adding the dependency.

---

## 4. Asset Management

### Where assets live

```
/public/
  logo.svg                       ← brand mark
  favicon (in /app/favicon.ico)
  *.png                          ← product screenshots (light + dark pairs)
    dashboard-preview.png  / dashboard-preview-dark.png
    tech-scanner.png       / tech-scanner-dark.png
    Watchlist.png          / Watchlist-dark.png
    Look-a-Like.png        / Look-a-Like-dark.png
    Marketintell.png       / marketintell-dark.png
    signals-preview.png
  /fonts/                        ← self-hosted font files
    universalfont/*.woff2        ← Universal Sans (primary)
    KyivTypeSans-*.otf           ← (legacy, not currently wired)
    UniversalSans-Regular.ttf    ← (legacy, replaced by woff2 set)
```

### Reference conventions

- **Always reference public assets as root-relative paths**: `src="/logo.svg"`, `src="/dashboard-preview.png"`. Never import images as ES modules (the project does not use `next/image` yet — keep using `<img>` to match existing patterns).
- **Light/dark image pairs**: render both with `block dark:hidden` and `hidden dark:block`:

  ```tsx
  <img src="/dashboard-preview.png"      alt="…" className="block dark:hidden" />
  <img src="/dashboard-preview-dark.png" alt="…" className="hidden dark:block" />
  ```

- **`loading="eager"`** for above-the-fold imagery, **`loading="lazy"`** below.
- **Alt text is required**. Decorative SVGs use `alt=""` + `aria-hidden="true"`.

### Optimization

There is no image optimization pipeline today (Vercel's `next/image` is not adopted yet). PNGs in `/public` are exported at ~2× retina from the design source. If Figma exports new screenshots, keep them under ~600KB and provide both light and dark variants when the screenshot is theme-sensitive.

### CDN

Hosted on Vercel; static assets in `/public` are served from Vercel's edge automatically. No additional CDN configuration.

---

## 5. Icon System

### Source

- **Primary**: `lucide-react` — import only the icons you need:

  ```tsx
  import { ArrowRight, Check, ChevronDown, X } from 'lucide-react';
  ```
- **Custom / brand icons** (logo, social glyphs, hamburger): inline `<svg>` with `viewBox`, `fill="currentColor"` or `stroke="currentColor"` so they inherit text color. See `Footer.tsx` (Twitter/LinkedIn/GitHub) and `Navbar.tsx` (Sun/Moon).

### Usage rules

- Lucide icons take props: `<ArrowRight size={16} strokeWidth={2} className="text-ember-500" />`.
- Prefer **`size={14|16|18|20}`** to match existing components. Default Lucide is 24 — usually too large.
- For inline SVGs, fix dimensions with Tailwind: `className="w-4 h-4"` (not the SVG `width`/`height` attrs alone).
- Icons are **never decorative-only without `aria-hidden="true"`**. Buttons that are icon-only need `aria-label`.

### Naming convention

- Lucide names are PascalCase from the library — keep as-is.
- Local inline-SVG components live in the same file as their consumer (e.g. `const SunIcon = () => (…)` at the top of `Navbar.tsx`). Only extract into a separate file when an icon is reused across 3+ files.

---

## 6. Styling Approach

### Methodology

**Tailwind utility-first**, atomic classes composed directly in JSX. No CSS Modules, no styled-components, no `clsx`.

### Class composition pattern

Long class strings are split across lines for readability (one logical concern per line — layout, colors, hover, dark):

```tsx
<button
  className="inline-flex items-center px-4 py-1.5 rounded-btn text-[14px] font-semibold transition-all duration-150
             text-white bg-ember-500 shadow-[0_1px_4px_rgba(201,76,30,0.3)]
             hover:bg-ember-400 hover:shadow-[0_4px_14px_rgba(201,76,30,0.4)]
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
>
  Get early access
</button>
```

When classes are conditional, use array-join (no helper library):

```tsx
className={[
  'fixed top-0 inset-x-0 z-50 transition-all duration-300',
  scrolled
    ? 'bg-white/60 dark:bg-[#0D0D0C]/60 border-b border-slate-200/50'
    : 'bg-white/30 dark:bg-[#0D0D0C]/30 border-b border-transparent',
].join(' ')}
```

### Dark mode

- Class-based via Tailwind: `darkMode: 'class'`. The `.dark` class is toggled on `<html>` by `ThemeProvider.tsx` (`useTheme()` hook).
- **Every visible color utility needs a `dark:` companion**. This is a hard rule — Figma output without dark-mode pairs is incomplete.
- Light/dark border idiom: light uses solid slate (`border-slate-200`), dark uses translucent white (`border-white/[0.06]`, `border-white/[0.08]`, `border-white/[0.12]`).
- Light/dark background hover idiom: light uses `hover:bg-slate-50/100`, dark uses `hover:bg-white/[0.05]` or `hover:bg-white/[0.07]`.

### Global styles

`app/globals.css` is intentionally minimal:

- The `@tailwind` directives (base / components / utilities).
- A single `@layer base` rule setting the body background, text, and font.
- The `.scrollbar-thin` helper for inset scroll surfaces (filter sidebar).
- The `@property --border-angle` + `border-rotate` keyframe + `.glow-border` / `.glow-border-inner` pair powering the `TechScanner` glowing-border effect.

Do not add component-level CSS here unless it cannot be expressed in Tailwind (e.g. `@property` registrations, complex multi-keyframe animations).

### Responsive design

Tailwind breakpoints, mobile-first:
- `sm:` ≥ 640px
- `md:` ≥ 768px (primary "tablet/desktop" cutoff — the navbar collapses below this)
- `lg:` ≥ 1024px
- `xl:` ≥ 1280px

Common idioms:
- Page container: `max-w-[1100px] mx-auto px-6` (marketing) or `max-w-[1280px] mx-auto px-6` (app shell — see Navbar).
- Fluid type: `text-[clamp(28px,5.5vw,64px)]` for hero headlines.
- Mobile drawer pattern: hidden by default with `md:hidden`, slides in via `translate-x-full` → `translate-x-0` on state (see `Navbar.tsx`).

### Spacing scale

Stick to Tailwind's default 4px scale (`p-1` = 4px, `p-2` = 8px, …). Use arbitrary values (`p-3.5`, `gap-[18px]`) only when matching a Figma export that doesn't snap to the scale.

### Shadows

Shadows are usually arbitrary to match brand softness:
- Buttons (ember CTA): `shadow-[0_1px_4px_rgba(201,76,30,0.3)]` → hover `shadow-[0_4px_14px_rgba(201,76,30,0.4)]`
- Cards: `shadow-[0_4px_32px_rgba(0,0,0,0.06)]` light / `shadow-[0_4px_40px_rgba(0,0,0,0.35)]` dark
- Dropdowns / panels: `shadow-[0_8px_30px_rgba(0,0,0,0.08)]` / dark `shadow-[0_8px_30px_rgba(0,0,0,0.4)]`

Reuse these exact values — do not introduce a new shadow scale.

### Typography ramp (observed)

| Use                       | Class                                              |
| ------------------------- | -------------------------------------------------- |
| Hero H1                   | `text-[clamp(28px,5.5vw,64px)] font-bold tracking-[-0.02em] leading-[1.08]` |
| Section H2                | `text-[clamp(30px,3.5vw,48px)] font-semibold tracking-[-0.025em] leading-[1.08]` |
| Card H3                   | `text-[18px] sm:text-[20px] font-bold`              |
| Body                      | `text-[16px] leading-relaxed`                      |
| Small body / captions     | `text-[13px]` or `text-[13.5px]`                   |
| Micro / footnotes         | `text-[11px]` / `text-[12px]`                      |
| Uppercase badge           | `text-[12px] font-semibold uppercase tracking-[0.12em]` |

Font families (CSS variables from `next/font`):
- `font-sans` → Universal Sans (default body; also used for most headlines)
- `font-bricolage` → Bricolage Grotesque (the **HarvinAI** wordmark in nav/footer)
- `font-mono` → JetBrains Mono (rare; mostly product UI)

---

## 7. Project Structure

```
/app/                       Next.js App Router routes
  layout.tsx                Root layout — wires fonts, ThemeProvider, ModalProvider, SessionWrapper
  globals.css               Tailwind directives + tiny global rules
  page.tsx                  Marketing home (Navbar + Hero + sections + Footer)
  /<segment>/page.tsx       Per-route page (signin, signup, dashboard, account/[domain], scan/[domain], product, pricing, privacy, terms, …)
  /api/<route>/route.ts     Next.js Route Handlers (server-only — see next.config.ts `serverExternalPackages`)
/components/                Shared UI (PascalCase, default export)
/lib/                       Server / domain logic
  /scan/                    Tech-stack & company-meta scanning
  /signals/                 Buying-signal detectors
  /scoring/                 Harvin score v1 (signal-based, replaces additive scoring)
  /utils/                   Misc helpers
  auth-db.ts                MongoDB user/session helpers
/public/                    Static assets (images, fonts, svgs)
/scripts/                   Node scripts (run with `node scripts/<name>.js`)
/extension/                 Chrome extension source (separate build target — popup.html/css/js)
/docs/                      Internal markdown notes
auth.ts                     NextAuth configuration (root level, imported by route handlers)
next.config.ts              Next config
tailwind.config.ts          Tailwind config (canonical)
tailwind.config.js          Legacy Tailwind config — keep in sync until deleted
postcss.config.js           PostCSS plugins
tsconfig.json               TS config (`@/*` → repo root)
```

### Feature organization patterns

- **No `/src` directory** — top-level `app/`, `components/`, `lib/` are the roots.
- **No barrel `index.ts` files in `/components`** — import each component directly: `import Hero from '@/components/Hero';`.
- **Dynamic routes** use bracketed folders: `/app/account/[domain]/page.tsx`, `/app/scan/[domain]/page.tsx`.
- **API routes** mirror REST shape under `/app/api/<resource>/route.ts` (e.g. `app/api/accounts/route.ts`, `app/api/company-meta/route.ts`).
- **Domain logic stays under `/lib`** and is imported into both `/app/api/*` route handlers and (when it's pure) UI components. The scan pipeline (`/lib/scan`) is JavaScript, not TS — preserve `.js` when editing it; new files should be `.ts`.
- **The Chrome extension under `/extension`** is a separate build artifact (zips at the repo root) and uses plain HTML/CSS/JS — do not pull React or Tailwind into it.

### Path aliasing

`tsconfig.json` defines `"@/*": ["./*"]`. Use `@/components/Foo`, `@/lib/scan/db`, never relative `../../components/Foo`.

### File naming

| Kind                      | Pattern                                  |
| ------------------------- | ---------------------------------------- |
| React components          | `PascalCase.tsx` (`Navbar.tsx`)          |
| Hooks / contexts          | `PascalCase.tsx` if exporting a Provider component + hook (e.g. `ThemeProvider.tsx` exporting `useTheme`); otherwise `useFoo.ts` |
| Route segments            | lowercase folder name (`/dashboard/page.tsx`) |
| Lib modules               | `kebab-case.ts` or single-word `db.ts`   |
| API route                 | `route.ts` (Next.js convention)          |

---

## 8. Figma MCP — Translation Cheat Sheet

When the Figma MCP returns design context, normalize it to this project's conventions:

| Figma concept                                      | Code translation                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| Fill = `#C94C1E` / `#E56B2C` / `#F48E56`           | `bg-ember-500` / `bg-ember-400` / `bg-ember-300`                    |
| Fill = neutrals (greys)                            | `bg-slate-{50..950}` per the palette above                          |
| Text style `H1 / Display`                          | `font-sans font-bold text-[clamp(28px,5.5vw,64px)] tracking-[-0.02em] leading-[1.08]` |
| Text style `H2 / Section`                          | `font-sans font-semibold text-[clamp(30px,3.5vw,48px)] tracking-[-0.025em] leading-[1.08]` |
| Text style `Body / 16`                             | `text-[16px] leading-relaxed text-slate-500 dark:text-slate-400`    |
| Text style `Caption / 13`                          | `text-[13px] text-slate-400 dark:text-slate-500`                    |
| Logo wordmark `HarvinAI`                           | `font-bricolage font-bold text-[24px] text-slate-900 dark:text-white` with `<span class="font-semibold opacity-40">AI</span>` |
| Corner radius 8 / 12 / 16                          | `rounded-btn` / `rounded-card` / `rounded-modal`                    |
| Corner radius 9999 / pill                          | `rounded-full`                                                      |
| Drop shadow on CTA button                          | `shadow-[0_1px_4px_rgba(201,76,30,0.3)] hover:shadow-[0_4px_14px_rgba(201,76,30,0.4)]` |
| Drop shadow on card                                | `shadow-[0_4px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_40px_rgba(0,0,0,0.35)]` |
| 1px stroke / divider                               | `border border-slate-200 dark:border-white/[0.08]`                  |
| Icon (24px or smaller, mono)                       | Lucide component, `size={16}` (or 14/18/20) + `className="text-…"`  |
| Auto-layout horizontal, gap 8                      | `flex items-center gap-2`                                           |
| Auto-layout vertical, gap 16                       | `flex flex-col gap-4`                                               |
| Frame `max-width: 1100`                            | `max-w-[1100px] mx-auto px-6`                                       |
| Modal / dialog                                     | Drive via `useModal()` and `ModalContext`, not a new portal         |

### Code Connect

There are **no Code Connect mappings** (`*.figma.ts` / `*.figma.js`) in this repo yet. When `add_code_connect_map` is invoked, place mapping files next to the component (e.g. `components/Hero.figma.ts`).

### Hard "do not" list when generating from Figma

1. Do not introduce new packages (shadcn, Radix, clsx, heroicons, styled-components, etc.) — see §3.
2. Do not write inline hex/rgb when a token exists — see §1.
3. Do not omit dark-mode variants — see §6.
4. Do not create a new icon library — use Lucide or inline SVG — see §5.
5. Do not extract one-off helpers into `/lib` — keep them colocated.
6. Do not add a Storybook story or MDX doc — they don't exist here.
7. Do not regenerate `tailwind.config.js` (legacy) without also updating `tailwind.config.ts`.
8. Do not use `next/image` retroactively — match the existing `<img>` pattern unless the user explicitly opts in to the migration.
