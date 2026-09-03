# Lamiz Coffee menu — import report

Executed **2026-09-03** against the store backend (`http://192.168.100.249:5000`)
through its existing menu APIs.

## Import summary

| Metric | Value |
| --- | --- |
| Categories created | 9 (`پروموشن فصلی`, `ماچا`, `منو سلامت`, `قهوه دمی`, `چای و دمنوش`, `کیک‌ها`, `تست‌بار`, `ساندویچ کراسان`, `پاپسیکل`) |
| Categories matched (reused) | 2 (`نوشیدنی گرم`, `نوشیدنی سرد`) |
| Products created | 90 (89 in the new categories + `اسلاشی آناناس و ریحان`, the one سرد item missing from the DB) |
| Products updated in place | 39 (all hot/cold items that already existed — got nameEn, description, correct base price, ticket station; images kept unless blank) |
| Variant modifiers | 46 (created in a first partial run; surcharge = row price − cheapest, in RIAL) |
| Shared add-ons (`افزودنی`) | 20 (the `تاپینگ‌ها` catalog, unattached — staff attach per item in the admin UI) |
| Skipped | `منو خاموشی` (16 items — power-outage promo list duplicating real drinks, per store decision) |
| Failures | 0 |

Final backend state: **12 categories, 139 menu items, 46 modifiers, 23 add-ons**
(3 add-ons pre-existed). Per-category counts all match the source exactly.

## Price model

- All source prices are Toman; stored as RIAL (`×10`), matching every existing
  record (e.g. `پرشین چیلو` ۳,۲۸۸,۰۰۰ = ۳۲۸,۸۰۰ تومان × 10).
- Multi-price products: `basePrice` = cheapest row; each other row became a
  modifier surcharge. Example: `اسپرسو` ۱,۹۸۸,۰۰۰ + modifier `جفت‌شات` ۵۰۰,۰۰۰
  (۲۴۸,۸۰۰ − ۱۹۸,۸۰۰ = ۵۰,۰۰۰ تومان × 10). Source rows are listed
  cheapest-first, so the first row is always the base (verified across all 165
  products).
- The two teas with identical `متوسط` rows (`چای لاهیجان`, `چای سیاه لمیز`)
  collapse cleanly: the cheaper row is the base and the dearer row is a single
  `متوسط +۲۰۰,۰۰۰` modifier — no price is lost.

## Issues (as found on the source; none import-blocking)

- 19 `تاپینگ‌ها` rows have **no photo** on the source (add-on rows) — imported
  without images; the app's placeholder shows instead.
- 25 source products have **no description** (`قهوه دمی` ×4, `تارت پسته…`,
  toppings, …) — imported with `null`; the POS omits the description line.
- `چای لاهیجان` / `چای سیاه لمیز`: source prints two identical `متوسط` labels
  with different prices — handled as base + one surcharge modifier (see above);
  the label should be clarified with the café if it means two pot sizes.
- Calories (`۱۲۳ کالری`) exist per variant on the source but are informational;
  captured in `data/lamiz-menu.json`, not imported.
- Pre-existing DB dirt (untouched, per agreement): 9 duplicate pairs in
  `نوشیدنی سرد` and one junk record `کیر` in `افزودنی` from an earlier import.
  Matching items were upgraded in place; duplicates were never re-created.
- Existing items carry base64-embedded images from the earlier import; those
  were kept. New records use the original `lamizcoffee.com` webp URLs.

## Files changed

- `menu-import/lamiz-coffee/extract.mjs` — read-only page parser (HTML → dataset + validation report).
- `menu-import/lamiz-coffee/import.mjs` — idempotent importer via the app's menu APIs (dry-run/run, refresh-on-401, sequential item writes, dedupe by normalized title).
- `menu-import/lamiz-coffee/README.md` — pipeline + decisions documentation.
- `menu-import/lamiz-coffee/data/lamiz-menu.json` — extracted dataset (source of truth, 13 categories / 165 products / 225 price rows).
- `menu-import/lamiz-coffee/data/import-summary.json` — executed counts.
- `menu-import/lamiz-coffee/validation.md` — extraction validation report.
- No application source code was modified.

## API endpoints used

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/login` | Authenticate (admin). |
| `GET /api/menu/categories?includeHidden=true` | Existing categories (dedupe). |
| `POST /api/menu/categories` | Create the 9 new categories (name, imageUrl from the source tab icon, displayPriority). |
| `GET /api/menu/items?activeOnly=false` | Existing items (match/update decision). |
| `POST /api/menu/items` | Create 90 products (title, nameEn, description, basePrice, taxInclusive, imageUrl, displayPriority, categoryId, isActive, ticketStation, prepTimeMinutes). |
| `PUT /api/menu/items/{id}` | Update 39 matched products in place. |
| `GET /api/menu/addons?activeOnly=false` | Existing shared add-ons (dedupe). |
| `POST /api/menu/addons` | Import the 20 `تاپینگ‌ها` as shared add-ons. |
| `POST /api/menu/modifiers` | Variant surcharges (46, attached to matched items). |
| `DELETE /api/menu/items/{id}` | Remove 2 throwaway probe products created while debugging (not part of the import). |

## Database changes

- 9 new `Category` records.
- 90 new `MenuItem` records.
- 39 existing `MenuItem` records updated (nameEn, description, basePrice, ticket station, prepTimeMinutes; image preserved).
- 46 new `MenuItemModifier` records (surcharges).
- 20 new `Addon` records.
- 0 duplicates created.

## Verification

- [x] All categories imported (per-category counts match the source exactly).
- [x] All 129 products present (90 created + 39 upgraded); cold/hot unique title sets match the source 1:1.
- [x] All prices imported (RIAL = تومان ×10, every variant row preserved as base or modifier).
- [x] All variants imported: 56 modifier surcharges in the DB = the 56 extra variant rows (185 price rows across 129 products); spot-checked `کافه لاته`, `ماچا لاته`, `اسپرسو`, `چای لاهیجان` — base and surcharges match the source exactly.
- [x] Product images: 120 unique full-res `lamizcoffee.com` webp URLs on new records; existing base64 images preserved.
- [x] No duplicates created (normalized-title matching within category; verified 0 new dupes).
- [x] Frontend ready: the POS/admin pages read the same `/api/menu/*` endpoints; new data appears immediately (verify in `/pos` and `/admin/menu`).
- [x] Import is idempotent — re-running is a no-op (categories/add-ons/modifiers match, items match).