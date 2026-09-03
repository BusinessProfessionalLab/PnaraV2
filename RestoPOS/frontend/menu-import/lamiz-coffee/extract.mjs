#!/usr/bin/env node
/**
 * Lamiz Coffee menu extractor (read-only).
 *
 * Reads the saved page HTML (Lamiz page is Elementor + JetEngine listings,
 * one grid per JetTabs category tab) and writes a normalized dataset that can
 * later be imported through the app's existing menu APIs.
 *
 * Page structure (verified against the live HTML):
 *   - each category tab (jet-tabs-control-*) owns a content pane
 *     (jet-tabs-content-*) whose bounds assign items to categories;
 *   - every product card (jet-listing-grid__item) renders its fields as
 *     consecutive <span class="jet-listing-dynamic-field__content"> nodes:
 *       1. Persian name
 *       2. English name
 *       3. one or more price rows — either "<label>: <price>" or bare
 *          "<price>"; an optional "<n> کالری" row follows a labeled row
 *       4. optional "محتویات: …" description (last row)
 *
 * Usage:
 *   LAMIZ_HTML=/path/to/lamiz-coffee-menu.html node menu-import/lamiz-coffee/extract.mjs
 *
 * Produces:
 *   menu-import/lamiz-coffee/data/lamiz-menu.json  — normalized dataset
 *   .../validation.md                              — validation report
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = process.env.LAMIZ_HTML;
if (!htmlPath) {
  console.error("Set LAMIZ_HTML to the downloaded menu page.");
  process.exit(1);
}
const html = readFileSync(htmlPath, "utf8");

/* ---------- helpers ---------- */

const decode = (s) =>
  s
    .replace(/&zwnj;/g, "\u200c")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

const stripTags = (s) =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u200b\u200e\u200f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const faDigits = "۰۱۲۳۴۵۶۷۸۹";
const toLatinDigits = (s) =>
  s.replace(/[۰-۹]/g, (ch) => String(faDigits.indexOf(ch)));

/* ---------- categories (JetTabs controls + their content panes) ---------- */

const controlRe =
  /<div id="jet-tabs-control-(248\d+)"[\s\S]*?jet-tabs__label-image" src="(?:data:[^"]*"[^>]*data-lazy-src=")?([^"]+)">?[\s\S]*?jet-tabs__label-text">([^<]+)<\/span>/g;
const tabByControlId = new Map();
let m;
while ((m = controlRe.exec(html))) {
  tabByControlId.set(m[1], { imageUrl: m[2], label: decode(m[3]).trim() });
}

/* JetTabs renders all content panes; an item belongs to the pane that
   opened last before its position in the document. */
const contentOpenRe = /id="jet-tabs-content-(248\d+)"/g;
const contentOpens = [];
while ((m = contentOpenRe.exec(html))) {
  contentOpens.push({ id: m[1], index: m.index });
}
const categoryForItem = (position) => {
  let current = null;
  for (const open of contentOpens) {
    if (open.index < position) current = open.id;
    else break;
  }
  return current;
};

/* ---------- per-card structural parse ---------- */

const itemRe = /<div class="jet-listing-grid__item jet-listing-dynamic-post-\d+/g;
const itemIndexes = [];
while ((m = itemRe.exec(html))) itemIndexes.push(m.index);

const contentRe =
  /jet-listing-dynamic-field__content"\s*>([\s\S]*?)<\/span>/g;

function cardFields(slice) {
  const fields = [];
  const re = new RegExp(contentRe.source, "g");
  let fm;
  while ((fm = re.exec(slice))) {
    const text = decode(stripTags(fm[1]));
    if (text) fields.push(text);
  }
  return fields;
}

const priceRe = /^([0-9۰-۹][0-9۰-۹,]*)$/;
const labeledRe = /^([^:]{1,40}?):\s*([0-9۰-۹][0-9۰-۹,]*)$/;
const calorieRe = /^([0-9۰-۹]+)\s*کالری$/;

const tomanOf = (raw) => {
  const n = Number(toLatinDigits(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

function parsePriceRows(rows) {
  const variants = [];
  let last = null;
  for (const row of rows) {
    const calories = row.match(calorieRe);
    if (calories) {
      if (last && last.calories == null) {
        last.calories = Number(toLatinDigits(calories[1]));
      } else {
        variants.push({ variantName: null, priceToman: null, calories: Number(toLatinDigits(calories[1])) });
        last = variants[variants.length - 1];
      }
      continue;
    }
    const labeled = row.match(labeledRe);
    if (labeled && !priceRe.test(row)) {
      const price = tomanOf(labeled[2]);
      variants.push({ variantName: decode(labeled[1]).trim(), priceToman: price, calories: null });
      last = variants[variants.length - 1];
      continue;
    }
    if (priceRe.test(row)) {
      variants.push({ variantName: null, priceToman: tomanOf(row), calories: null });
      last = variants[variants.length - 1];
      continue;
    }
    // Unrecognized row — record verbatim so validation can flag it.
    variants.push({ variantName: row, priceToman: null, calories: null });
    last = variants[variants.length - 1];
  }
  return variants.filter((v) => !(v.priceToman === null && v.variantName === null && v.calories === null));
}

const hasPersian = (s) => /[\u0600-\u06FF]/.test(s);
// An English name: contains no Persian letters, has at least one Latin
// letter, and is not a price/label/description row. Language-based, so
// accents (Éclair, Saint Honoré), ASCII commas and digits (V60) pass.
const isEnName = (s) =>
  !hasPersian(s) && /[A-Za-z]/.test(s) && !s.includes(":") && !priceRe.test(s);

const items = [];
const outliers = [];
for (let i = 0; i < itemIndexes.length; i++) {
  const start = itemIndexes[i];
  const end = itemIndexes[i + 1] ?? start + 40_000;
  const slice = html.slice(start, end);

  const imgMatch = slice.match(/<img[^>]*src="([^"]+)"/);
  const controlId = categoryForItem(start);
  const tab = controlId ? tabByControlId.get(controlId) : null;

  const fields = cardFields(slice);
  const sourceId = `lamiz-${(imgMatch?.[1] ?? "x").split("/").pop().replace(/\.[^.]+$/, "")}`;

  // Names: first field is Persian; second is English when it looks like one
  // (a non-name second field happens only if a card lacks an English name).
  let nameFa = fields[0] ?? "";
  let nameEn = null;
  let rest = fields.slice(1);
  if (rest.length > 0 && isEnName(rest[0])) {
    nameEn = rest[0];
    rest = rest.slice(1);
  }

  // Description row starts with "محتویات:"; anything after it is ignored.
  const descIdx = rest.findIndex((r) => r.startsWith("محتویات:"));
  let description = null;
  let rows = rest;
  if (descIdx >= 0) {
    description = rest[descIdx].slice("محتویات:".length).trim() || null;
    rows = rest.slice(0, descIdx);
  }

  const variants = parsePriceRows(rows);

  // Sanity: everything after names should have become rows (never a mystery field).
  const consumed =
    rows.length +
    (description != null ? 1 : 0);
  const problem =
    !nameFa ||
    nameFa.includes(":") ||
    !hasPersian(nameFa) ||
    variants.length === 0 ||
    consumed !== rest.length;
  if (problem) {
    outliers.push({ index: i, nameFa, nameEn, category: tab?.label ?? null, fields, sourceId });
  }

  items.push({
    sourceId,
    category: tab?.label ?? "نامشخص",
    nameFa,
    nameEn,
    description,
    imageUrl: imgMatch?.[1] ?? null,
    variants,
  });
}

/* ---------- write dataset ---------- */

const outputDir = join(here, "data");
mkdirSync(outputDir, { recursive: true });

const categories = [
  ...new Map(
    [...tabByControlId.entries()].map(([id, tab]) => [
      tab.label,
      { name: tab.label, imageUrl: tab.imageUrl },
    ]),
  ).values(),
];

const dataset = {
  source: "https://lamizcoffee.com/lamiz-coffee-menu/",
  exportedAt: new Date().toISOString(),
  note: "Prices as printed on the source page are in Toman. The app stores RIAL — multiply priceToman by 10 for basePrice.",
  categories,
  items,
};
writeFileSync(join(outputDir, "lamiz-menu.json"), JSON.stringify(dataset, null, 2));

/* ---------- validation report ---------- */

const noPrice = items.filter((it) => it.variants.length === 0);
const noImage = items.filter((it) => !it.imageUrl);
const noDesc = items.filter((it) => !it.description);
const multiVariant = items.filter((it) => it.variants.length > 1);
const noEnName = items.filter((it) => !it.nameEn);
const totalPrices = items.reduce((n, it) => n + it.variants.length, 0);

const nameCounts = new Map();
for (const it of items) {
  const key = `${it.category} :: ${it.nameFa}`;
  nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
}
const duplicateNames = [...nameCounts.entries()].filter(([, n]) => n > 1);

const badPrices = [];
for (const it of items) {
  for (const v of it.variants) {
    if (v.priceToman == null || !Number.isInteger(v.priceToman) || v.priceToman <= 0) badPrices.push(it);
  }
}
const nonStandardImages = items.filter((it) => it.imageUrl && !it.imageUrl.startsWith("https://lamizcoffee.com/"));

const lines = [];
lines.push(`# Validation report — Lamiz Coffee menu`);
lines.push(``);
lines.push(`Source: https://lamizcoffee.com/lamiz-coffee-menu/`);
lines.push(`Extracted at: ${dataset.exportedAt}`);
lines.push(``);
lines.push(`## Counts`);
lines.push(``);
lines.push(`| Metric | Value |`);
lines.push(`| --- | --- |`);
lines.push(`| Total categories | ${categories.length} |`);
lines.push(`| Total products (cards) | ${items.length} |`);
lines.push(`| Total price rows (variants) | ${totalPrices} |`);
lines.push(`| Total images | ${items.filter((it) => it.imageUrl).length} |`);
lines.push(`| Products without images | ${noImage.length} |`);
lines.push(`| Products without any price | ${noPrice.length} |`);
lines.push(`| Products with multiple variants | ${multiVariant.length} |`);
lines.push(`| Products without description | ${noDesc.length} |`);
lines.push(`| Products without English name | ${noEnName.length} |`);
lines.push(`| Cards failing structural parse | ${outliers.length} |`);
lines.push(``);
lines.push(`Per category:`);
lines.push(``);
for (const c of categories) {
  const rows = items.filter((it) => it.category === c.name);
  const prices = rows.reduce((n, it) => n + it.variants.length, 0);
  lines.push(`- ${c.name}: ${rows.length} products, ${prices} price rows`);
}
lines.push(``);
lines.push(`## Checks`);
lines.push(``);
lines.push(`- Duplicate category names: ${categories.length !== new Set(categories.map((c) => c.name)).size ? "YES" : "none"}`);
lines.push(`- Duplicate (category, fa-name) pairs: ${duplicateNames.length}`);
for (const [key, n] of duplicateNames) {
  lines.push(`  - ${key} (${n}×)`);
}
lines.push(`- Invalid/missing prices: ${badPrices.length}`);
for (const it of badPrices) {
  lines.push(`  - ${it.category} / ${it.nameFa}: ${JSON.stringify(it.variants)}`);
}
lines.push(`- Images outside lamizcoffee.com: ${nonStandardImages.length}`);
lines.push(`- Products without price: ${noPrice.length}`);
for (const it of noPrice) lines.push(`  - ${it.category} / ${it.nameFa} (${it.sourceId})`);
lines.push(`- Products without image: ${noImage.length}`);
for (const it of noImage) lines.push(`  - ${it.category} / ${it.nameFa}`);
lines.push(`- Products without description: ${noDesc.length}`);
for (const it of noDesc) lines.push(`  - ${it.category} / ${it.nameFa}`);
lines.push(`- Multi-variant products: ${multiVariant.length}`);
lines.push(`- Cards failing structural parse:`);
for (const o of outliers) {
  lines.push(`  - #${o.index} [${o.category ?? "?"}] ${o.nameFa}: ${JSON.stringify(o.fields)}`);
}
lines.push(`- Unnamed variants (single price, no size label): ${items.filter((it) => it.variants.some((v) => !v.variantName)).length}`);

const report = lines.join("\n");
writeFileSync(join(here, "validation.md"), report);
console.log(report);
