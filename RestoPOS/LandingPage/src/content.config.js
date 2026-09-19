import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * Release notes.
 *
 * Mirrors the release model the product itself uses (`frontend/src/lib/releases`):
 * a version, a date, a short lede and a list of typed change items, so the site
 * and the in-app version page describe releases the same way.
 */
const changelog = defineCollection({
	loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/changelog' }),
	schema: z.object({
		title: z.string(),
		publishDate: z.coerce.date(),
		version: z.string().optional(),
		/** Shamsi label rendered as-is — avoids relying on ICU at build time. */
		dateLabel: z.string().optional(),
		description: z.string().optional(),
		changes: z
			.array(
				z.object({
					type: z.enum(['feature', 'improvement', 'bugfix', 'performance', 'security']),
					title: z.string(),
					description: z.string().optional(),
				}),
			)
			.optional(),
	}),
});

export const collections = { changelog };
