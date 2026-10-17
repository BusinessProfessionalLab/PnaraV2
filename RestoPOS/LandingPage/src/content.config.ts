import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

/**
 * Two collections:
 *
 * `blog` — one Markdown file per article in src/content/blog/. This is the
 * source of truth for posts; the blog index and related strips read their
 * card data from here too, so editing a post updates everywhere.
 *
 * `content` — one JSON file, one entry per content group, for repeated
 * section content (logos, plans, FAQs, nav links, workflow pages, and the
 * blog cards that have no article behind them).
 */
const blog = defineCollection({
  /* Astro slugifies ids, which would turn "parley-2.0-..." into
     "parley-20-...". Framer's URL keeps the dot, so keep the filename. */
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/blog',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    excerpt: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    authorRole: z.string(),
    authorOrg: z.string(),
    avatar: z.string(),
    cover: z.string(),
    /* Social card image; link previews want JPG or PNG. Falls back to the cover. */
    ogImage: z.string().optional(),
  }),
});

const content = defineCollection({
  loader: file('src/content/content.json', {
    parser: (text) =>
      Object.entries(JSON.parse(text)).map(([id, items]) => ({ id, items })),
  }),
  schema: z.object({ items: z.array(z.any()) }),
});

export const collections = { blog, content };
