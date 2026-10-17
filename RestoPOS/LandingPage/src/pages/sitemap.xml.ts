import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

/** Hand-rolled rather than pulling in @astrojs/sitemap — 15 known routes. */
const STATIC = [
  '/', '/workflows', '/workflow-1', '/workflow-2', '/workflow-3',
  '/pricing', '/contact', '/blog', '/terms-conditions', '/waitlist',
  '/thank-you',
];

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection('blog');
  const paths = [...STATIC, ...posts.map((p) => `/blog/${p.id}`)];
  const urls = paths
    .map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`)
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
};
