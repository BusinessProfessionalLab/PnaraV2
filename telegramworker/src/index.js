/**
 * Pnara live-chat Cloudflare Worker (canonical location: telegramworker/src/index.js).
 *
 * Two responsibilities, one bot, one webhook:
 *
 *  1. LEGACY contact/demo form  (POST /) — preserved behavior. Reads the demo
 *     request payload, validates it, and forwards it to Telegram. Do not change
 *     its request/response shapes.
 *  2. LIVE CHAT API (/api/chat/*) + Telegram webhook (/api/telegram/webhook).
 *
 * Storage: Cloudflare D1 (binding `DB`). Tables are created defensively with
 * `CREATE TABLE IF NOT EXISTS` so local dev works even before the migration in
 * `migrations/0001_chat_init.sql` has been applied; run the migration for
 * production. No in-memory object is used as a message store.
 *
 * Secrets / config (set via `wrangler secret put` or `.dev.vars`, see
 * `wrangler.jsonc` + `RestoPOS/LandingPage/docs/LIVE_CHAT.md`):
 *   TELEGRAM_BOT_TOKEN          bot token (falls back to the legacy embedded
 *                               token until rotated — see MIGRATION note below)
 *   CONTACT_TELEGRAM_CHAT_IDS   comma-separated, legacy demo-form recipients
 *   SUPPORT_GROUP_ID            Telegram chat id of the support group
 *   TELEGRAM_WEBHOOK_SECRET     verified via X-Telegram-Bot-Api-Secret-Token
 *   SUPPORT_USER_IDS            comma-separated Telegram user ids allowed to
 *                               reply as support (empty = any support-group
 *                               member; configure in production)
 *   ALLOWED_ORIGINS             comma-separated override for the site origins
 *
 * MIGRATION note: the legacy bot token and demo-form chat ids below are the
 * values this file shipped with. They remain as fallbacks so the current
 * deployment keeps working while secrets are being moved. After setting the
 * secrets, redeploy and then delete the fallback literals.
 */

// ---------------------------------------------------------------------------
// Legacy configuration (preserved behavior)
// ---------------------------------------------------------------------------
const DEFAULT_ALLOWED_ORIGINS = ["https://www.pnara.ir", "https://pnara.ir"];
const LEGACY_FALLBACK_BOT_TOKEN =
	"8941267317:AAE8zGtONM3er3ZauGza0yq1m04nzE0tHxs";
const LEGACY_FALLBACK_CHAT_IDS = "1304766783,101717055,1838113372,1441904706";

const SUBJECTS = {
	demo: "درخواست دمو",
	hardware: "پیش‌نیاز سخت‌افزار و راه‌اندازی",
	pricing: "قیمت و شرایط خرید",
	support: "پشتیبانی و رفع اشکال",
	other: "موضوع دیگر",
};

// ---------------------------------------------------------------------------
// Chat configuration
// ---------------------------------------------------------------------------
const VISITOR_COOKIE = "pnara_visitor";
const CHAT_POLL_DEFAULT_LIMIT = 50;
const CHAT_HISTORY_LIMIT = 50;
const BODY_MAX_BYTES = 32 * 1024;
const MESSAGE_MAX = 2000;
const NAME_MAX = 80;
const CAFE_MAX = 120;
const TELEGRAM_TEXT_LIMIT = 4000;

const RATE_LIMITS = {
	session: { limit: 20, windowMs: 60_000 },
	poll: { limit: 60, windowMs: 60_000 },
	send: { limit: 15, windowMs: 60_000 },
	webhook: { limit: 120, windowMs: 60_000 },
	legacy: { limit: 30, windowMs: 60_000 },
};

// ---------------------------------------------------------------------------
// Shared validation (mirrors shared/chat-shared.js — keep in sync)
// ---------------------------------------------------------------------------
export function normalizeDigits(value) {
	return String(value ?? "").replace(/[۰-۹٠-٩]/g, (ch) => {
		const code = ch.charCodeAt(0);
		if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0); // fa
		if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660); // ar
		return ch;
	});
}

export function normalizePhoneNumber(raw) {
	let v = normalizeDigits(raw ?? "").trim();
	v = v.replace(/[\s\-‐‑‒–—―()[\].]/g, "");
	if (v.startsWith("+98")) v = `0${v.slice(3)}`;
	else if (v.startsWith("0098")) v = `0${v.slice(4)}`;
	else if (/^98\d{10}$/.test(v)) v = `0${v.slice(2)}`;
	return v;
}

export function isValidIranMobile(raw) {
	return /^09\d{9}$/.test(normalizePhoneNumber(raw));
}

export function validateOnboarding(input) {
	const errors = {};
	const firstName = String(input?.firstName ?? "").trim();
	const lastName = String(input?.lastName ?? "").trim();
	const cafeName = String(input?.cafeName ?? "").trim();
	const phoneRaw = String(input?.phone ?? "");
	const phone = normalizePhoneNumber(phoneRaw);
	if (!firstName) errors.firstName = "required";
	else if (firstName.length > NAME_MAX) errors.firstName = "too_long";
	if (!lastName) errors.lastName = "required";
	else if (lastName.length > NAME_MAX) errors.lastName = "too_long";
	if (!cafeName) errors.cafeName = "required";
	else if (cafeName.length > CAFE_MAX) errors.cafeName = "too_long";
	if (!phoneRaw.trim()) errors.phone = "required";
	else if (!isValidIranMobile(phoneRaw)) errors.phone = "invalid_mobile";
	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		errors: {},
		value: { firstName, lastName, cafeName, phone },
	};
}

export function validateMessageText(raw) {
	const value = String(raw ?? "").trim();
	if (!value) return { ok: false, error: "required" };
	if (value.length > MESSAGE_MAX) return { ok: false, error: "too_long" };
	return { ok: true, value };
}

export function shortRef(conversationId) {
	return `#${String(conversationId ?? "")
		.replace(/[^a-zA-Z0-9]/g, "")
		.slice(0, 6)
		.toUpperCase()
		.padEnd(6, "X")}`;
}

export function isValidClientMsgId(v) {
	return (
		typeof v === "string" && /^[0-9a-fA-F-]{8,64}$/.test(v) && v.length <= 64
	);
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
export function __resetRateLimits() {
	rateBuckets.clear();
}

const rateBuckets = new Map();

function checkRateLimit(key, { limit, windowMs }) {
	const now = Date.now();
	const bucket = rateBuckets.get(key) || [];
	const fresh = bucket.filter((t) => now - t < windowMs);
	if (fresh.length >= limit) {
		rateBuckets.set(key, fresh);
		return {
			allowed: false,
			retryAfterSec: Math.ceil((fresh[0] + windowMs - now) / 1000),
		};
	}
	fresh.push(now);
	rateBuckets.set(key, fresh);
	return { allowed: true, retryAfterSec: 0 };
}

function clientIp(request) {
	return (
		request.headers.get("CF-Connecting-IP") ||
		(request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() ||
		"unknown"
	);
}

function getAllowedOrigins(env) {
	const raw = env?.ALLOWED_ORIGINS;
	if (typeof raw === "string" && raw.trim()) {
		return raw
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}
	return DEFAULT_ALLOWED_ORIGINS;
}

function isAllowedOrigin(origin, env) {
	if (!origin) return false;
	const allowed = getAllowedOrigins(env);
	if (allowed.includes(origin)) return true;
	// Local development convenience (documented): allow the Astro dev server.
	if (isLocalDevOrigin(origin)) return true;
	return false;
}

function isLocalDevOrigin(origin) {
	try {
		const u = new URL(origin);
		const host = u.hostname;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]")
			return true;
		return false;
	} catch {
		return false;
	}
}

function corsHeaders(origin, env, withCredentials) {
	const allowed = getAllowedOrigins(env);
	let allowOrigin = allowed[0];
	if (origin && (allowed.includes(origin) || isLocalDevOrigin(origin)))
		allowOrigin = origin;
	const headers = {
		"Access-Control-Allow-Origin": allowOrigin,
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers":
			"Content-Type, Authorization, X-Visitor-Token",
		"Access-Control-Max-Age": "86400",
	};
	if (withCredentials) headers["Access-Control-Allow-Credentials"] = "true";
	return headers;
}

function json(data, status, origin, env, withCredentials) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json; charset=UTF-8",
			...corsHeaders(origin, env, withCredentials),
		},
	});
}

function escapeTelegram(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function getBotToken(env) {
	const v = env?.TELEGRAM_BOT_TOKEN;
	if (typeof v === "string" && v.trim()) return v.trim();
	return LEGACY_FALLBACK_BOT_TOKEN;
}

function getContactChatIds(env) {
	const raw = env?.CONTACT_TELEGRAM_CHAT_IDS;
	const src =
		typeof raw === "string" && raw.trim() ? raw : LEGACY_FALLBACK_CHAT_IDS;
	return src
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
}

function getSupportGroupId(env) {
	const v = env?.SUPPORT_GROUP_ID;
	return typeof v === "string" && v.trim() ? v.trim() : "";
}

function getSupportUserIds(env) {
	const raw = env?.SUPPORT_USER_IDS;
	if (typeof raw !== "string" || !raw.trim()) return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function timingSafeEqual(a, b) {
	const x = String(a ?? "");
	const y = String(b ?? "");
	if (x.length !== y.length) return false;
	let diff = 0;
	for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
	return diff === 0;
}

function randomHex(bytes) {
	const buf = new Uint8Array(bytes);
	crypto.getRandomValues(buf);
	return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function nowIso() {
	return new Date().toISOString();
}

function newVisitorToken() {
	return randomHex(32);
}

function isWellFormedToken(t) {
	return typeof t === "string" && /^[0-9a-f]{64}$/i.test(t);
}

function extractVisitorToken(request) {
	const cookie = request.headers.get("Cookie") || "";
	const m = cookie.match(/(?:^|;\s*)pnara_visitor=([^;]+)/);
	if (m) {
		try {
			const v = decodeURIComponent(m[1].trim());
			if (isWellFormedToken(v)) return v;
		} catch {
			// ignore malformed cookie
		}
	}
	const header = (request.headers.get("X-Visitor-Token") || "").trim();
	if (isWellFormedToken(header)) return header;
	const auth = (request.headers.get("Authorization") || "").trim();
	const bm = auth.match(/^Bearer\s+(.+)$/i);
	if (bm && isWellFormedToken(bm[1].trim())) return bm[1].trim();
	return "";
}

function visitorCookieHeader(token, request) {
	const secure = new URL(request.url).protocol === "https:";
	const parts = [
		`${VISITOR_COOKIE}=${encodeURIComponent(token)}`,
		"Path=/",
		"Max-Age=31536000",
		"HttpOnly",
		"SameSite=Lax",
	];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

function withVisitorCookie(response, token, request) {
	const headers = new Headers(response.headers);
	headers.append("Set-Cookie", visitorCookieHeader(token, request));
	return new Response(response.body, { status: response.status, headers });
}

async function readJsonBody(request) {
	try {
		const text = await request.text();
		if (new TextEncoder().encode(text).length > BODY_MAX_BYTES) {
			return { ok: false, error: "body_too_large", value: null };
		}
		if (!text.trim()) return { ok: true, value: {} };
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false, error: "invalid_json", value: null };
	}
}

// ---------------------------------------------------------------------------
// D1 schema + data access (parameterized queries only)
// ---------------------------------------------------------------------------
async function ensureSchema(db) {
	const stmts = [
		`CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      cafe_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
		`CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      short_ref TEXT UNIQUE NOT NULL,
      visitor_id TEXT NOT NULL REFERENCES visitors(id),
      status TEXT NOT NULL DEFAULT 'open',
      telegram_anchor_chat_id TEXT,
      telegram_anchor_message_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_message_at TEXT,
      closed_at TEXT
    )`,
		`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      sender TEXT NOT NULL,
      sender_name TEXT,
      text TEXT NOT NULL,
      client_msg_id TEXT UNIQUE,
      telegram_message_id INTEGER,
      delivery_status TEXT NOT NULL DEFAULT 'sent',
      created_at TEXT NOT NULL
    )`,
		`CREATE TABLE IF NOT EXISTS telegram_message_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      telegram_chat_id TEXT NOT NULL,
      telegram_message_id INTEGER NOT NULL,
      direction TEXT NOT NULL,
      internal_message_id INTEGER,
      created_at TEXT NOT NULL,
      UNIQUE (telegram_chat_id, telegram_message_id)
    )`,
		`CREATE TABLE IF NOT EXISTS telegram_updates (
      update_id INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      processed_at TEXT NOT NULL
    )`,
		"CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, id)",
		"CREATE INDEX IF NOT EXISTS idx_conv_visitor ON conversations (visitor_id)",
		"CREATE INDEX IF NOT EXISTS idx_visitors_token ON visitors (token_hash)",
	];
	for (const sql of stmts) await db.prepare(sql).run();
}

function publicMessage(row) {
	return {
		id: row.id,
		sender: row.sender,
		senderName: row.sender_name ?? null,
		text: row.text,
		clientMsgId: row.client_msg_id ?? null,
		createdAt: row.created_at,
	};
}

function publicConversation(conv) {
	if (!conv) return null;
	return {
		id: conv.id,
		shortRef: shortRef(conv.id),
		status: conv.status,
		updatedAt: conv.updated_at,
	};
}

function publicVisitor(v) {
	if (!v) return null;
	return {
		firstName: v.first_name,
		lastName: v.last_name,
		cafeName: v.cafe_name,
		phone: v.phone,
	};
}

async function findVisitorByToken(db, token) {
	const hash = await sha256Hex(token);
	return db
		.prepare("SELECT * FROM visitors WHERE token_hash = ?")
		.bind(hash)
		.first();
}

async function findOpenConversation(db, visitorId) {
	return db
		.prepare(
			"SELECT * FROM conversations WHERE visitor_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1",
		)
		.bind(visitorId)
		.first();
}

async function findLatestConversation(db, visitorId) {
	return db
		.prepare(
			"SELECT * FROM conversations WHERE visitor_id = ? ORDER BY created_at DESC LIMIT 1",
		)
		.bind(visitorId)
		.first();
}

async function createConversation(db, visitorId) {
	for (let attempt = 0; attempt < 3; attempt++) {
		const id = randomHex(16);
		const t = nowIso();
		try {
			await db
				.prepare(
					"INSERT INTO conversations (id, short_ref, visitor_id, status, created_at, updated_at, last_message_at) VALUES (?, ?, ?, 'open', ?, ?, ?)",
				)
				.bind(id, shortRef(id), visitorId, t, t, t)
				.run();
			return db
				.prepare("SELECT * FROM conversations WHERE id = ?")
				.bind(id)
				.first();
		} catch (e) {
			if (attempt === 2) throw e;
		}
	}
	return null;
}

async function recentMessages(db, conversationId, limit) {
	const res = await db
		.prepare(
			"SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
		)
		.bind(conversationId, limit)
		.all();
	const rows = (res.results || []).slice().reverse();
	return rows.map(publicMessage);
}

async function messagesAfter(db, conversationId, after, limit) {
	const res = await db
		.prepare(
			"SELECT * FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC LIMIT ?",
		)
		.bind(conversationId, after, limit)
		.all();
	return (res.results || []).map(publicMessage);
}

// ---------------------------------------------------------------------------
// Telegram API
// ---------------------------------------------------------------------------
async function telegramSend(env, chatId, text, replyToMessageId) {
	const token = getBotToken(env);
	const url = `https://api.telegram.org/bot${token}/sendMessage`;
	const body = { chat_id: chatId, text: text.slice(0, TELEGRAM_TEXT_LIMIT) };
	if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
	let response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	} catch (e) {
		throw new Error(`Telegram network error: ${e?.message || e}`);
	}
	let result = null;
	try {
		result = await response.json();
	} catch {
		throw new Error(`Telegram non-JSON response (status ${response.status})`);
	}
	if (!response.ok || !result || result.ok !== true) {
		const desc =
			result?.description ||
			`Telegram request failed (status ${response.status})`;
		const err = new Error(desc);
		err.telegramStatus = response.status;
		err.telegramRetryAfter = result?.parameters?.retry_after;
		throw err;
	}
	return result.result || {};
}

function newConversationNotice(visitor, short) {
	return [
		"🆕 گفتگوی جدید وب‌سایت",
		"",
		`گفتگو: ${short}`,
		`مشتری: ${visitor.first_name} ${visitor.last_name}`,
		`کافه: ${visitor.cafe_name}`,
		`موبایل: ${visitor.phone}`,
		"وضعیت: باز",
		`زمان: ${nowIso()}`,
		"",
		"برای پاسخ، روی همین پیام Reply بزنید و متن را بنویسید.",
		"بستن گفتگو: روی یک پیام همین گفتگو Reply بزنید و بنویسید /close",
	].join("\n");
}

function visitorMessageNotice(visitor, convShort, text) {
	const snippet = text.length > 3500 ? `${text.slice(0, 3500)}…` : text;
	return [
		`💬 پیام جدید از ${visitor.first_name} ${visitor.last_name} (${convShort})`,
		"",
		snippet,
		"",
		"— برای پاسخ Reply کنید",
	].join("\n");
}

async function notifySupportOfVisitorMessage(
	env,
	db,
	conv,
	visitor,
	messageText,
	internalMessageId,
) {
	const groupId = getSupportGroupId(env);
	if (!groupId) {
		console.error(
			"Chat: SUPPORT_GROUP_ID not configured; skipping Telegram notification.",
		);
		return { sent: false, reason: "no_support_group" };
	}
	const short = shortRef(conv.id);
	const anchorChat = conv.telegram_anchor_chat_id;
	const anchorMsg = conv.telegram_anchor_message_id;
	try {
		const sent = await telegramSend(
			env,
			groupId,
			visitorMessageNotice(visitor, short, messageText),
			anchorChat === groupId ? anchorMsg ?? undefined : undefined,
		);
		if (sent?.message_id) {
			try {
				await db
					.prepare(
						"INSERT INTO telegram_message_map (conversation_id, telegram_chat_id, telegram_message_id, direction, internal_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
					)
					.bind(
						conv.id,
						String(groupId),
						sent.message_id,
						"visitor_to_support",
						internalMessageId,
						nowIso(),
					)
					.run();
			} catch {
				// mapping is best-effort; the visitor message is already stored
			}
		}
		return { sent: true, messageId: sent?.message_id };
	} catch (e) {
		console.error(
			"Chat: visitor-message Telegram notify failed:",
			e?.message || e,
		);
		return { sent: false, reason: "telegram_error" };
	}
}

async function notifySupportOfNewConversation(env, db, conv, visitor) {
	const groupId = getSupportGroupId(env);
	if (!groupId) {
		console.error(
			"Chat: SUPPORT_GROUP_ID not configured; skipping new-conversation notification.",
		);
		return { sent: false, reason: "no_support_group" };
	}
	try {
		const sent = await telegramSend(
			env,
			groupId,
			newConversationNotice(visitor, shortRef(conv.id)),
		);
		if (sent?.message_id) {
			try {
				await db
					.prepare(
						"UPDATE conversations SET telegram_anchor_chat_id = ?, telegram_anchor_message_id = ?, updated_at = ? WHERE id = ?",
					)
					.bind(String(groupId), sent.message_id, nowIso(), conv.id)
					.run();
				await db
					.prepare(
						"INSERT INTO telegram_message_map (conversation_id, telegram_chat_id, telegram_message_id, direction, internal_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
					)
					.bind(
						conv.id,
						String(groupId),
						sent.message_id,
						"system_to_support",
						null,
						nowIso(),
					)
					.run();
			} catch {
				// best-effort
			}
		}
		return { sent: true, messageId: sent?.message_id };
	} catch (e) {
		console.error(
			"Chat: new-conversation Telegram notify failed:",
			e?.message || e,
		);
		return { sent: false, reason: "telegram_error" };
	}
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;
		const origin = request.headers.get("Origin");

		if (request.method === "OPTIONS") {
			const isChat = path.startsWith("/api/chat/");
			if (path.startsWith("/api/") || isChat) {
				return new Response(null, {
					status: 204,
					headers: corsHeaders(origin, env, isChat),
				});
			}
			return new Response(null, {
				status: 204,
				headers: corsHeaders(origin, env, false),
			});
		}

		if (path === "/api/telegram/webhook") {
			if (request.method !== "POST")
				return json(
					{ success: false, message: "Method Not Allowed" },
					405,
					origin,
					env,
					false,
				);
			return handleTelegramWebhook(request, env);
		}

		if (path === "/api/chat/health") {
			if (request.method !== "GET")
				return json(
					{ success: false, message: "Method Not Allowed" },
					405,
					origin,
					env,
					true,
				);
			return json(
				{ success: true, service: "pnara-chat", time: nowIso() },
				200,
				origin,
				env,
				true,
			);
		}

		if (path.startsWith("/api/chat/")) {
			if (!origin || !isAllowedOrigin(origin, env)) {
				return json(
					{ success: false, message: "Forbidden" },
					403,
					origin,
					env,
					true,
				);
			}
			return handleChatApi(request, env, path, origin);
		}

		if (path.startsWith("/api/")) {
			return json(
				{ success: false, message: "Not Found" },
				404,
				origin,
				env,
				false,
			);
		}

		// ---- Legacy demo/contact form (POST /) — unchanged behavior ----
		return handleLegacyContact(request, env, origin);
	},
};

// ---------------------------------------------------------------------------
// Legacy contact handler (preserved)
// ---------------------------------------------------------------------------
async function handleLegacyContact(request, env, origin) {
	if (request.method !== "POST") {
		return json(
			{ success: false, message: "Method Not Allowed" },
			405,
			origin,
			env,
			false,
		);
	}
	if (!origin || !getAllowedOrigins(env).includes(origin)) {
		// NOTE: legacy path keeps the original strict check (no localhost bypass)
		// so its public behavior is unchanged.
		return json(
			{ success: false, message: "Forbidden" },
			403,
			origin,
			env,
			false,
		);
	}
	const rl = checkRateLimit(`legacy:${clientIp(request)}`, RATE_LIMITS.legacy);
	if (!rl.allowed) {
		return json(
			{ success: false, message: "Too many requests." },
			429,
			origin,
			env,
			false,
		);
	}
	try {
		const contentType = request.headers.get("Content-Type") || "";
		if (!contentType.includes("application/json")) {
			return json(
				{ success: false, message: "Content-Type must be application/json" },
				415,
				origin,
				env,
				false,
			);
		}
		const body = await request.json();
		const { fullName, cafeName, phone, city, subject, description } = body;
		if (!fullName || !cafeName || !phone || !city || !subject) {
			return json(
				{ success: false, message: "Required fields are missing." },
				400,
				origin,
				env,
				false,
			);
		}
		const subjectTitle = SUBJECTS[subject] || subject;
		const message = [
			"🔔 درخواست جدید",
			"",
			`👤 نام و نام خانوادگی: ${escapeTelegram(fullName)}`,
			`🏪 نام کافه یا رستوران: ${escapeTelegram(cafeName)}`,
			`📱 شماره موبایل: ${escapeTelegram(phone)}`,
			`📍 شهر: ${escapeTelegram(city)}`,
			`📌 موضوع: ${escapeTelegram(subjectTitle)}`,
			"",
			"📝 توضیح:",
			escapeTelegram(description || "-"),
		].join("\n");

		const chatIds = getContactChatIds(env);
		if (chatIds.length === 0)
			throw new Error("No Telegram chat IDs configured.");

		const telegramUrl = `https://api.telegram.org/bot${getBotToken(
			env,
		)}/sendMessage`;
		const results = await Promise.allSettled(
			chatIds.map(async (chatId) => {
				const response = await fetch(telegramUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ chat_id: chatId, text: message }),
				});
				const result = await response.json();
				if (!response.ok || !result.ok) {
					throw new Error(
						result.description ||
							`Telegram request failed with status ${response.status}`,
					);
				}
				return result;
			}),
		);
		const failed = results.filter((r) => r.status === "rejected");
		if (failed.length > 0) {
			console.error("Telegram delivery failures:", failed);
			return json(
				{ success: false, message: "Message delivery failed." },
				502,
				origin,
				env,
				false,
			);
		}
		return json(
			{ success: true, message: "Request submitted successfully." },
			200,
			origin,
			env,
			false,
		);
	} catch (error) {
		console.error("Worker error:", error);
		return json(
			{ success: false, message: "Internal server error." },
			500,
			origin,
			env,
			false,
		);
	}
}

// ---------------------------------------------------------------------------
// Chat API router
// ---------------------------------------------------------------------------
async function handleChatApi(request, env, path, origin) {
	if (!env?.DB) {
		return json(
			{
				success: false,
				message: "Chat storage is not configured. Please try again later.",
				code: "no_storage",
			},
			503,
			origin,
			env,
			true,
		);
	}
	try {
		await ensureSchema(env.DB);
	} catch (e) {
		console.error("Chat: schema init failed:", e?.message || e);
		return json(
			{ success: false, message: "Internal server error." },
			500,
			origin,
			env,
			true,
		);
	}

	if (
		path === "/api/chat/session" &&
		(request.method === "POST" || request.method === "GET")
	) {
		const rl = checkRateLimit(
			`session:${clientIp(request)}`,
			RATE_LIMITS.session,
		);
		if (!rl.allowed) return rateLimited(origin, env, rl.retryAfterSec);
		if (request.method === "GET") return handleSessionGet(request, env, origin);
		return handleSessionPost(request, env, origin);
	}
	if (path === "/api/chat/conversations/current" && request.method === "GET") {
		const rl = checkRateLimit(`poll:${clientIp(request)}`, RATE_LIMITS.poll);
		if (!rl.allowed) return rateLimited(origin, env, rl.retryAfterSec);
		return handleConversationCurrent(request, env, origin);
	}
	if (
		path === "/api/chat/conversations/current/messages" &&
		request.method === "GET"
	) {
		const rl = checkRateLimit(`poll:${clientIp(request)}`, RATE_LIMITS.poll);
		if (!rl.allowed) return rateLimited(origin, env, rl.retryAfterSec);
		return handleMessagesGet(request, env, origin);
	}
	if (
		path === "/api/chat/conversations/current/messages" &&
		request.method === "POST"
	) {
		const rl = checkRateLimit(`send:${clientIp(request)}`, RATE_LIMITS.send);
		if (!rl.allowed) return rateLimited(origin, env, rl.retryAfterSec);
		return handleMessagesPost(request, env, origin);
	}
	return json({ success: false, message: "Not Found" }, 404, origin, env, true);
}

function rateLimited(origin, env, retryAfterSec) {
	const res = json(
		{
			success: false,
			message: "Too many requests. Please slow down.",
			code: "rate_limited",
		},
		429,
		origin,
		env,
		true,
	);
	res.headers.set("Retry-After", String(retryAfterSec || 60));
	return res;
}

async function requireVisitor(request, env) {
	const token = extractVisitorToken(request);
	if (!token) return { visitor: null, token: "" };
	const visitor = await findVisitorByToken(env.DB, token);
	if (!visitor) return { visitor: null, token };
	return { visitor, token };
}

function sessionPayload(visitor, conv, messages) {
	return {
		success: true,
		visitor: publicVisitor(visitor),
		conversation: publicConversation(conv),
		messages: messages || [],
		needsOnboarding: !visitor,
	};
}

async function handleSessionGet(request, env, origin) {
	const { visitor, token } = await requireVisitor(request, env);
	if (!visitor) {
		const fresh =
			token && !isWellFormedToken(token)
				? newVisitorToken()
				: token || newVisitorToken();
		const res = json(
			{
				success: true,
				visitor: null,
				conversation: null,
				messages: [],
				needsOnboarding: true,
				visitorToken: fresh,
			},
			200,
			origin,
			env,
			true,
		);
		return withVisitorCookie(res, fresh, request);
	}
	const conv =
		(await findOpenConversation(env.DB, visitor.id)) ||
		(await findLatestConversation(env.DB, visitor.id));
	const messages = conv
		? await recentMessages(env.DB, conv.id, CHAT_HISTORY_LIMIT)
		: [];
	const res = json(
		{ ...sessionPayload(visitor, conv, messages), visitorToken: token },
		200,
		origin,
		env,
		true,
	);
	return withVisitorCookie(res, token, request);
}

async function handleSessionPost(request, env, origin) {
	const parsed = await readJsonBody(request);
	if (!parsed.ok) {
		return json(
			{
				success: false,
				message:
					parsed.error === "body_too_large"
						? "Request body too large."
						: "Invalid JSON.",
			},
			413,
			origin,
			env,
			true,
		);
	}
	const body = parsed.value || {};
	const hasOnboarding = ["firstName", "lastName", "cafeName", "phone"].some(
		(k) => body[k] !== undefined,
	);

	let { visitor, token } = await requireVisitor(request, env);
	if (!token) token = newVisitorToken();

	if (!hasOnboarding) {
		// Restore-or-issue (same as GET).
		if (!visitor) {
			const res = json(
				{
					success: true,
					visitor: null,
					conversation: null,
					messages: [],
					needsOnboarding: true,
					visitorToken: token,
				},
				200,
				origin,
				env,
				true,
			);
			return withVisitorCookie(res, token, request);
		}
		const conv =
			(await findOpenConversation(env.DB, visitor.id)) ||
			(await findLatestConversation(env.DB, visitor.id));
		const messages = conv
			? await recentMessages(env.DB, conv.id, CHAT_HISTORY_LIMIT)
			: [];
		const res = json(
			{ ...sessionPayload(visitor, conv, messages), visitorToken: token },
			200,
			origin,
			env,
			true,
		);
		return withVisitorCookie(res, token, request);
	}

	const check = validateOnboarding(body);
	if (!check.ok) {
		return json(
			{ success: false, message: "Validation failed.", errors: check.errors },
			400,
			origin,
			env,
			true,
		);
	}
	const { firstName, lastName, cafeName, phone } = check.value;
	const t = nowIso();

	if (!visitor) {
		const hash = await sha256Hex(token);
		try {
			await env.DB.prepare(
				"INSERT INTO visitors (id, token_hash, first_name, last_name, cafe_name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			)
				.bind(randomHex(16), hash, firstName, lastName, cafeName, phone, t, t)
				.run();
		} catch (e) {
			// A forged/duplicate token hash colliding is near-impossible; if the
			// token was somehow taken, rotate once and retry.
			const msg = String(e?.message || "");
			if (/UNIQUE|unique/i.test(msg)) {
				token = newVisitorToken();
				await env.DB.prepare(
					"INSERT INTO visitors (id, token_hash, first_name, last_name, cafe_name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				)
					.bind(
						randomHex(16),
						await sha256Hex(token),
						firstName,
						lastName,
						cafeName,
						phone,
						t,
						t,
					)
					.run();
			} else throw e;
		}
		visitor = await findVisitorByToken(env.DB, token);
	} else {
		await env.DB.prepare(
			"UPDATE visitors SET first_name = ?, last_name = ?, cafe_name = ?, phone = ?, updated_at = ? WHERE id = ?",
		)
			.bind(firstName, lastName, cafeName, phone, t, visitor.id)
			.run();
		visitor = {
			...visitor,
			first_name: firstName,
			last_name: lastName,
			cafe_name: cafeName,
			phone,
			updated_at: t,
		};
	}

	let conv = await findOpenConversation(env.DB, visitor.id);
	let isNew = false;
	if (!conv) {
		conv = await createConversation(env.DB, visitor.id);
		isNew = true;
	}
	if (isNew && conv) {
		// Best-effort: a Telegram failure must not fail onboarding.
		await notifySupportOfNewConversation(env, env.DB, conv, visitor);
		conv = await env.DB.prepare("SELECT * FROM conversations WHERE id = ?")
			.bind(conv.id)
			.first();
	}
	const messages = conv
		? await recentMessages(env.DB, conv.id, CHAT_HISTORY_LIMIT)
		: [];
	const res = json(
		{ ...sessionPayload(visitor, conv, messages), visitorToken: token },
		200,
		origin,
		env,
		true,
	);
	return withVisitorCookie(res, token, request);
}

async function handleConversationCurrent(request, env, origin) {
	const { visitor, token } = await requireVisitor(request, env);
	if (!visitor)
		return json(
			{ success: false, message: "Unauthorized.", code: "no_session" },
			401,
			origin,
			env,
			true,
		);
	const conv =
		(await findOpenConversation(env.DB, visitor.id)) ||
		(await findLatestConversation(env.DB, visitor.id));
	const messages = conv
		? await recentMessages(env.DB, conv.id, CHAT_HISTORY_LIMIT)
		: [];
	const res = json(
		{ ...sessionPayload(visitor, conv, messages), visitorToken: token },
		200,
		origin,
		env,
		true,
	);
	return withVisitorCookie(res, token, request);
}

async function handleMessagesGet(request, env, origin) {
	const { visitor } = await requireVisitor(request, env);
	if (!visitor)
		return json(
			{ success: false, message: "Unauthorized.", code: "no_session" },
			401,
			origin,
			env,
			true,
		);
	const url = new URL(request.url);
	const afterRaw = url.searchParams.get("after") ?? "0";
	const limitRaw =
		url.searchParams.get("limit") ?? String(CHAT_POLL_DEFAULT_LIMIT);
	let after = Number.parseInt(afterRaw, 10);
	if (!Number.isFinite(after) || after < 0) after = 0;
	let limit = Number.parseInt(limitRaw, 10);
	if (!Number.isFinite(limit) || limit <= 0) limit = CHAT_POLL_DEFAULT_LIMIT;
	limit = Math.min(limit, 100);

	const conv =
		(await findOpenConversation(env.DB, visitor.id)) ||
		(await findLatestConversation(env.DB, visitor.id));
	if (!conv)
		return json(
			{ success: true, messages: [], nextAfter: after, status: null },
			200,
			origin,
			env,
			true,
		);
	const messages = await messagesAfter(env.DB, conv.id, after, limit);
	const nextAfter = messages.length ? messages[messages.length - 1].id : after;
	return json(
		{ success: true, messages, nextAfter, status: conv.status },
		200,
		origin,
		env,
		true,
	);
}

async function handleMessagesPost(request, env, origin) {
	const { visitor } = await requireVisitor(request, env);
	if (!visitor) {
		return json(
			{
				success: false,
				message: "Please introduce yourself first.",
				code: "needs_onboarding",
			},
			401,
			origin,
			env,
			true,
		);
	}
	const parsed = await readJsonBody(request);
	if (!parsed.ok) {
		return json(
			{
				success: false,
				message:
					parsed.error === "body_too_large"
						? "Request body too large."
						: "Invalid JSON.",
			},
			413,
			origin,
			env,
			true,
		);
	}
	const body = parsed.value || {};
	const check = validateMessageText(body.text);
	if (!check.ok) {
		return json(
			{
				success: false,
				message:
					check.error === "too_long"
						? "Message is too long."
						: "Message is empty.",
				code: "validation",
			},
			400,
			origin,
			env,
			true,
		);
	}
	const clientMsgId =
		typeof body.clientMsgId === "string" && body.clientMsgId
			? body.clientMsgId
			: null;
	if (clientMsgId !== null && !isValidClientMsgId(clientMsgId)) {
		return json(
			{
				success: false,
				message: "Invalid idempotency key.",
				code: "validation",
			},
			400,
			origin,
			env,
			true,
		);
	}

	let conv =
		(await findOpenConversation(env.DB, visitor.id)) ||
		(await findLatestConversation(env.DB, visitor.id));
	if (!conv) {
		return json(
			{
				success: false,
				message: "No conversation. Please submit your details first.",
				code: "needs_onboarding",
			},
			409,
			origin,
			env,
			true,
		);
	}

	// A new visitor message reopens a closed conversation (documented behavior).
	let reopened = false;
	if (conv.status === "closed") {
		const t = nowIso();
		await env.DB.prepare(
			"UPDATE conversations SET status = 'open', closed_at = NULL, updated_at = ?, last_message_at = ? WHERE id = ?",
		)
			.bind(t, t, conv.id)
			.run();
		await env.DB.prepare(
			"INSERT INTO messages (conversation_id, sender, sender_name, text, client_msg_id, created_at, delivery_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
			.bind(
				conv.id,
				"system",
				null,
				"گفتگو با پیام جدید شما بازگشایی شد.",
				null,
				t,
				"sent",
			)
			.run();
		conv = await env.DB.prepare("SELECT * FROM conversations WHERE id = ?")
			.bind(conv.id)
			.first();
		reopened = true;
	}

	if (clientMsgId) {
		const existing = await env.DB.prepare(
			"SELECT * FROM messages WHERE conversation_id = ? AND client_msg_id = ?",
		)
			.bind(conv.id, clientMsgId)
			.first();
		if (existing) {
			return json(
				{
					success: true,
					message: publicMessage(existing),
					deduped: true,
					status: conv.status,
					reopened,
				},
				200,
				origin,
				env,
				true,
			);
		}
	}

	const t = nowIso();
	let insertedId = 0;
	try {
		const run = await env.DB.prepare(
			"INSERT INTO messages (conversation_id, sender, sender_name, text, client_msg_id, created_at, delivery_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
			.bind(conv.id, "visitor", null, check.value, clientMsgId, t, "sent")
			.run();
		insertedId = run?.meta?.last_row_id ?? 0;
	} catch (e) {
		const msg = String(e?.message || "");
		if (clientMsgId && /UNIQUE|unique/i.test(msg)) {
			const existing = await env.DB.prepare(
				"SELECT * FROM messages WHERE conversation_id = ? AND client_msg_id = ?",
			)
				.bind(conv.id, clientMsgId)
				.first();
			if (existing) {
				return json(
					{
						success: true,
						message: publicMessage(existing),
						deduped: true,
						status: conv.status,
						reopened,
					},
					200,
					origin,
					env,
					true,
				);
			}
		}
		throw e;
	}
	await env.DB.prepare(
		"UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?",
	)
		.bind(t, t, conv.id)
		.run();

	const stored = insertedId
		? await env.DB.prepare("SELECT * FROM messages WHERE id = ?")
				.bind(insertedId)
				.first()
		: await env.DB.prepare(
				"SELECT * FROM messages WHERE conversation_id = ? AND client_msg_id = ?",
			)
				.bind(conv.id, clientMsgId)
				.first();

	// Best-effort Telegram fan-out; visitor send succeeds even if Telegram fails.
	const notify = await notifySupportOfVisitorMessage(
		env,
		env.DB,
		conv,
		visitor,
		check.value,
		insertedId || null,
	);
	if (!notify.sent && stored) {
		try {
			await env.DB.prepare(
				"UPDATE messages SET delivery_status = ? WHERE id = ?",
			)
				.bind("telegram_failed", stored.id)
				.run();
		} catch {
			// ignore
		}
	}

	return json(
		{
			success: true,
			message: stored ? publicMessage(stored) : null,
			deduped: false,
			status: "open",
			reopened,
			telegramSent: notify.sent,
		},
		200,
		origin,
		env,
		true,
	);
}

// ---------------------------------------------------------------------------
// Telegram webhook
// ---------------------------------------------------------------------------
async function handleTelegramWebhook(request, env) {
	const rl = checkRateLimit(
		`webhook:${clientIp(request)}`,
		RATE_LIMITS.webhook,
	);
	if (!rl.allowed) {
		const res = json(
			{ success: false, message: "Too many requests." },
			429,
			null,
			env,
			false,
		);
		res.headers.set("Retry-After", String(rl.retryAfterSec || 60));
		return res;
	}
	const configured =
		typeof env?.TELEGRAM_WEBHOOK_SECRET === "string" &&
		env.TELEGRAM_WEBHOOK_SECRET.trim();
	const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
	if (configured) {
		if (!timingSafeEqual(provided, env.TELEGRAM_WEBHOOK_SECRET.trim())) {
			return json(
				{ success: false, message: "Unauthorized." },
				401,
				null,
				env,
				false,
			);
		}
	} else {
		console.error(
			"Chat: TELEGRAM_WEBHOOK_SECRET is not configured; accepting webhook without verification (set it in production).",
		);
	}

	const parsed = await readJsonBody(request);
	if (!parsed.ok)
		return json(
			{ success: false, message: "Invalid JSON." },
			400,
			null,
			env,
			false,
		);
	const update = parsed.value || {};
	const updateId = update.update_id;
	if (typeof updateId !== "number")
		return json({ success: true, message: "Ignored." }, 200, null, env, false);

	if (!env?.DB)
		return json(
			{ success: false, message: "Storage not configured." },
			503,
			null,
			env,
			false,
		);
	try {
		await ensureSchema(env.DB);
	} catch (e) {
		console.error("Chat webhook: schema init failed:", e?.message || e);
		return json(
			{ success: false, message: "Internal server error." },
			500,
			null,
			env,
			false,
		);
	}

	// Idempotency: Telegram may redeliver the same update.
	try {
		await env.DB.prepare(
			"INSERT INTO telegram_updates (update_id, status, processed_at) VALUES (?, ?, ?)",
		)
			.bind(updateId, "received", nowIso())
			.run();
	} catch {
		return json(
			{ success: true, message: "Duplicate ignored.", deduped: true },
			200,
			null,
			env,
			false,
		);
	}

	try {
		await processTelegramUpdate(env, update);
		await env.DB.prepare(
			"INSERT OR REPLACE INTO telegram_updates (update_id, status, processed_at) VALUES (?, ?, ?)",
		)
			.bind(updateId, "processed", nowIso())
			.run();
	} catch (e) {
		console.error("Chat webhook: processing failed:", e?.message || e);
		try {
			await env.DB.prepare(
				"INSERT OR REPLACE INTO telegram_updates (update_id, status, processed_at) VALUES (?, ?, ?)",
			)
				.bind(updateId, "failed", nowIso())
				.run();
		} catch {
			// ignore
		}
		// Return 200 so Telegram does not retry a poison update forever; the
		// failure is logged for operators. Validation errors below already
		// returned 200-ignored for the same reason.
		return json(
			{ success: true, message: "Processed with errors (logged)." },
			200,
			null,
			env,
			false,
		);
	}
	return json({ success: true, message: "OK" }, 200, null, env, false);
}

async function processTelegramUpdate(env, update) {
	const msg = update.message;
	if (!msg || typeof msg !== "object")
		return { ignored: true, reason: "no_message" };
	if (msg.from?.is_bot) return { ignored: true, reason: "bot_message" };

	const groupId = getSupportGroupId(env);
	if (!groupId) {
		console.error(
			"Chat webhook: SUPPORT_GROUP_ID not configured; ignoring update.",
		);
		return { ignored: true, reason: "no_support_group" };
	}
	if (String(msg.chat?.id) !== String(groupId))
		return { ignored: true, reason: "foreign_chat" };

	const allowlist = getSupportUserIds(env);
	const senderId = msg.from?.id !== undefined ? String(msg.from.id) : "";
	if (allowlist.length > 0 && !allowlist.includes(senderId)) {
		console.error(
			`Chat webhook: unauthorized sender ${senderId || "?"} ignored.`,
		);
		return { ignored: true, reason: "unauthorized" };
	}

	const replyToId = msg.reply_to_message?.message_id;
	if (!replyToId) return { ignored: true, reason: "not_a_reply" };

	const mapping = await env.DB.prepare(
		"SELECT conversation_id FROM telegram_message_map WHERE telegram_chat_id = ? AND telegram_message_id = ?",
	)
		.bind(String(groupId), replyToId)
		.first();
	if (!mapping?.conversation_id)
		return { ignored: true, reason: "unknown_thread" };

	const conv = await env.DB.prepare("SELECT * FROM conversations WHERE id = ?")
		.bind(mapping.conversation_id)
		.first();
	if (!conv) return { ignored: true, reason: "conversation_gone" };

	const rawText =
		typeof msg.text === "string"
			? msg.text
			: typeof msg.caption === "string"
				? msg.caption
				: "";
	const command = parseSupportCommand(rawText);
	if (command === "close") {
		await closeConversation(env, conv, staffName(msg));
		return { action: "closed", conversationId: conv.id };
	}
	if (command === "open") {
		await reopenConversation(env, conv);
		return { action: "reopened", conversationId: conv.id };
	}

	const text = rawText.trim();
	if (!text) return { ignored: true, reason: "empty_text" };
	const check = validateMessageText(text);
	if (!check.ok) return { ignored: true, reason: "too_long" };

	// Reopen automatically if staff replies into a closed conversation.
	if (conv.status === "closed") {
		const t = nowIso();
		await env.DB.prepare(
			"UPDATE conversations SET status = 'open', closed_at = NULL, updated_at = ?, last_message_at = ? WHERE id = ?",
		)
			.bind(t, t, conv.id)
			.run();
	}

	const t = nowIso();
	const run = await env.DB.prepare(
		"INSERT INTO messages (conversation_id, sender, sender_name, text, client_msg_id, created_at, delivery_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(conv.id, "support", staffName(msg), check.value, null, t, "sent")
		.run();
	const internalId = run?.meta?.last_row_id ?? null;
	await env.DB.prepare(
		"UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?",
	)
		.bind(t, t, conv.id)
		.run();

	if (msg.message_id) {
		try {
			await env.DB.prepare(
				"INSERT INTO telegram_message_map (conversation_id, telegram_chat_id, telegram_message_id, direction, internal_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			)
				.bind(
					conv.id,
					String(groupId),
					msg.message_id,
					"support_to_visitor",
					internalId,
					t,
				)
				.run();
		} catch {
			// best-effort
		}
	}
	return { action: "replied", conversationId: conv.id };
}

function staffName(msg) {
	const first = msg?.from?.first_name ? String(msg.from.first_name) : "";
	const last = msg?.from?.last_name ? ` ${msg.from.last_name}` : "";
	const name = `${first}${last}`.trim();
	return name ? name.slice(0, 80) : null;
}

function parseSupportCommand(text) {
	const t = String(text ?? "")
		.trim()
		.toLowerCase();
	if (/^\/close(@\w+)?(\s|$)/.test(t)) return "close";
	if (/^\/open(@\w+)?(\s|$)/.test(t)) return "open";
	if (/^\/reopen(@\w+)?(\s|$)/.test(t)) return "open";
	return null;
}

async function closeConversation(env, conv, staff) {
	const t = nowIso();
	await env.DB.prepare(
		"UPDATE conversations SET status = ?, closed_at = ?, updated_at = ? WHERE id = ?",
	)
		.bind("closed", t, t, conv.id)
		.run();
	await env.DB.prepare(
		"INSERT INTO messages (conversation_id, sender, sender_name, text, client_msg_id, created_at, delivery_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			conv.id,
			"system",
			null,
			"این گفتگو توسط پشتیبانی بسته شد. اگر سؤال دیگری دارید، پیام جدید بفرستید تا گفتگو دوباره باز شود.",
			null,
			t,
			"sent",
		)
		.run();
	const groupId = getSupportGroupId(env);
	if (groupId) {
		try {
			await telegramSend(
				env,
				groupId,
				`✅ گفتگو ${shortRef(conv.id)} بسته شد.${
					staff ? ` (توسط ${staff})` : ""
				}`,
			);
		} catch (e) {
			console.error("Chat: close-confirm notify failed:", e?.message || e);
		}
	}
}

async function reopenConversation(env, conv) {
	const t = nowIso();
	await env.DB.prepare(
		"UPDATE conversations SET status = 'open', closed_at = NULL, updated_at = ?, last_message_at = ? WHERE id = ?",
	)
		.bind(t, t, conv.id)
		.run();
	await env.DB.prepare(
		"INSERT INTO messages (conversation_id, sender, sender_name, text, client_msg_id, created_at, delivery_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(conv.id, "system", null, "این گفتگو دوباره باز شد.", null, t, "sent")
		.run();
	const groupId = getSupportGroupId(env);
	if (groupId) {
		try {
			await telegramSend(
				env,
				groupId,
				`🔓 گفتگو ${shortRef(conv.id)} دوباره باز شد.`,
			);
		} catch (e) {
			console.error("Chat: reopen-confirm notify failed:", e?.message || e);
		}
	}
}
