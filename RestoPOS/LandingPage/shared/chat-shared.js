/**
 * Shared chat helpers — single source of truth for validation rules.
 *
 * Used by the Astro widget (`src/components/chat/live-chat.ts`) and mirrored
 * inside `telegramworker/src/index.js` (which must stay a self-contained file
 * so the existing single-file dashboard deploy keeps working). Keep the two
 * copies in sync — `telegramworker/tests/chat/` parity tests assert it.
 *
 * Plain ESM with no dependencies so it runs in the browser, Workers, and Node.
 */

export const LIMITS = {
	NAME_MAX: 80,
	CAFE_MAX: 120,
	MESSAGE_MAX: 2000,
	BODY_MAX_BYTES: 32 * 1024,
};

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const faDigitMap = new Map([...FA_DIGITS].map((ch, i) => [ch, String(i)]));
const arDigitMap = new Map([...AR_DIGITS].map((ch, i) => [ch, String(i)]));

/** Convert Persian/Arabic-Indic digits to ASCII. Leaves everything else intact. */
export function normalizeDigits(value) {
	return String(value ?? "").replace(
		/[۰-۹٠-٩]/g,
		(ch) => faDigitMap.get(ch) ?? arDigitMap.get(ch) ?? ch,
	);
}

/**
 * Normalize an Iranian mobile number:
 * - converts fa/ar digits, strips spaces, dashes, parentheses
 * - converts +98 / 0098 / 98 prefixes to a leading 0
 */
export function normalizePhoneNumber(raw) {
	let v = normalizeDigits(raw ?? "").trim();
	v = v.replace(/[\s\-‐‑‒–—―()\[\]./]/g, "");
	if (v.startsWith("+98")) v = `0${v.slice(3)}`;
	else if (v.startsWith("0098")) v = `0${v.slice(4)}`;
	else if (/^98\d{10}$/.test(v)) v = `0${v.slice(2)}`;
	return v;
}

/** True when the value is an Iranian mobile number (09xxxxxxxxx). */
export function isValidIranMobile(raw) {
	return /^09\d{9}$/.test(normalizePhoneNumber(raw));
}

/**
 * Validate the onboarding form. Returns `{ ok, errors, value }` where `value`
 * holds trimmed + normalized fields when valid. `errors` maps field -> message
 * key (the widget maps keys to Persian text; the Worker returns the keys).
 */
export function validateOnboarding(input) {
	const errors = {};
	const firstName = String(input?.firstName ?? "").trim();
	const lastName = String(input?.lastName ?? "").trim();
	const cafeName = String(input?.cafeName ?? "").trim();
	const phoneRaw = String(input?.phone ?? "");
	const phone = normalizePhoneNumber(phoneRaw);

	if (!firstName) errors.firstName = "required";
	else if (firstName.length > LIMITS.NAME_MAX) errors.firstName = "too_long";

	if (!lastName) errors.lastName = "required";
	else if (lastName.length > LIMITS.NAME_MAX) errors.lastName = "too_long";

	if (!cafeName) errors.cafeName = "required";
	else if (cafeName.length > LIMITS.CAFE_MAX) errors.cafeName = "too_long";

	if (!phoneRaw.trim()) errors.phone = "required";
	else if (!isValidIranMobile(phoneRaw)) errors.phone = "invalid_mobile";

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		errors: {},
		value: { firstName, lastName, cafeName, phone },
	};
}

/** Validate a visitor/support message body. Returns `{ ok, error, value }`. */
export function validateMessageText(raw) {
	const value = String(raw ?? "").trim();
	if (!value) return { ok: false, error: "required" };
	if (value.length > LIMITS.MESSAGE_MAX)
		return { ok: false, error: "too_long" };
	return { ok: true, value };
}

/** Loose UUIDv4 check for client-provided idempotency keys. */
export function isValidClientMsgId(v) {
	return (
		typeof v === "string" && /^[0-9a-fA-F-]{8,64}$/.test(v) && v.length <= 64
	);
}

/**
 * Merge a freshly polled page into the local list, deduping by `id` and
 * `clientMsgId`, sorted ascending by `id`. Pure — safe to unit test.
 */
export function mergeMessages(existing, incoming) {
	const seen = new Set();
	for (const m of existing) {
		seen.add(`id:${m.id}`);
		if (m.clientMsgId) seen.add(`ck:${m.clientMsgId}`);
	}
	const out = [...existing];
	for (const m of incoming) {
		const dup =
			seen.has(`id:${m.id}`) ||
			(m.clientMsgId && seen.has(`ck:${m.clientMsgId}`));
		if (!dup) {
			out.push(m);
			seen.add(`id:${m.id}`);
			if (m.clientMsgId) seen.add(`ck:${m.clientMsgId}`);
		}
	}
	out.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
	return out;
}

/** Short conversation reference, e.g. conversation id hex -> `#A1B2C3`. */
export function shortRef(conversationId) {
	return `#${String(conversationId ?? "")
		.replace(/[^a-zA-Z0-9]/g, "")
		.slice(0, 6)
		.toUpperCase()
		.padEnd(6, "X")}`;
}

/**
 * Split message text into safe display tokens. Pure and DOM-free so the
 * widget and unit tests share it; the widget maps tokens to DOM nodes created
 * with `textContent` (never `innerHTML`).
 *
 * Token kinds:
 * - `{ kind: "link", text, href }` — http(s) URLs only, trailing punctuation
 *   (`.,;:!?)»«"'`) stripped from the href but kept as text.
 * - `{ kind: "phone", text }` — Iranian mobiles (09xxxxxxxxx, Persian digits
 *   included) rendered LTR for readability; `tel:` href built from the
 *   normalized ASCII form.
 * - `{ kind: "text", text }` — everything else.
 */
export function tokenizeMessage(raw) {
	const input = String(raw ?? "");
	const out = [];
	const urlRe = /https?:\/\/[^\s<>"'«»()[\]]+/g;
	const phoneRe = /[+]?(?:98|0098)?[0۰-۹٠-٩\s\-‐‑‒–—―()]{9,20}/g;

	// First pass: cut out URLs.
	const chunks = [];
	let last = 0;
	for (const m of input.matchAll(urlRe)) {
		const idx = m.index ?? 0;
		if (idx > last) chunks.push({ t: "text", s: input.slice(last, idx) });
		const url = m[0].replace(/[.,;:!?)"'»«\]]+$/, "");
		const trail = m[0].slice(url.length);
		if (/^https?:\/\//.test(url) && url.length > 10)
			chunks.push({ t: "link", s: url });
		else chunks.push({ t: "text", s: url });
		if (trail) chunks.push({ t: "text", s: trail });
		last = idx + m[0].length;
	}
	if (last < input.length) chunks.push({ t: "text", s: input.slice(last) });
	if (chunks.length === 0) chunks.push({ t: "text", s: input });

	// Second pass: find phone numbers inside plain-text chunks only.
	for (const c of chunks) {
		if (c.t !== "text") {
			out.push({ kind: "link", text: c.s, href: c.s });
			continue;
		}
		let l2 = 0;
		const matches = [...c.s.matchAll(phoneRe)];
		if (matches.length === 0) {
			out.push({ kind: "text", text: c.s });
			continue;
		}
		for (const m of matches) {
			const idx = m.index ?? 0;
			const cand = m[0];
			const digits = normalizeDigits(cand).replace(/\D/g, "");
			let norm = digits;
			if (norm.startsWith("0098")) norm = `0${norm.slice(4)}`;
			else if (norm.startsWith("98") && norm.length === 12)
				norm = `0${norm.slice(2)}`;
			const isMobile = /^09\d{9}$/.test(norm);
			if (idx > l2) out.push({ kind: "text", text: c.s.slice(l2, idx) });
			if (isMobile)
				out.push({ kind: "phone", text: cand, href: `tel:${norm}` });
			else out.push({ kind: "text", text: cand });
			l2 = idx + cand.length;
		}
		if (l2 < c.s.length) out.push({ kind: "text", text: c.s.slice(l2) });
	}
	return out.filter((t) => t.text !== "");
}
