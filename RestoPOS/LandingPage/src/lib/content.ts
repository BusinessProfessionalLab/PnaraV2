import { getEntry } from 'astro:content';

export interface LogoPart { kind: string; w: number; h: number; d: string; h2: string }
export interface Logo { slug: string; parts: LogoPart[] }
export interface Benefit { num: string; active: boolean; mosaic: string; image: string; w: number; h: number; title: string; desc: string }
export interface Feature { step: number; label: string; desc: string; mock: string; srcset: string; w: number; h: number }
export interface Testimonial { quote: string; avatar: string; srcset: string; name: string; role: string }
export interface PlanFeature { text: string; off: boolean }
export interface Plan {
  index: number; featured: boolean; name: string; currency: string; amount: string;
  period: string; desc: string; features: PlanFeature[];
  cta: { href: string; label: string; variant: 'primary' | 'secondary' };
}
export interface FaqItem { q: string; a: string }
export interface IntegrationTile { src: string; alt: string }
export interface IntegrationRow { dir: string; tiles: IntegrationTile[] }
export interface Link { href: string; label: string; dropdown?: Link[] }
export interface FooterColumn { title: string; links: Link[] }
export interface HiwTab { step: number; label: string }

/** Typed accessor for one content group. Throws if the group is missing. */
export async function group<T>(id: string): Promise<T[]> {
  const entry = await getEntry('content', id);
  if (!entry) throw new Error(`content group "${id}" not found in src/content/content.json`);
  return entry.data.items as T[];
}

export interface Block {
  type: 'p' | 'li' | 'h' | 'image' | 'table';
  text?: string; level?: number; src?: string; alt?: string;
  head?: string[]; rows?: string[][];
}
export interface PostCard {
  slug: string | null; category: string; title: string; excerpt?: string;
  dateLabel: string; cover: string; featured?: boolean; side?: boolean;
}
export interface WorkflowFeature { dots: number; title: string; desc: string }
export interface Workflow {
  slug: string; category: string; title: string; card: string; lede: string;
  hero: string; heroAlt: string; sectionTitle: string; sectionTitleEm: string;
  sectionLede: string;
  wide: { title: string; desc: string; image: string; alt: string };
  features: WorkflowFeature[];
  proofTitle: string; quote: string; name: string; role: string; avatar: string;
  brand: string; stat: string; statLabel: string;
}
export interface ComparisonRow { label: string; values: (string | boolean)[] }
export interface ComparisonGroup { title: string; rows: ComparisonRow[] }
export interface ComparisonPlan { name: string; blurb: string }
export interface ContactMethod { icon: string; title: string; desc: string; value: string }
export interface Stat { value: string; label: string }
export interface TermsSection { num: string; title: string; blocks: Block[] }

/** "Jun 9, 2026" — the label format the Framer CMS renders dates with. */
export function dateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}
