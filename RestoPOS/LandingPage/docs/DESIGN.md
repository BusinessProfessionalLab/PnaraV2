# توست‌ایران — Design System

This document describes the visual system implemented in the landing page.

## Design Direction

The site keeps the calm, product-led aesthetic of the original RicoFast system and
adapts it for a Persian (RTL) product:

- Warm light canvas, blue primary accent, gold highlight accent.
- Editorial display weight for headings — carried by **weight**, not by a serif.
- Dashed separators and restrained card borders.
- Subtle motion, never heavy animation.
- Full support for class-based dark mode.

## Language And Script

The site is **Persian and right-to-left**, matching the product itself.

- `<html lang="fa" dir="rtl">` is set in `src/layouts/Layout.astro`.
- All type is set in **Vazirmatn** — the same typeface the application uses.
- Instrument Serif (the template's display face) has no Arabic-script coverage
  and is **not** used. `--font-brand` maps to Vazirmatn.
- Latin-only surfaces (the `TOASTIRAN POS` wordmark, SKUs, protocol names) use
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
`.NET 8`, `SQL Server` or `ESC/POS` inside Persian sentences.

## Source Files

- `src/styles/global.css` — tokens, fonts, global styles, dark mode variables.
- `tailwind.config.mjs` — content scanning and dark mode strategy.
- `src/layouts/Layout.astro` — document shell, `lang`/`dir`, dark-mode boot script.
- `src/assets/js/main.js` — dark-mode toggle, sticky header, mobile menu, AOS init.
- `src/styles/aos-custom.css` — scroll-reveal tuning.

## Color Tokens

Defined in `src/styles/global.css`. Palette unchanged from the base system.

### Brand

| Token | Value | Usage |
| --- | --- | --- |
| `--color-primary` | `#2d6dc3` | Brand color, links, CTAs, headings |
| `--color-primary-strong` | `#0066ff` | Hover and emphasis |
| `--color-primary-light` | `#8fb9ff` | Light accents |
| `--color-accent` | `#fad13b` | Badges, highlights |

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
| `--color-text-primary` | `#2d6dc3` | Light-mode headings |
| `--color-text-secondary` | `#3f4a5a` | Light-mode body text |
| `--color-text-primary-dark` | `#3884eb` | Dark-mode headings |
| `--color-text-secondary-dark` | `#c5cedb` | Dark-mode body text |

`h1`, `h2` and `h3` are colored with the primary token globally. Dark mode is
class-based (`html.dark`), stored in `localStorage` under `dark_mode`.

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

- AOS is initialized in `src/assets/js/main.js` with `once: true`.
- `src/components/ui/AnimatedText.astro` staggers hero copy in with `motion`.
- Component-level CSS animation is used for product previews.
- Everything must respect `prefers-reduced-motion`.

Common attributes:

```html
data-aos="fade-up-xs"
data-aos-once="true"
data-aos-delay="200"
```

There is also an RTL-specific pattern in `HeroSection`: reveal directions are
`fade-right-sm` / `fade-left-sm` and must be read as "from the start edge" and
"from the end edge" respectively.

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
- Keep cards restrained: subtle borders, low shadow, clean spacing.
- Maintain light and dark mode styles for every new surface.
- Prefer token values over one-off hex colors.

## Content Rules

- Copy is written for a café owner in Iran, in Persian, about real workflows.
- Avoid generic marketing filler. Every claim must be traceable to the actual
  `frontend/` or `backend/` implementation.
- Do not invent pricing tiers, customer logos, testimonials or metrics.
- Money: stored in Rial, always displayed in Toman.
- Dates: Jalali/Shamsi everywhere.
