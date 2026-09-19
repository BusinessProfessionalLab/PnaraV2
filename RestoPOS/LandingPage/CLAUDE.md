# CLAUDE.md

Working context and conventions for AI coding assistants editing this project.

## Project

The marketing website for **Pnara (پینارا)** — a touch POS, inventory
and reporting system for cafés and restaurants in Iran.

It is a static-first Astro site. It is **not** the product: the application lives
in `../frontend` (Next.js) and `../backend` (ASP.NET Core + SQL Server). Those
directories are the source of truth for what the product does — this repo
describes it.

Primary docs:

- `docs/PRD.md` — what this site contains and why.
- `docs/DESIGN.md` — design tokens, Persian/RTL rules, component inventory.

## Non-Negotiable: Accuracy

Every product claim on this site must be traceable to real code in `frontend/` or
`backend/`. Before writing product copy:

1. Find the implementation (controller, handler, entity, React component).
2. Only describe behaviour that exists.
3. Never invent pricing tiers, testimonials, customer logos, metrics or
   roadmap features.

If a feature is absent, either leave it out or state the limit explicitly (the
`/about` page has a "what is not included" section for exactly this reason).
Single-store is a good example: the product has one `StoreSettings`, so the site
never claims multi-branch.

## Language

The site is **Persian, RTL** (`<html lang="fa" dir="rtl">`), set in **Vazirmatn**.

- Never use `left`/`right`/`ml-*`/`pr-*` for directional intent. Use `start`/`end`,
  `ms-*`/`me-*`, `ps-*`/`pe-*`, `text-start`/`text-end`.
- Directional icons (chevrons, arrows) point the RTL way.
- Persian display headings use `.font-brand` at weight 700.
- Keep body leading loose (`leading-7` or looser).
- Latin-only strings use `.font-latin`.

## Current Stack

| Layer | Choice |
| --- | --- |
| Framework | Astro 6.4 |
| Styling | Tailwind CSS v4 with `@theme` tokens |
| Content | MDX, `@astrojs/mdx`, Astro Content Layer |
| Icons | `@lucide/astro` |
| Motion | AOS + `motion` |
| SEO | `@astrojs/sitemap`, custom meta components |
| Type checking | TypeScript, `astro check` |
| Raster assets | `sharp` via `scripts/generate-brand-assets.mjs` |

Dev server runs on port `5200` (`astro.config.mjs`).

> **Icon note:** `@lucide/astro` 1.17 dropped the legacy aliases. Use `CirclePlay`,
> `CircleCheckBig`, `TriangleAlert`, `ChartColumn` — **not** `PlayCircle`,
> `CheckCircle2`, `AlertTriangle`, `BarChart3`. Confirm an icon exists in
> `node_modules/@lucide/astro/src/icons/<kebab-name>.ts` before importing it.

## Commands

```bash
pnpm install
pnpm dev             # dev server on http://localhost:5200
pnpm build           # astro check && astro build
pnpm preview
pnpm brand:assets    # regenerate public/og.png + public/favicon.png
```

`pnpm build` must stay green — it runs `astro check` first.

## Repository Layout

```text
src/
  assets/js/main.js      Dark mode, sticky header, mobile menu, AOS init
  collections/menu.json  Header navigation (single source of truth)
  components/
    elements/            SectionHeader, PageHeader, SeparatorLine
    home/                HeroSection
    product/             Application mockups — POS, KDS, reports, inventory
    sections/            Header, Footer, FAQ
    ui/                  Button, Badge, Logo, AppFrame, BrowserFrame, AnimatedText…
    widgets/             ToTop, TrackGa, OptimizedImage
  config/site.js         Brand, metadata, product facts
  content/changelog/     Release notes (MDX)
  layouts/               Layout, PageLayout, Meta
  lib/fa.ts              Persian number/date/currency formatting helpers
  pages/                 Routes
  styles/                Design tokens and global styles
public/                  favicon.png, og.png, robots.txt
scripts/                 Brand asset generator
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page — hero, problems, capabilities, showcases, workflow, setup, roles, comparison, FAQ, CTA |
| `/features` | Anchored deep-dives per workflow |
| `/changelog` | Release notes from the `changelog` collection |
| `/about` | Product rationale, architecture, release history, explicit scope |
| `/contact` | Demo request form |
| `/404` | Not-found page |

Feature anchors are linked from `menu.json` and the footer —
`#pos`, `#kds`, `#menu`, `#inventory`, `#reports`, `#shift`, `#customers`,
`#staff`, `#hardware`. If you rename one, update `menu.json`, `Footer.astro` and
the module `id` in `pages/features.astro` together.

## Component Conventions

- Sections → `src/components/sections/`
- Primitives → `src/components/ui/`
- Text/layout helpers → `src/components/elements/`
- Product mockups → `src/components/product/`
- Page utilities → `src/components/widgets/`

Site identity comes from `src/config/site.js`. Navigation comes from
`src/collections/menu.json`.

## Product Mockups

`src/components/product/*` render the application UI. They are the most valuable
content on the site, so:

- Keep them faithful to the real screens in `../frontend` (columns, labels,
  states, button text).
- Use `src/lib/fa.ts` (`formatToman`, `formatTomanAmount`, `fa`, `faPercent`,
  `faDigits`) for every number so Rial→Toman conversion and Persian digits match
  the product.
- Pick the right numeral helper. `fa()` formats through `Intl`, which is correct
  for amounts and quantities (`۱٬۲۳۴`) but adds a thousands separator to anything
  numeric — so it turns a year into `۲٬۰۲۶`. Use `faDigits()` for labels that are
  not amounts: years, step numbers, version parts. Never leave ASCII digits in
  Persian copy; Latin digits survive only in SKU codes, routes, order numbers and
  other identifiers.
- Wrap in `AppFrame.astro` with the real route.
- Never fabricate a capability to make a screenshot look fuller.

## Styling Conventions

- Prefer Tailwind utilities plus project tokens.
- Avoid one-off hex values unless extending the token system deliberately.
- Use `font-brand` only for display headings.
- Major marketing sections use `py-16 md:py-24`; separators are dashed.
- Check every change at 375 / 768 / 1024 / 1440 and in dark mode.

## Content Rules

- Copy is Persian, written for a café owner, about real daily workflows.
- Avoid generic SaaS filler ("transform your business", "all-in-one solution").
- Money is stored in Rial and always displayed in Toman.
- Dates are Jalali/Shamsi. `changelog` frontmatter carries a pre-formatted
  `dateLabel` so the build never depends on ICU calendar data.

## SEO And Analytics

- `src/config/site.js` — title, description, keywords, OG image.
- `src/layouts/Meta.astro` — canonical URL, Open Graph, Twitter card.
- `astro.config.mjs` — `site` from `PUBLIC_SITE_URL` (set it before deploying).
- `public/robots.txt` — points at `sitemap-index.xml`.

Environment variables:

```env
PUBLIC_SITE_URL=https://pnara.ir
PUBLIC_GA4_ID=
PUBLIC_UMAMI_ID=
```
