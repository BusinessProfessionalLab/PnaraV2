# PRD — توست‌ایران landing page

> Describes the site as it is implemented. For what the product does, read
> `../../frontend`, `../../backend` and `../../docs/SYSTEM_DOCUMENTATION.md`.

## Purpose

Convince an Iranian café owner that ToastIran POS solves the operational problems
they lose money on, and get them to request a demo.

The site has to answer, in order: what this is, who it is for, what problem it
solves, what a café can actually do with it, how a working day changes, and what
to do next.

## Audience

| Reader | What they need |
| --- | --- |
| Café / restaurant owner | A number they can trust for "how much did I make today" |
| Head barista / kitchen lead | Fewer mistakes between the register and the station |
| Store admin | Menu, recipes, inventory and staff control without spreadsheets |
| Technical decision maker | Where it runs, what it talks to, where the data lives |

## Positioning

| Field | Value |
| --- | --- |
| Product | تُوست‌ایران (ToastIran POS) |
| Category | Touch POS + inventory + reporting for cafés and restaurants |
| Core promise | Every order deducts its ingredients and shows real profit |
| Differentiators | Recipe-driven auto-deduction · Rial storage / Toman display · Jalali dates · Iranian PC-POS card readers and ESC/POS printers · runs on your own server |
| Language | Persian, RTL |

## Implemented Scope

- Static Astro 6 site, Tailwind CSS v4 tokens, MDX content.
- Persian/RTL document, Vazirmatn typography.
- Light and dark mode with persisted preference.
- Product mockups for the register, bar/kitchen display, reports and inventory.
- Release notes driven by a content collection, mirroring the product's releases.
- SEO foundations: canonical URLs, Open Graph, Twitter card, sitemap, robots.txt.
- Generated Open Graph card and favicon (`pnpm brand:assets`).
- Responsive at 375 / 768 / 1024 / 1440.

## Out Of Scope

- No pricing tiers. The product has no billing system, so inventing plans would
  misrepresent it. Commercial terms are handled through the contact page.
- No blog. Removed rather than shipped with template filler.
- No testimonials, customer logos or usage metrics — none are verifiable.
- No authentication or app screens. The product UI lives in `../frontend`.

## Routes

| Route | Source |
| --- | --- |
| `/` | `src/pages/index.astro` |
| `/features` | `src/pages/features.astro` |
| `/changelog` | `src/pages/changelog.astro` + `src/content/changelog/` |
| `/about` | `src/pages/about.astro` |
| `/contact` | `src/pages/contact.astro` |
| `/404` | `src/pages/404.astro` |
| `/sitemap-index.xml` | `@astrojs/sitemap` |

## Navigation

Defined in `src/collections/menu.json`:

- خانه (`/`)
- قابلیت‌ها — dropdown into the nine feature anchors
- نسخه‌ها (`/changelog`)
- درباره (`/about`)
- تماس (`/contact`)

Footer groups (product, setup, company, get started) are defined in
`src/components/sections/Footer.astro`.

## Home Page Sections

1. **Hero** — value proposition, primary/secondary CTA, three concrete facts, and
   the register preview at full width.
2. **Integrations** — card readers, thermal printer, touch screen, runtime. Real
   hardware, in place of a customer-logo strip.
3. **Problems** — the four places cafés leak money, each mapped to a real mechanism.
4. **What it is** — the menu → recipe → inventory → profit chain.
5. **Capabilities** — eight cards grouped by café workflow, each linking to its
   feature anchor.
6. **Showcases** — order-to-ticket (KDS), profit reporting, inventory, each as a
   split text/preview section.
7. **Inside the register** — six register behaviours that matter at rush hour.
8. **The register, in full** — full-width POS preview.
9. **A working day** — six ordered steps from opening to closing the shift.
10. **Setup** — what is required to run it, without hedging.
11. **Roles** — owner, cashier, barista/kitchen, store admin.
12. **Before / after** — paper and spreadsheets versus the system.
13. **FAQ** — honest answers, including limitations.
14. **Final CTA** — demo request.

## Feature Page Modules

One anchored module per workflow, matching the nav anchors: `#pos`, `#kds`,
`#menu`, `#inventory`, `#reports`, `#shift`, `#customers`, `#staff`, `#hardware`.
Closes with a plain statement of what is *not* in the product.

## SEO

| Item | Value |
| --- | --- |
| Title | Persian, product + category |
| Description | Names the workflows and the Rial/Toman + Jalali conventions |
| Canonical | From `PUBLIC_SITE_URL` via `src/layouts/Meta.astro` |
| OG image | `/og.png`, generated shape-only card |
| OG locale | `fa_IR` |
| Sitemap | `@astrojs/sitemap` → `sitemap-index.xml` |
| Robots | `public/robots.txt` |

Keyword targeting is folded into natural Persian copy; there is no keyword
stuffing.

## Content Constraints

- Every claim must be verifiable in `../frontend` or `../backend`.
- Money: Rial on the wire, Toman on screen.
- Dates: Jalali/Shamsi.
- Mockup data must be plausible for an Iranian café but must not imply features
  that do not exist.
- No generic SaaS filler copy.

## Open Items

- Copy in the mockups is Persian, matching the product; consider whether a
  Persian-language OG card is wanted (the current card is text-free by design).
- `hello@toastiran.ir` and the default domain are placeholders — set the real
  contact address and `PUBLIC_SITE_URL` before launch.
- The contact form is UI-only; it needs an email service or API endpoint.
