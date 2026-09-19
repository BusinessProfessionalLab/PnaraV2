# پینارا — Landing Page

The marketing site for **Pnara (پینارا)**, a touch POS, inventory and
reporting system for cafés and restaurants in Iran.

Static site built with Astro 6, Tailwind CSS v4 and MDX. Persian, right-to-left,
set in Vazirmatn — the same typeface the product uses.

> This repository is only the website. The product itself lives in `../frontend`
> (Next.js) and `../backend` (ASP.NET Core + SQL Server). Those are the source of
> truth for what the product does; see `CLAUDE.md` for the accuracy rules that
> apply to all copy on this site.

## Quick start

```bash
pnpm install
pnpm dev        # http://localhost:5200
```

Environment variables — copy `.env.example` to `.env` and set the production
domain before deploying:

```env
PUBLIC_SITE_URL=https://your-domain.com
PUBLIC_GA4_ID=          # optional
PUBLIC_UMAMI_ID=        # optional
```

`PUBLIC_SITE_URL` drives canonical URLs, Open Graph tags and the sitemap.

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server on port 5200 |
| `pnpm build` | `astro check && astro build` → `dist/` |
| `pnpm preview` | Preview the production build |
| `pnpm brand:assets` | Regenerate `public/og.png` and `public/favicon.png` |
| `pnpm check` | Biome lint + format |

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Landing page: hero, problems, capabilities, product showcases, a working day, setup, roles, before/after, FAQ, CTA |
| `/features` | Feature deep-dives, one anchored module per workflow |
| `/changelog` | Release notes, mirroring the product's own release history |
| `/about` | Why it exists, design decisions, architecture, release timeline, explicit scope |
| `/contact` | Demo request form |
| `/404` | Not-found page |

## Where to edit what

| What | Where |
| --- | --- |
| Brand name, domain, contact email, meta tags, product version | `src/config/site.js` |
| Header navigation and feature anchors | `src/collections/menu.json` |
| Landing page sections and copy | `src/pages/index.astro` |
| Feature deep-dives | `src/pages/features.astro` |
| Product mockups (POS, KDS, reports, inventory) | `src/components/product/` |
| Currency/date formatting for mockups | `src/lib/fa.ts` |
| Release notes | `src/content/changelog/*.mdx` |
| Design tokens and fonts | `src/styles/global.css` |
| Footer link groups | `src/components/sections/Footer.astro` |

Nav anchors are referenced from `menu.json`, the footer and the module `id`s in
`src/pages/features.astro`. Renaming one means updating all three.

## Product mockups

`src/components/product/*` reproduce real screens from the application. They are
wrapped in `AppFrame.astro` and render amounts through `src/lib/fa.ts`, so the
Rial→Toman conversion and Persian digits match the product exactly.

Two rules:

1. Keep them faithful — columns, labels, states and button text come from
   `../frontend`, not from imagination.
2. Never add a capability the application does not have.

## Deploy

The build is static; any host works.

```bash
pnpm build      # → dist/
```

Set `PUBLIC_SITE_URL` in the host's environment before building so canonical
URLs and the sitemap are correct.

## Documentation

- `docs/DESIGN.md` — design tokens, Persian/RTL rules, component inventory.
- `docs/PRD.md` — what this site contains and why.
- `CLAUDE.md` — working context for AI assistants, including the accuracy rules.
