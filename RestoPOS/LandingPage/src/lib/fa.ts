/**
 * Formatting helpers shared by the product mockups on this site.
 *
 * These deliberately mirror the real application so what a visitor sees here is
 * what they get in the product:
 *   - amounts are stored in Rial and displayed in Toman (`amount / 10`)
 *   - Persian digits and the `٬` thousands separator, via `Intl` with `fa-IR`
 *
 * Source of truth: `frontend/src/lib/currency.ts`
 */

const faNumber = new Intl.NumberFormat('fa-IR');

/** Rial → Toman, formatted with Persian digits. Mirrors `formatToman()`. */
export function formatToman(rial: number, withUnit = true): string {
	const value = faNumber.format(Math.round(rial / 10));
	return withUnit ? `${value} تومان` : value;
}

/** Formats an already-Toman value (cash tendered, drawer counts). */
export function formatTomanAmount(toman: number, withUnit = true): string {
	const value = faNumber.format(Math.round(toman));
	return withUnit ? `${value} تومان` : value;
}

/** Persian-digit integer/quantity, no unit. */
export function fa(value: number): string {
	return faNumber.format(value);
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Persian digits with no grouping.
 *
 * Use this for anything that is a label rather than an amount — years, step
 * numbers, version parts. `fa()` runs through `Intl`, which correctly groups
 * amounts (`۱٬۲۳۴ تومان`) but turns a year into the nonsense `۲٬۰۲۶`.
 */
export function faDigits(value: number | string): string {
	return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]!);
}

/** Percent with Persian digits, e.g. `۱۲٪`. */
export function faPercent(value: number, digits = 0): string {
	const formatted = new Intl.NumberFormat('fa-IR', {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(value);
	return `${formatted}٪`;
}

/**
 * Shamsi (Jalali) date in the product's `yyyy/mm/dd` shape.
 *
 * Padding uses the Persian zero so single-digit months and days stay in one
 * numeral system — padding a Persian-digit string with an ASCII `0` produces a
 * mixed `0۵` that renders inconsistently around the slash.
 */
export function shamsiDate(jy: number, jm: number, jd: number): string {
	const pad = (n: number) => faDigits(n).padStart(2, '۰');
	return `${pad(jy)}/${pad(jm)}/${pad(jd)}`;
}
