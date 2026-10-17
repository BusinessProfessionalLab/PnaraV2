# Parley for Next.js

Next.js 16 (App Router, React 19), exported as a static site. Node 20.9 or later.

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # static site in out/
npm start         # serve out/
```

## Where things are

| What | File |
| --- | --- |
| Blog articles | `src/content/blog/*.md` (the file name is the URL) |
| Repeated section content: logos, plans, FAQs, nav and footer links, workflow pages, comparison table, contact methods, terms | `src/content/content.json` |
| Structured data (JSON-LD) | `src/content/schema.json` |
| Colours, type scale, all styles | `src/styles/site.css` (tokens at the top) |
| Images, Lottie files, favicon | `public/assets/` |
| Pages | `src/app/` (the workflow pages are `src/app/[workflow]/page.tsx`, one per entry in the `workflows` group) |
| Sections | `src/components/sections/` |
| Buttons | `src/components/Button.tsx`, `FormButton.tsx`, `LoadMore.tsx` |
| Head tags and page shell | `src/layouts/Head.tsx`, `Base.tsx` (nav, closing CTA, footer), `Bare.tsx` (waitlist, thank you) |
| Markdown and content loading | `src/lib/collections.ts` |
| Sitemap, robots.txt | `src/app/sitemap.ts`, `src/app/robots.ts` |
| Behaviour | `src/scripts/*.js`, one module per section, mounted by `src/app/Scripts.tsx` |
| Optional CMS | `public/admin/` (Sveltia CMS, edits `src/content/blog/`) |

Components are server components that render plain markup. Behaviour is plain DOM JavaScript loaded once on the client, so the pages are complete before any script runs.

Set your domain in `NEXT_PUBLIC_SITE_URL` (used for canonical, social image and sitemap URLs, and the JSON-LD).

## Environment variables

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your domain, e.g. `https://example.com`. |
| `NEXT_PUBLIC_FORM_ENDPOINT` | Where the contact and waitlist forms post their fields as JSON. Unset: nothing is sent and the form shows its success state. |
| `NEXT_PUBLIC_VERCEL_ANALYTICS=1` | Loads Vercel Web Analytics and Speed Insights. |
| `NEXT_PUBLIC_GA_ID=G-XXXX` | Loads Google Analytics. |

## CMS

`public/admin/` is an optional admin UI for the blog. Locally, run `npm run dev`, open `http://localhost:3000/admin/index.html` and choose "Work with Local Repository". For production editing, set your repo in `public/admin/config.yml` and register a GitHub OAuth app. Don't want it? Delete `public/admin/`.

## Deploy

Any static host. On Vercel, import the folder; it detects Next.js. Elsewhere, upload `out/`. `vercel.json` turns on clean URLs.
