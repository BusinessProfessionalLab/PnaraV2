# پینارا — Design System

This document describes the visual system implemented in the landing page.

## Design Direction

The site keeps the calm, product-led aesthetic of the original RicoFast system and
adapts it for a Persian (RTL) product, with a warm editorial layer inspired by
the reference (warm stone canvas, sand bands, pastel preview stages, pill
buttons, 24px cards, playful CSS-only decorations — reinterpreted, never copied):

- Warm light canvas, blue primary accent, gold highlight accent.
- Ink headings (`#19222f`); blue stays reserved for actions, links and accents.
- Eyebrow pills above section headings, sand bands alternating with white cards.
- Pastel stages behind product previews; playful sun/ring/smile/diamond/dot shapes.
- Pill buttons, 24px card radii, subtle hover lift, single soft hero entrance.
- Full support for class-based dark mode.

## Language And Script

The site is **Persian and right-to-left**, matching the product itself.

- `<html lang="fa" dir="rtl">` is set in `src/layouts/Layout.astro`.
- All type is set in **Vazirmatn** — the same typeface the application uses.
- Instrument Serif (the template's display face) has no Arabic-script coverage
  and is **not** used. `--font-brand` maps to Vazirmatn.
- Latin-only surfaces (the `PNARA` wordmark, SKUs, protocol names) use
  `--font-latin` (Inter) through the `.font-latin` utility.

### RTL Rules

Use logical properties and utilities. Never hard-code `left` / `right` / `ml-` /
`pr-` for directional intent.

| Instead of | Use |
| --- | --- |
| `ml-4` / `mr-4` | `ms-4` / `me-4` |
| `pl-*` / `pr-*` | `ps-*` / `pe-*` |
| `left-*` / `right-*` | `start-*` / `end-*` |
| `text-left` / `text-right` | `text-start` / `text-end` |

Icons that imply direction (chevrons, arrows) must point the RTL way — a "continue"
action uses `ArrowLeft`, while vertical and semantic icons (search, printer, menu,
calendar, chevrons for expansion) are left alone.

Hand-entrance animations (`fade-left` / `fade-right` and the diagonal variants)
are mirrored for RTL in `src/styles/aos-custom.css`, and are dropped to a vertical
reveal below `md`, where the alternating columns stack full-width.

### Numerals and mixed content

Persian digits everywhere. `src/lib/fa.ts` is the only place numbers are formatted:

- `fa()` / `faPercent()` / `formatToman()` — amounts and quantities, grouped
  (`۱٬۲۳۴ تومان`).
- `faDigits()` — labels that are not amounts: years, step numbers, version parts.
  `fa()` would render a year as `۲٬۰۲۶`.

LTR identifiers keep their Latin form and are isolated with `dir="ltr"` so they are
not reordered by the bidi algorithm: route paths (`/admin/inventory`), SKUs
(`ESB-001`), order numbers (`#1024`), email addresses, phone numbers, and names like
`.NET 8`, `PostgreSQL` or `ESC/POS` inside Persian sentences.

## Source Files

- `src/styles/global.css` — tokens, fonts, global styles, dark mode variables.
- `tailwind.config.mjs` — content scanning and dark mode strategy.
- `src/layouts/Layout.astro` — document shell, `lang`/`dir`, dark-mode boot script.
- `src/assets/js/main.js` — dark-mode toggle, sticky header, mobile menu.

## Color Tokens

Defined in `src/styles/global.css`. Palette unchanged from the base system.

### Brand

| Token | Value | Usage |
| --- | --- | --- |
| `--color-primary` | `#2d6dc3` | Brand color, links, CTAs, small accents |
| `--color-primary-strong` | `#0066ff` | Hover and emphasis |
| `--color-primary-light` | `#8fb9ff` | Light accents |
| `--color-accent` | `#fad13b` | Badges, highlights |

### Warm surfaces (reference-inspired, original values)

| Token | Value | Usage |
| --- | --- | --- |
| `--color-ink` | `#19222f` | Headings |
| `--color-cream` | `#faf8f3` | Band gradient start |
| `--color-sand` | `#f1ece2` | Band gradient end |
| `--color-sand-border` | `#e5dccb` | Card borders |
| `--color-mist-blue` | `#e9f1fd` | Preview stage tint |
| `--color-mist-green` | `#ecf6d9` | Preview stage tint |
| `--color-mist-pink` | `#fbe8fa` | Preview stage tint |
| `--color-mist-amber` | `#fcf0c2` | Preview stage tint |
| `--color-lime` | `#dbfc74` | Tiny playful accent only |
| `--radius-xl` | `24px` | Cards, stages, bands |
| `--radius-lg` | `16px` | Small cards |
| `--radius-pill` | `999px` | Buttons, eyebrows, chips |

Shared utilities in `global.css`: `.eyebrow`, `.band-sand`, `.band-card`,
`.card-lift`, `.preview-stage`, `.deco-*`, `.rise`.

### Background

| Token | Value | Usage |
| --- | --- | --- |
| `--color-bg-primary` | `#fdfaf5` | Light page canvas |
| `--color-bg-secondary` | `#fff` | Cards and panels |
| `--color-bg-primary-light` | `#faf9f5` | Nested warm surfaces |
| `--color-bg-primary-dark` | `#0b1220` | Dark page canvas |
| `--color-bg-secondary-dark` | `#0f1b2d` | Dark cards and panels |

### Text

| Token | Value | Usage |
| --- | --- | --- |
| `--color-text-primary` | `#19222f` | Light-mode headings (ink, not blue) |
| `--color-text-secondary` | `#3f4a5a` | Light-mode body text |
| `--color-text-primary-dark` | `#e8eef7` | Dark-mode headings |
| `--color-text-secondary-dark` | `#c5cedb` | Dark-mode body text |

`h1`, `h2` and `h3` use the ink token globally; blue is reserved for actions.
Dark mode is class-based (`html.dark`), stored in `localStorage` under `dark_mode`.

## Typography

| Token | Font | Usage |
| --- | --- | --- |
| `--font-brand` | Vazirmatn | Display headings, hero titles, large section headings |
| `--font-sans` | Vazirmatn, Inter | Body text, UI labels, navigation, buttons |
| `--font-latin` | Inter | Latin-only surfaces (wordmark, SKUs) |

Rules:

- `.font-brand` forces `font-weight: 700`. Persian display headings need real
  weight; a 400-weight sans reads as body copy.
- Base `line-height` is `1.75`. Persian needs looser leading than Latin — keep
  multi-line paragraphs at `leading-7`/`leading-8` or looser.
- Do not use negative letter spacing.
- Keep compact UI headings smaller than hero headings.

## Layout Tokens

| Token/Class | Value | Usage |
| --- | --- | --- |
| `--max-screen` | `1200px` | Main site width |
| `--inner-screen` | `800px` | Articles and narrow content |
| `.site-container` | max width + horizontal padding | Page sections |
| `.inner-container` | inner max width + padding | Narrow content |

Major marketing sections use `py-16 md:py-24`.

## Motion

- No scroll-reveal or text-stagger animation libraries. Pages render static
  content so mobile devices never pay for scroll listeners or per-word
  blur/transform work.
- One soft hero entrance (`.rise`, staggered `rise-1/2/3`) plus CSS-only hover
  lifts (`.card-lift`); everything respects `prefers-reduced-motion`.
- Component-level CSS animation is used sparingly for product previews
  (pulsing live dots) and respects `prefers-reduced-motion`.
- Hover transitions stay CSS-only (`transform`/`opacity`).

## Core Components

| Component | Path | Role |
| --- | --- | --- |
| Header | `src/components/sections/Header.astro` | Main navigation, dark-mode toggle |
| Footer | `src/components/sections/Footer.astro` | Footer navigation |
| HeroSection | `src/components/home/HeroSection.astro` | Home hero + register preview |
| FAQ | `src/components/sections/FAQ.astro` | Accordion FAQ section |
| Button | `src/components/ui/Button.astro` | CTA and link buttons |
| Badge | `src/components/ui/Badge.astro` | Small labels |
| AccordionItem | `src/components/ui/AccordionItem.astro` | FAQ item |
| Logo | `src/components/ui/Logo.astro` | Product wordmark (text-based) |
| AppFrame | `src/components/ui/AppFrame.astro` | Application screen frame |
| BrowserFrame | `src/components/ui/BrowserFrame.astro` | Generic browser frame |
| SectionHeader | `src/components/elements/SectionHeader.astro` | Section title and description |
| PageHeader | `src/components/elements/PageHeader.astro` | Page-level header |

## Product Preview Components

The strongest asset of this site is the product itself. Previews live in
`src/components/product/`:

| Component | Screen it represents |
| --- | --- |
| `PosPreview.astro` | `/pos` — the touch register |
| `KdsPreview.astro` | `/kds` — bar / kitchen display |
| `ReportsPreview.astro` | `/admin/reports` |
| `InventoryPreview.astro` | `/admin/inventory` |

Rules for these:

- **They must stay faithful to the real application.** Layout, labels, states and
  columns are copied from `frontend/`, not invented.
- Wrap them in `AppFrame.astro` with a `label`, the real `route`, and `live` for
  screens that show a connection badge.
- Format every amount with the helpers in `src/lib/fa.ts` so Rial→Toman
  conversion and Persian digits match the product exactly.
- Never add a capability, column or state the application does not have.

## Raster Assets

`public/og.png` and `public/favicon.png` are generated shape-only compositions
(no text, so there is no font/script dependency in the renderer). Regenerate with:

```bash
pnpm brand:assets
```

The generator draws from the tokens above — update `TOKENS` in
`scripts/generate-brand-assets.mjs` if the palette changes.

## UI Rules

- Use existing components before creating new ones.
- Use Lucide icons via `@lucide/astro`.
- Use `Button.astro` for primary and secondary CTAs.
- Use `AppFrame.astro` for application screens, `BrowserFrame.astro` for generic frames.
- Keep cards warm and generous: white on sand, `rounded-[24px]`, token borders, token shadows, `.card-lift` on hover.
- Maintain light and dark mode styles for every new surface.
- Prefer token values over one-off hex colors.

## Content Rules

- Copy is written for a café owner in Iran, in Persian, about real workflows.
- Avoid generic marketing filler. Every claim must be traceable to the actual
  `frontend/` or `backend/` implementation.
- Do not invent pricing tiers, customer logos, testimonials or metrics.
- Money: stored in Rial, always displayed in Toman.
- Dates: Jalali/Shamsi everywhere.
