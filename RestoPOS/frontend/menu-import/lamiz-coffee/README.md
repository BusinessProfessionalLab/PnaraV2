# Lamiz Coffee menu import

Recreates the complete menu from https://lamizcoffee.com/lamiz-coffee-menu/
inside the store application (frontend in `src/`, backend reached through its
menu APIs).

## Pipeline

```
lamiz-coffee-menu.html  (saved from the live site, Elementor + JetEngine)
        │  extract.mjs (read-only parser)
        ▼
data/lamiz-menu.json    (13 categories · 165 products · 225 price rows — source of truth)
        │  import.mjs (idempotent, uses the app's menu APIs)
        ▼
Store backend            (create/update categories, items, modifiers, add-ons)
```

- `extract.mjs` — parses the saved HTML. Each product card is a sequence of
  `jet-listing-dynamic-field__content` spans (fa name → en name → price rows →
  optional `محتویات:` description); category comes from the enclosing
  JetTabs pane. Writes `data/lamiz-menu.json` + `validation.md`.
- `import.mjs` — maps the dataset onto the backend models and executes
  create/update through the existing endpoints. Idempotent: matches records by
  normalized Persian title within the target category and updates the first
  match instead of duplicating.

## Import decisions (confirmed with the store owner)

| Decision | Choice |
| --- | --- |
| Category mapping | Source tabs become top-level Persian categories. Existing `نوشیدنی گرم` / `نوشیدنی سرد` are matched and reused; the other 9 are created. |
| `منو خاموشی` (16 items) | Skipped — it is a power-outage promo list duplicating regular drinks at special prices. |
| Multi-price products (sizes/shots) | `basePrice` = cheapest row (RIAL = تومان × 10); each other row becomes a modifier surcharge priced as the difference (native POS "افزودنی" flow). Source rows are listed cheapest-first, so the first row is the base. |
| `تاپینگ‌ها` (20 items) | Imported as **shared add-ons** (`افزودنی` catalog, `extraPrice` = تومان × 10), attached to no item yet — staff attach them in the admin UI without guessing rules. |
| Images | New records use the original `lamizcoffee.com` image URLs; existing records keep their current image unless blank. |
| Ticket station | Drinks/cakes → `Bar`; `تست‌بار` and `ساندویچ کراسان` → `Kitchen`; tweakable per item later. |
| Prices/units | All site prices are تومان with thousands separators; converted to plain numbers and stored as RIAL (×10), matching every existing record (e.g. پرشین چیلو ۳,۲۸۸,۰۰۰). No rounding, no Persian digits in numeric fields. |

## Usage

```bash
# plan only (needs read access):
LAMIZ_TOKEN=<bearer> node import.mjs --dry-run

# execute:
LAMIZ_TOKEN=<bearer> node import.mjs --run

# or log in directly:
LAMIZ_USER=<userName> LAMIZ_PASS=<password> node import.mjs --run

# optional override:
LAMIZ_API_BASE=http://192.168.100.249:5000 node import.mjs --run
```

Writes `data/import-summary.json` with the executed counts.

## Known source quirks (see validation.md)

- 19 `تاپینگ‌ها` rows have no photo on the source (add-on rows) — imported
  without images.
- `چای لاهیجان` / `چای سیاه لمیز` print two identical `متوسط` rows (۱۲۸,۸۰۰ and
  ۱۴۸,۸۰۰). The cheaper row becomes the base price; the dearer row is the
  single `متوسط +۲۰,۰۰۰` modifier.
- Calorie labels (`۱۲۳ کالری`) are captured per variant in the dataset but are
  informational and not imported.
- The existing database already holds a partial import (49 items, collapsed to
  one price each, several duplicates, one junk record `کیر` in `افزودنی`).
  Matching items are upgraded with descriptions/EN names/modifiers; the
  duplicates and junk record are left untouched for manual cleanup.
