# Parley: code template

Two builds of the same site, an AI agent startup called Parley. Pick one. They are visually identical, and that is checked element by element on every page at desktop, tablet and phone widths.

| Folder | Stack | Use it when |
| --- | --- | --- |
| `astro/` | Astro 7, static output | You want components and almost no JavaScript. |
| `next/` | Next.js 16, App Router, static export | You already work in React. |

Each folder has its own README with commands and the files to edit.

## Pages

Home, Workflows, three workflow detail pages, Pricing, Contact, Blog, ten blog articles, Terms & Conditions, Waitlist, Thank you and a 404.

## Content

- Blog articles are Markdown files in `src/content/blog/`. Add a file to add an article: the blog index cards, the related-posts strip and the sitemap read from the same files.
- Everything repeated (logos, benefit cards, features, testimonials, plans, FAQs, integration tiles, nav and footer links, workflow pages, the comparison table, contact methods, terms sections) is in `src/content/content.json`.
- Colours and the type scale are CSS custom properties in `src/styles/tokens.css` (Next: `src/styles/site.css`, top of the file).

## Motion

Every behaviour is a small module in `src/scripts/`, one per section, with no animation library: the hero that opens to full bleed on scroll, the hide-on-scroll nav, the benefit cards, the delegation tabs, the testimonial and logo marquees, the how-it-works animations (Lottie), the FAQ accordion, the Load More button and the phone plan picker on the comparison table.

- **Reduced motion**: motion is withdrawn and the layout stays intact.
- **No JavaScript**: every section renders complete at its resting state.

## Forms

The contact and waitlist forms post their fields as JSON to your endpoint (Astro: `PUBLIC_FORM_ENDPOINT`, Next: `NEXT_PUBLIC_FORM_ENDPOINT`). Leave it unset and submissions stay in the browser: the form shows its success state and nothing is sent.

## Demo content

Every name, quote, statistic and logo is for demonstration only. The email is `hello@example.com`. The terms are sample text, not legal advice. Replace all of it before you go live.

## Licence

MIT, see `LICENSE`. Third-party resources are listed in `LICENSES.txt`.
