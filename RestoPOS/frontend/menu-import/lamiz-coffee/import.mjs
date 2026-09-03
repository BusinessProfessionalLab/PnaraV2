#!/usr/bin/env node
/**
 * Lamiz Coffee menu — import into the store backend via its existing menu APIs.
 *
 * Reads data/lamiz-menu.json (produced by extract.mjs from the live page) and
 * creates/updates records on the backend the frontend already talks to.
 *
 * Import decisions (confirmed with the store owner):
 *   - Categories: keep the source tabs as top-level Persian categories.
 *     "نوشیدنی گرم"/"نوشیدنی سرد" already exist → matched, not re-created.
 *   - "منو خاموشی" (power-outage promo list duplicating real drinks) → SKIPPED.
 *   - Variants (sizes/shots): basePrice = cheapest row in RIAL (toman × 10);
 *     every other row becomes a ModifierDto surcharge = (row − base) × 10.
 *     Source rows are already ordered cheapest-first, so the first row is the base.
 *   - "تاپینگ‌ها" → shared add-ons (افزودنی catalog), extraPrice = toman × 10,
 *     attached to nothing (staff attach per item in the admin UI later).
 *   - Images: original lamizcoffee.com URLs for new records; existing records
 *     keep whatever image they already carry (only filled when blank).
 *   - Dedupe: normalized Persian title (ZWNJ + whitespace stripped) within the
 *     target category → update the first match; never create duplicates.
 *
 * Usage:
 *   LAMIZ_TOKEN=<bearer> node import.mjs --dry-run   # plan only, no writes
 *   LAMIZ_TOKEN=<bearer> node import.mjs --run       # execute
 *   # or login directly:
 *   LAMIZ_USER=<u> LAMIZ_PASS=<p> node import.mjs --run
 *   LAMIZ_API_BASE=http://host:5000                  # optional, defaults below
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(
  readFileSync(join(here, "data", "lamiz-menu.json"), "utf8"),
);

const BASE = process.env.LAMIZ_API_BASE ?? "http://192.168.100.249:5000";
const RUN = process.argv.includes("--run");
const DRY = !RUN;

/* ------------------------------ helpers ------------------------------ */

// Zero-width / direction / BOM marks are copy artifacts from the web page
// (e.g. "شکلات گرم\u200b") — strip them so titles compare cleanly.
const norm = (s) =>
  (s ?? "")
    .normalize("NFC")
    .replace(/[\u200b-\u200f\ufeff\s]/g, "")
    .toLowerCase();

const RIAL = (toman) => toman * 10;

const STATION_BY_CATEGORY = new Map([
  ["نوشیدنی گرم", "Bar"],
  ["نوشیدنی سرد", "Bar"],
  ["پروموشن فصلی", "Bar"],
  ["ماچا", "Bar"],
  ["منو سلامت", "Bar"],
  ["قهوه دمی", "Bar"],
  ["چای و دمنوش", "Bar"],
  ["کیک‌ها", "Bar"],
  ["تست‌بار", "Kitchen"],
  ["ساندویچ کراسان", "Kitchen"],
  ["پاپسیکل", "Bar"],
  ["تاپینگ‌ها", "Bar"],
]);

// Display order follows the source tab order (index in this list). Existing
// DB priorities: نوشیدنی گرم = 5, نوشیدنی سرد = 6 (kept as-is); new
// categories get spaced priorities after them.
const TAB_ORDER = [
  "نوشیدنی گرم",
  "نوشیدنی سرد",
  "پروموشن فصلی",
  "ماچا",
  "منو سلامت",
  "قهوه دمی",
  "چای و دمنوش",
  "منو خاموشی", // skipped
  "کیک‌ها",
  "تست‌بار",
  "ساندویچ کراسان",
  "پاپسیکل",
  "تاپینگ‌ها", // add-ons
];
const SKIP_CATEGORIES = new Set(["منو خاموشی"]);
const TOPPINGS_CATEGORY = "تاپینگ‌ها";

/* ------------------------------- auth -------------------------------- */

let accessToken = process.env.LAMIZ_TOKEN ?? null;
let refreshToken = process.env.LAMIZ_REFRESH_TOKEN ?? null;

async function rawFetch(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, text };
}

async function api(path, { method = "GET", body, token = accessToken } = {}) {
  const attempt = async (tok, triesLeft) => {
    const { res, data, text } = await rawFetch(path, { method, body, token: tok });
    if (res.ok) return data;
    // Access token revoked by the app's session rotation → refresh once.
    if (res.status === 401 && refreshToken && triesLeft > 0) {
      try {
        const { res: rr, data: rd } = await rawFetch("/api/auth/refresh", {
          method: "POST",
          body: { refreshToken },
        });
        if (rr.ok && rd?.accessToken) {
          accessToken = rd.accessToken;
          if (rd.refreshToken) refreshToken = rd.refreshToken;
          return attempt(accessToken, 0);
        }
      } catch {
        /* fall through to the 401 error below */
      }
    }
    // Transient server errors (e.g. DB write lock) → one sequential retry.
    if (res.status >= 500 && triesLeft > 0) {
      await new Promise((r) => setTimeout(r, 400));
      return attempt(tok, 0);
    }
    const msg =
      data && typeof data === "object"
        ? data.detail || data.title || JSON.stringify(data).slice(0, 300)
        : text.slice(0, 300);
    throw new Error(`HTTP ${res.status} ${method} ${path}: ${msg}`);
  };
  return attempt(token, 1);
}

async function authenticate() {
  if (process.env.LAMIZ_TOKEN) return process.env.LAMIZ_TOKEN;
  const user = process.env.LAMIZ_USER;
  const pass = process.env.LAMIZ_PASS;
  if (!user || !pass) {
    console.error(
      "No credentials. Set LAMIZ_TOKEN, or LAMIZ_USER + LAMIZ_PASS.",
    );
    process.exit(2);
  }
  const auth = await api("/api/auth/login", {
    method: "POST",
    body: { userName: user, password: pass },
  });
  accessToken = auth.accessToken;
  if (auth.refreshToken) refreshToken = auth.refreshToken;
  return auth.accessToken;
}

/* --------------------------- fetch current --------------------------- */

async function fetchState(token) {
  const [categories, items, addons] = await Promise.all([
    api("/api/menu/categories?includeHidden=true", { token }),
    api("/api/menu/items?activeOnly=false", { token }),
    api("/api/menu/addons?activeOnly=false", { token }),
  ]);
  return { categories, items, addons };
}

/* ------------------------------ mapping ------------------------------ */

function categoryPlan(dataset, existingCategories) {
  const existingByName = new Map(existingCategories.map((c) => [norm(c.name), c]));
  const plan = [];
  let nextPriority = 10;
  for (const name of TAB_ORDER) {
    if (SKIP_CATEGORIES.has(name) || name === TOPPINGS_CATEGORY) continue;
    const found = existingByName.get(norm(name));
    plan.push(
      found
        ? { name, kind: "existing", id: found.id, priority: found.displayPriority }
        : { name, kind: "create", priority: nextPriority },
    );
    if (!found) nextPriority += 10;
  }
  return plan;
}

function buildItemPlans(dataset, state, catById) {
  // One entry per source product (excl. skipped + toppings). Existing items
  // are bucketed by their category NAME (each item carries categoryName), so
  // matching never depends on category-id bookkeeping.
  const existingByCatName = new Map();
  for (const item of state.items) {
    const key = norm(item.categoryName);
    if (!existingByCatName.has(key)) existingByCatName.set(key, []);
    existingByCatName.get(key).push(item);
  }
  const plans = { create: [], update: [], createModifier: [], updateModifier: [] };
  for (const src of dataset.items) {
    if (SKIP_CATEGORIES.has(src.category) || src.category === TOPPINGS_CATEGORY) continue;
    const cat = catById.get(src.category);
    if (!cat) throw new Error(`No category mapping for ${src.category}`);
    const base = src.variants[0]; // source lists cheapest first (verified)
    const extra = src.variants.slice(1);
    const title = src.nameFa.trim();
    const station = STATION_BY_CATEGORY.get(src.category) ?? "Bar";
    const payload = {
      title,
      nameEn: src.nameEn,
      description: src.description,
      basePrice: RIAL(base.priceToman),
      taxInclusive: false,
      displayPriority: 0, // fixed after match/create decision
      categoryId: cat, // catById maps category-name → category-id
      isActive: true,
      ticketStation: station,
      prepTimeMinutes: 4,
    };
    const existing = (existingByCatName.get(norm(src.category)) ?? []).find(
      (e) => norm(e.title) === norm(title),
    );
    if (process.env.LAMIZ_DEBUG && !existing) {
      console.error(
        "NO-MATCH",
        JSON.stringify({
          title,
          normTitle: norm(title),
          catName: src.category,
          bucket: (existingByCatName.get(norm(src.category)) ?? []).slice(0, 4).map((e) => ({ t: e.title, n: norm(e.title) })),
        }),
      );
    }
    if (existing) {
      const prior = {
        id: existing.id,
        ...payload,
        displayPriority: existing.displayPriority,
        imageUrl: existing.imageUrl ?? src.imageUrl,
      };
      plans.update.push({ src, prior });
      planModifiers(plans, existing, extra, base, station);
    } else {
      plans.create.push({ src, payload, extra, station });
    }
  }
  return plans;
}

function planModifiers(plans, existingItem, extra, base, station) {
  const existingMods = new Map(
    (existingItem.modifiers ?? []).map((m) => [norm(m.name), m]),
  );
  for (const v of extra) {
    const extraPrice = RIAL(v.priceToman - base.priceToman);
    const match = existingMods.get(norm(v.variantName));
    if (match) {
      if (match.extraPrice !== extraPrice) {
        plans.updateModifier.push({
          id: match.id,
          menuItemId: existingItem.id,
          name: v.variantName,
          extraPrice,
          isActive: true,
          ticketStation: match.ticketStation || station,
          displayPriority: match.displayPriority,
        });
      }
    } else {
      plans.createModifier.push({
        menuItemId: existingItem.id,
        name: v.variantName,
        extraPrice,
        isActive: true,
        ticketStation: station,
        displayPriority: 0,
      });
    }
  }
}

function buildAddonPlans(dataset, state) {
  const existingByName = new Map(state.addons.map((a) => [norm(a.name), a]));
  const plans = { create: [], update: [] };
  const toppings = dataset.items.filter((i) => i.category === TOPPINGS_CATEGORY);
  let priority = 0;
  for (const t of toppings) {
    const addon = {
      name: t.nameFa.trim(),
      extraPrice: RIAL(t.variants[0].priceToman),
      isActive: true,
      ticketStation: "Bar",
      displayPriority: priority++,
    };
    const match = existingByName.get(norm(addon.name));
    if (match) {
      if (match.extraPrice !== addon.extraPrice) plans.update.push({ id: match.id, ...addon });
    } else {
      plans.create.push(addon);
    }
  }
  return plans;
}

/* ------------------------------ execute ------------------------------ */

async function pool(items, worker, concurrency = 4) {
  const results = [];
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results.push({ ok: true, value: await worker(items[i], i) });
      } catch (err) {
        results.push({ ok: false, error: err, item: items[i] });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, run));
  return results;
}

const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19);

async function run() {
  console.log(`${stamp()}  Lamiz import → ${BASE}  [${DRY ? "DRY-RUN" : "RUN"}]`);
  const token = await authenticate();
  const state = await fetchState(token);

  /* categories */
  const cats = categoryPlan(dataset, state.categories);
  const createdCats = [];
  for (const c of cats) {
    if (c.kind === "existing") continue;
    if (DRY) {
      createdCats.push({ id: `dry-${c.name}`, ...c });
      continue;
    }
    const tab = dataset.categories.find((x) => x.name === c.name);
    const id = await api("/api/menu/categories", {
      method: "POST",
      token,
      body: {
        name: c.name,
        nameEn: null,
        displayPriority: c.priority,
        isVisible: true,
        iconUrl: null,
        imageUrl: tab?.imageUrl ?? null,
        parentId: null,
      },
    });
    createdCats.push({ id, name: c.name, kind: "created" });
    console.log(`${stamp()}  created category  ${c.name} → ${id}`);
  }

  const catById = new Map();
  for (const c of [...state.categories, ...createdCats]) catById.set(c.name, c.id);

  /* items + modifiers + add-ons */
  const plans = buildItemPlans(dataset, state, catById);
  const addons = buildAddonPlans(dataset, state);
  if (process.env.LAMIZ_DEBUG) {
    console.error(
      "PLANS",
      JSON.stringify({
        update: plans.update.map((p) => `${p.prior.title}@${p.prior.categoryId}`),
        createCount: plans.create.length,
        createSample: plans.create.slice(0, 3).map((p) => p.payload.title),
        catNames: [...catById.keys()],
        stateCatIds: state.categories.map((c) => `${c.name}:${c.id}`),
        stateItemCats: [...new Set(state.items.map((i) => i.categoryId))],
      }),
    );
  }

  const createdItems = [];
  let itemsCreated = 0;
  let itemsUpdated = 0;
  const prioNext = new Map();
  const poolSize = 4;

  const createItem = async (p) => {
    const { src, extra, station, payload } = p;
    if (!prioNext.has(payload.categoryId)) {
      const max = Math.max(
        -1,
        ...state.items
          .filter((i) => i.categoryId === payload.categoryId)
          .map((i) => i.displayPriority ?? 0),
      );
      prioNext.set(payload.categoryId, max + 1);
    }
    const priority = prioNext.get(payload.categoryId) ?? 0;
    prioNext.set(payload.categoryId, priority + 1);
    const body = { ...payload, displayPriority: priority, imageUrl: src.imageUrl };
    if (process.env.LAMIZ_DEBUG) {
      console.error(`BODY-POST ${body.title} → ${JSON.stringify(body)}`);
    }
    if (DRY) {
      console.log(`${stamp()}  [dry] create item  ${body.title}  (${src.category})`);
      return { id: `dry-${body.title}`, extra, station };
    }
    const id = await api("/api/menu/items", { method: "POST", token, body });
    for (const v of extra) {
      await api("/api/menu/modifiers", {
        method: "POST",
        token,
        body: {
          menuItemId: id,
          name: v.variantName,
          extraPrice: RIAL(v.priceToman - src.variants[0].priceToman),
          isActive: true,
          ticketStation: station,
          displayPriority: 0,
        },
      });
    }
    console.log(`${stamp()}  created item  ${body.title} (+${extra.length} mods) → ${id}`);
    return { id };
  };

  const updateItem = async (p) => {
    const { src, prior } = p;
    const body = { ...prior, imageUrl: prior.imageUrl ?? src.imageUrl };
    if (process.env.LAMIZ_DEBUG) {
      console.error(`BODY-PUT ${body.title} → ${JSON.stringify(body)}`);
    }
    if (DRY) {
      console.log(`${stamp()}  [dry] update item  ${body.title}`);
      return;
    }
    await api(`/api/menu/items/${prior.id}`, { method: "PUT", token, body: { ...body, id: prior.id } });
    console.log(`${stamp()}  updated item  ${body.title}  (${prior.id})`);
  };

  const createModifier = async (p) => {
    if (DRY) return;
    await api("/api/menu/modifiers", { method: "POST", token, body: p });
  };
  const updateModifier = async (p) => {
    if (DRY) return;
    await api(`/api/menu/modifiers/${p.id}`, { method: "PUT", token, body: p });
  };
  const createAddon = async (p) => {
    if (DRY) return;
    await api("/api/menu/addons", { method: "POST", token, body: p });
  };
  const updateAddon = async (p) => {
    if (DRY) return;
    await api(`/api/menu/addons/${p.id}`, { method: "PUT", token, body: p });
  };

  // Item writes run sequentially: the backend's DB rejected concurrent
  // writes (all 39 updates 500'd together under 4-way concurrency).
  const r1 = await pool(plans.create, createItem, 1);
  const r2 = await pool(plans.update, updateItem, 1);
  const r3 = await pool(plans.createModifier, createModifier, poolSize);
  const r4 = await pool(plans.updateModifier, updateModifier, poolSize);
  const r5 = await pool(addons.create, createAddon, poolSize);
  const r6 = await pool(addons.update, updateAddon, poolSize);

  const fail = (r) => r.filter((x) => !x.ok);
  const failed = [
    ...fail(r1),
    ...fail(r2),
    ...fail(r3),
    ...fail(r4),
    ...fail(r5),
    ...fail(r6),
  ];

  /* summary */
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: DRY ? "dry-run" : "executed",
    baseUrl: BASE,
    categoriesCreated: cats.filter((c) => c.kind === "create").length,
    categoriesMatched: cats.filter((c) => c.kind === "existing").length,
    itemsCreated: plans.create.length,
    itemsUpdated: plans.update.length,
    modifiersCreated: plans.createModifier.length,
    modifiersUpdated: plans.updateModifier.length,
    addonsCreated: addons.create.length,
    addonsUpdated: addons.update.length,
    skippedCategory: "منو خاموشی (16 items)",
    failures: failed.length,
  };
  console.log("\n" + JSON.stringify(summary, null, 2));
  writeFileSync(join(here, "data", "import-summary.json"), JSON.stringify(summary, null, 2));

  for (const f of failed) {
    console.error(
      `FAIL: ${f.error.message}\n  → ${JSON.stringify(f.item?.src?.nameFa ?? f.item?.name ?? f.item ?? "").slice(0, 200)}`,
    );
  }
  if (failed.length > 0) process.exitCode = 1;
}

/* Run only when executed directly (keeps the module importable for tests). */
import { pathToFileURL } from "node:url";
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  run().catch((err) => {
    console.error(`Aborted: ${err.message}`);
    process.exit(1);
  });
}

export { norm, categoryPlan, buildItemPlans, buildAddonPlans, api, authenticate };
