import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import worker, {
	__resetRateLimits,
	isValidIranMobile,
	normalizePhoneNumber,
	shortRef,
	validateMessageText,
	validateOnboarding,
} from "../../CloudflareWorker.js";

/* ------------------------------------------------------------------ */
/* Minimal in-memory D1 mock that understands exactly the SQL our       */
/* Worker issues (parameterized). Anything else throws loudly so tests  */
/* catch SQL drift.                                                     */
/* ------------------------------------------------------------------ */
class MockD1 {
	constructor() {
		this.visitors = [];
		this.conversations = [];
		this.messages = [];
		this.map = [];
		this.updates = new Map();
		this.msgSeq = 0;
		this.mapSeq = 0;
	}
	prepare(sql) {
		const db = this;
		const norm = String(sql).replace(/\s+/g, " ").trim();
		const stmt = {
			bind(...args) {
				return {
					first: async () => db.execFirst(norm, args),
					all: async () => ({ results: db.execAll(norm, args) }),
					run: async () => db.execRun(norm, args),
				};
			},
			// D1 also allows .run()/.first()/.all() without .bind().
			first: async () => db.execFirst(norm, []),
			all: async () => ({ results: db.execAll(norm, []) }),
			run: async () => db.execRun(norm, []),
		};
		return stmt;
	}
	execFirst(norm, a) {
		if (norm.startsWith("SELECT * FROM visitors WHERE token_hash")) {
			return this.visitors.find((v) => v.token_hash === a[0]) || null;
		}
		if (
			norm.startsWith(
				"SELECT * FROM conversations WHERE visitor_id = ? AND status",
			)
		) {
			const rows = this.conversations
				.filter((c) => c.visitor_id === a[0] && c.status === "open")
				.sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
			return rows[0] || null;
		}
		if (norm.startsWith("SELECT * FROM conversations WHERE visitor_id")) {
			const rows = this.conversations
				.filter((c) => c.visitor_id === a[0])
				.sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
			return rows[0] || null;
		}
		if (norm.startsWith("SELECT * FROM conversations WHERE id")) {
			return this.conversations.find((c) => c.id === a[0]) || null;
		}
		if (
			norm.startsWith(
				"SELECT * FROM messages WHERE conversation_id = ? AND client_msg_id",
			)
		) {
			return (
				this.messages.find(
					(m) => m.conversation_id === a[0] && m.client_msg_id === a[1],
				) || null
			);
		}
		if (norm.startsWith("SELECT * FROM messages WHERE id = ?")) {
			return this.messages.find((m) => m.id === a[0]) || null;
		}
		if (
			norm.startsWith("SELECT conversation_id FROM telegram_message_map WHERE")
		) {
			return (
				this.map.find(
					(r) => r.telegram_chat_id === a[0] && r.telegram_message_id === a[1],
				) || null
			);
		}
		if (norm.startsWith("SELECT status FROM telegram_updates WHERE")) {
			const s = this.updates.get(a[0]);
			return s ? { status: s } : null;
		}
		throw new Error(`MockD1.first: unhandled SQL: ${norm}`);
	}
	execAll(norm, a) {
		if (
			norm.startsWith(
				"SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC",
			)
		) {
			return this.messages
				.filter((m) => m.conversation_id === a[0])
				.sort((x, y) => y.id - x.id)
				.slice(0, a[1]);
		}
		if (
			norm.startsWith(
				"SELECT * FROM messages WHERE conversation_id = ? AND id >",
			)
		) {
			return this.messages
				.filter((m) => m.conversation_id === a[0] && m.id > a[1])
				.sort((x, y) => x.id - y.id)
				.slice(0, a[2]);
		}
		throw new Error(`MockD1.all: unhandled SQL: ${norm}`);
	}
	execRun(norm, a) {
		if (norm.startsWith("CREATE ")) return { success: true, meta: {} };
		if (norm.startsWith("INSERT INTO visitors")) {
			if (this.visitors.some((v) => v.token_hash === a[1] || v.id === a[0])) {
				throw new Error("UNIQUE constraint failed: visitors.token_hash");
			}
			this.visitors.push({
				id: a[0],
				token_hash: a[1],
				first_name: a[2],
				last_name: a[3],
				cafe_name: a[4],
				phone: a[5],
				created_at: a[6],
				updated_at: a[7],
			});
			return { success: true, meta: {} };
		}
		if (norm.startsWith("UPDATE visitors SET")) {
			const v = this.visitors.find((x) => x.id === a[5]);
			if (v)
				Object.assign(v, {
					first_name: a[0],
					last_name: a[1],
					cafe_name: a[2],
					phone: a[3],
					updated_at: a[4],
				});
			return { success: true, meta: {} };
		}
		if (norm.startsWith("INSERT INTO conversations")) {
			if (
				this.conversations.some((c) => c.id === a[0] || c.short_ref === a[1])
			) {
				throw new Error("UNIQUE constraint failed: conversations.id");
			}
			const c = {
				id: a[0],
				short_ref: a[1],
				visitor_id: a[2],
				status: "open",
				created_at: a[3],
				updated_at: a[4],
				last_message_at: a[5],
				closed_at: null,
				telegram_anchor_chat_id: null,
				telegram_anchor_message_id: null,
			};
			this.conversations.push(c);
			return { success: true, meta: {} };
		}
		if (norm.startsWith("UPDATE conversations SET telegram_anchor_chat_id")) {
			const c = this.conversations.find((x) => x.id === a[3]);
			if (c)
				Object.assign(c, {
					telegram_anchor_chat_id: a[0],
					telegram_anchor_message_id: a[1],
					updated_at: a[2],
				});
			return { success: true, meta: {} };
		}
		if (norm.startsWith("UPDATE conversations SET status = ?, closed_at")) {
			const c = this.conversations.find((x) => x.id === a[3]);
			if (c)
				Object.assign(c, { status: a[0], closed_at: a[1], updated_at: a[2] });
			return { success: true, meta: {} };
		}
		if (
			norm.startsWith(
				"UPDATE conversations SET status = 'open', closed_at = NULL",
			)
		) {
			const c = this.conversations.find((x) => x.id === a[2]);
			if (c)
				Object.assign(c, {
					status: "open",
					closed_at: null,
					updated_at: a[0],
					last_message_at: a[1],
				});
			return { success: true, meta: {} };
		}
		if (norm.startsWith("UPDATE conversations SET last_message_at")) {
			const c = this.conversations.find((x) => x.id === a[2]);
			if (c) Object.assign(c, { last_message_at: a[0], updated_at: a[1] });
			return { success: true, meta: {} };
		}
		if (norm.startsWith("INSERT INTO messages")) {
			if (a[4] && this.messages.some((m) => m.client_msg_id === a[4])) {
				throw new Error("UNIQUE constraint failed: messages.client_msg_id");
			}
			this.msgSeq += 1;
			this.messages.push({
				id: this.msgSeq,
				conversation_id: a[0],
				sender: a[1],
				sender_name: a[2],
				text: a[3],
				client_msg_id: a[4],
				created_at: a[5],
				delivery_status: a[6],
				telegram_message_id: null,
			});
			return { success: true, meta: { last_row_id: this.msgSeq } };
		}
		if (norm.startsWith("UPDATE messages SET delivery_status")) {
			const m = this.messages.find((x) => x.id === a[1]);
			if (m) m.delivery_status = a[0];
			return { success: true, meta: {} };
		}
		if (norm.startsWith("INSERT INTO telegram_message_map")) {
			if (
				this.map.some(
					(r) => r.telegram_chat_id === a[1] && r.telegram_message_id === a[2],
				)
			) {
				throw new Error("UNIQUE constraint failed: telegram_message_map");
			}
			this.mapSeq += 1;
			this.map.push({
				id: this.mapSeq,
				conversation_id: a[0],
				telegram_chat_id: a[1],
				telegram_message_id: a[2],
				direction: a[3],
				internal_message_id: a[4],
				created_at: a[5],
			});
			return { success: true, meta: {} };
		}
		if (norm.startsWith("INSERT OR REPLACE INTO telegram_updates")) {
			this.updates.set(a[0], a[1]);
			return { success: true, meta: {} };
		}
		if (norm.startsWith("INSERT INTO telegram_updates")) {
			if (this.updates.has(a[0]))
				throw new Error("UNIQUE constraint failed: telegram_updates");
			this.updates.set(a[0], a[1]);
			return { success: true, meta: {} };
		}
		throw new Error(`MockD1.run: unhandled SQL: ${norm}`);
	}
}

/* ------------------------------------------------------------------ */
/* Telegram fetch mock: records sendMessage calls, answers ok.          */
/* ------------------------------------------------------------------ */
const realFetch = globalThis.fetch;
let telegramCalls = [];
let telegramMsgSeq = 1000;
let telegramShouldFail = false;

function installTelegramMock() {
	telegramCalls = [];
	telegramMsgSeq = 1000;
	telegramShouldFail = false;
	globalThis.fetch = async (url, init) => {
		const u = String(url);
		if (u.includes("api.telegram.org")) {
			const body = JSON.parse(init.body);
			telegramCalls.push(body);
			if (telegramShouldFail) {
				return {
					ok: false,
					status: 500,
					json: async () => ({ ok: false, description: "mock failure" }),
				};
			}
			telegramMsgSeq += 1;
			return {
				ok: true,
				status: 200,
				json: async () => ({
					ok: true,
					result: { message_id: telegramMsgSeq, chat: { id: body.chat_id } },
				}),
			};
		}
		return realFetch(url, init);
	};
}

const ORIGIN = "https://pnara.ir";
let ipSeq = 0;
const nextIp = () => `10.0.0.${++ipSeq}`;

function req(
	path,
	{ method = "GET", body, token, ip, origin = ORIGIN, extraHeaders = {} } = {},
) {
	const headers = {
		Origin: origin,
		"Content-Type": "application/json",
		...extraHeaders,
	};
	if (ip) headers["CF-Connecting-IP"] = ip;
	if (token) headers["X-Visitor-Token"] = token;
	return new Request(`https://worker.test${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

function makeEnv(overrides = {}) {
	return {
		DB: new MockD1(),
		TELEGRAM_BOT_TOKEN: "test-token",
		SUPPORT_GROUP_ID: "-1001",
		TELEGRAM_WEBHOOK_SECRET: "s3cret",
		SUPPORT_USER_IDS: "",
		ALLOWED_ORIGINS: "",
		...overrides,
	};
}

async function onboard(env, ip, profile = {}) {
	const res = await worker.fetch(
		req("/api/chat/session", {
			method: "POST",
			ip,
			body: {
				firstName: "مریم",
				lastName: "رضایی",
				cafeName: "کافه ونوشه",
				phone: "09123456789",
				...profile,
			},
		}),
		env,
	);
	const body = await res.json();
	assert.equal(res.status, 200);
	assert.equal(body.success, true);
	return body;
}

beforeEach(() => {
	__resetRateLimits();
	installTelegramMock();
});

/* ------------------------------------------------------------------ */
describe("worker validation mirrors shared/chat-shared.js", () => {
	it("phone + onboarding + message rules agree on vectors", async () => {
		const shared = await import("../../shared/chat-shared.js");
		const vectors = [
			"09123456789",
			"۰۹۱۲۳۴۵۶۷۸۹",
			"+989123456789",
			"02112345678",
			"abc",
		];
		for (const v of vectors) {
			assert.equal(
				normalizePhoneNumber(v),
				shared.normalizePhoneNumber(v),
				`normalize ${v}`,
			);
			assert.equal(
				isValidIranMobile(v),
				shared.isValidIranMobile(v),
				`valid ${v}`,
			);
		}
		const good = {
			firstName: "a",
			lastName: "b",
			cafeName: "c",
			phone: "09123456789",
		};
		assert.deepEqual(
			JSON.parse(JSON.stringify(validateOnboarding(good))),
			JSON.parse(JSON.stringify(shared.validateOnboarding(good))),
		);
		assert.deepEqual(
			validateMessageText(" x "),
			shared.validateMessageText(" x "),
		);
		assert.equal(shortRef("a1b2c3"), shared.shortRef("a1b2c3"));
	});
});

describe("legacy contact form preserved", () => {
	it("POST / still forwards and returns success", async () => {
		const env = makeEnv();
		const res = await worker.fetch(
			req("/", {
				method: "POST",
				ip: nextIp(),
				body: {
					fullName: "A B",
					cafeName: "C",
					phone: "09",
					city: "Tehran",
					subject: "demo",
					description: "hi",
				},
			}),
			env,
		);
		const body = await res.json();
		assert.equal(res.status, 200);
		assert.equal(body.success, true);
		assert.equal(
			telegramCalls.length,
			4,
			"legacy notifies all 4 fallback chat ids",
		);
	});
	it("rejects wrong origin and wrong method exactly like before", async () => {
		const env = makeEnv();
		const r1 = await worker.fetch(
			req("/", {
				method: "POST",
				ip: nextIp(),
				origin: "https://evil.test",
				body: {},
			}),
			env,
		);
		assert.equal(r1.status, 403);
		const r2 = await worker.fetch(
			req("/", { method: "GET", ip: nextIp() }),
			env,
		);
		assert.equal(r2.status, 405);
	});
});

describe("chat session + messaging", () => {
	it("onboards, notifies support group, restores on GET", async () => {
		const env = makeEnv();
		const ip = nextIp();
		const created = await onboard(env, ip);
		assert.ok(created.visitorToken);
		assert.equal(created.visitor.phone, "09123456789");
		assert.equal(created.conversation.status, "open");
		assert.match(created.conversation.shortRef, /^#[A-Z0-9]{6}$/);
		const anchorCalls = telegramCalls.filter(
			(c) => String(c.chat_id) === "-1001",
		);
		assert.equal(anchorCalls.length, 1, "exactly one new-conversation notice");

		const res = await worker.fetch(
			req("/api/chat/session", {
				method: "GET",
				ip,
				token: created.visitorToken,
			}),
			env,
		);
		const body = await res.json();
		assert.equal(body.visitor.firstName, "مریم");
		assert.equal(body.conversation.id, created.conversation.id);
	});

	it("rejects invalid onboarding server-side", async () => {
		const env = makeEnv();
		const res = await worker.fetch(
			req("/api/chat/session", {
				method: "POST",
				ip: nextIp(),
				body: { firstName: " ", lastName: "x", cafeName: "y", phone: "123" },
			}),
			env,
		);
		assert.equal(res.status, 400);
		const body = await res.json();
		assert.equal(body.errors.firstName, "required");
		assert.equal(body.errors.phone, "invalid_mobile");
	});

	it("sends a message, dedupes by clientMsgId, polls by cursor", async () => {
		const env = makeEnv();
		const ip = nextIp();
		const s = await onboard(env, ip);
		const token = s.visitorToken;
		const ck = "550e8400-e29b-41d4-a716-446655440001";

		const r1 = await worker.fetch(
			req("/api/chat/conversations/current/messages", {
				method: "POST",
				ip,
				token,
				body: { text: "سلام", clientMsgId: ck },
			}),
			env,
		);
		const b1 = await r1.json();
		assert.equal(b1.success, true);
		assert.equal(b1.deduped, false);

		const r2 = await worker.fetch(
			req("/api/chat/conversations/current/messages", {
				method: "POST",
				ip,
				token,
				body: { text: "سلام", clientMsgId: ck },
			}),
			env,
		);
		const b2 = await r2.json();
		assert.equal(b2.deduped, true);
		assert.equal(
			env.DB.messages.filter((m) => m.sender === "visitor").length,
			1,
			"no duplicate stored",
		);

		const pollAll = await (
			await worker.fetch(
				req("/api/chat/conversations/current/messages?after=0&limit=50", {
					ip,
					token,
				}),
				env,
			)
		).json();
		assert.ok(pollAll.messages.length >= 1);
		const cursor = pollAll.nextAfter;
		const pollNew = await (
			await worker.fetch(
				req(
					`/api/chat/conversations/current/messages?after=${cursor}&limit=50`,
					{ ip, token },
				),
				env,
			)
		).json();
		assert.deepEqual(
			pollNew.messages,
			[],
			"cursor fetch returns only new messages",
		);
	});

	it("isolates visitors: one cannot read another's conversation", async () => {
		const env = makeEnv();
		const a = await onboard(env, nextIp());
		const b = await onboard(env, nextIp(), {
			firstName: "علی",
			phone: "09987654321",
		});
		assert.notEqual(a.conversation.id, b.conversation.id);
		const res = await worker.fetch(
			req("/api/chat/conversations/current", {
				ip: nextIp(),
				token: b.visitorToken,
			}),
			env,
		);
		const body = await res.json();
		assert.equal(body.conversation.id, b.conversation.id);
		assert.ok(!JSON.stringify(body).includes(a.conversation.id));
	});

	it("requires auth for message endpoints", async () => {
		const env = makeEnv();
		const r = await worker.fetch(
			req("/api/chat/conversations/current/messages?after=0", { ip: nextIp() }),
			env,
		);
		assert.equal(r.status, 401);
	});

	it("returns 503 when D1 is not bound (frontend shows offline state)", async () => {
		const res = await worker.fetch(
			req("/api/chat/session", { method: "GET", ip: nextIp() }),
			{ SUPPORT_GROUP_ID: "-1001" },
		);
		assert.equal(res.status, 503);
	});

	it("still stores the visitor message when Telegram fan-out fails", async () => {
		const env = makeEnv();
		const ip = nextIp();
		const s = await onboard(env, ip);
		telegramShouldFail = true;
		const r = await worker.fetch(
			req("/api/chat/conversations/current/messages", {
				method: "POST",
				ip,
				token: s.visitorToken,
				body: {
					text: "تلگرام قطعه؟",
					clientMsgId: "550e8400-e29b-41d4-a716-446655440099",
				},
			}),
			env,
		);
		const b = await r.json();
		assert.equal(b.success, true);
		assert.equal(b.telegramSent, false);
		assert.equal(env.DB.messages.at(-1).delivery_status, "telegram_failed");
	});
});

describe("telegram webhook", () => {
	it("rejects bad secret, maps a support reply to the right conversation", async () => {
		const env = makeEnv();
		const s = await onboard(env, nextIp());
		const anchorId = telegramMsgSeq; // new-conversation notice message_id

		const bad = await worker.fetch(
			req("/api/telegram/webhook", {
				method: "POST",
				body: { update_id: 1, message: {} },
				extraHeaders: { "X-Telegram-Bot-Api-Secret-Token": "wrong" },
			}),
			env,
		);
		assert.equal(bad.status, 401);

		const good = await worker.fetch(
			req("/api/telegram/webhook", {
				method: "POST",
				body: {
					update_id: 2,
					message: {
						message_id: 500,
						chat: { id: -1001 },
						from: { id: 777, first_name: "سارا", is_bot: false },
						reply_to_message: { message_id: anchorId },
						text: "سلام، در خدمتم",
					},
				},
				extraHeaders: { "X-Telegram-Bot-Api-Secret-Token": "s3cret" },
			}),
			env,
		);
		assert.equal((await good.json()).success, true);

		const poll = await (
			await worker.fetch(
				req("/api/chat/conversations/current/messages?after=0&limit=50", {
					ip: nextIp(),
					token: s.visitorToken,
				}),
				env,
			)
		).json();
		const support = poll.messages.filter((m) => m.sender === "support");
		assert.equal(support.length, 1);
		assert.equal(support[0].text, "سلام، در خدمتم");
		assert.equal(support[0].senderName, "سارا");
	});

	it("ignores duplicate update_ids (Telegram redelivery)", async () => {
		const env = makeEnv();
		const s = await onboard(env, nextIp());
		const anchorId = telegramMsgSeq;
		const payload = {
			update_id: 7,
			message: {
				message_id: 501,
				chat: { id: -1001 },
				from: { id: 777, first_name: "س", is_bot: false },
				reply_to_message: { message_id: anchorId },
				text: "تکراری؟",
			},
		};
		const h = { "X-Telegram-Bot-Api-Secret-Token": "s3cret" };
		await worker.fetch(
			req("/api/telegram/webhook", {
				method: "POST",
				body: payload,
				extraHeaders: h,
			}),
			env,
		);
		const dup = await worker.fetch(
			req("/api/telegram/webhook", {
				method: "POST",
				body: payload,
				extraHeaders: h,
			}),
			env,
		);
		assert.equal((await dup.json()).deduped, true);
		const poll = await (
			await worker.fetch(
				req("/api/chat/conversations/current/messages?after=0&limit=50", {
					ip: nextIp(),
					token: s.visitorToken,
				}),
				env,
			)
		).json();
		assert.equal(poll.messages.filter((m) => m.text === "تکراری؟").length, 1);
	});

	it("ignores foreign chats, non-replies, unknown threads, bot senders", async () => {
		const env = makeEnv();
		await onboard(env, nextIp());
		const h = { "X-Telegram-Bot-Api-Secret-Token": "s3cret" };
		const cases = [
			{
				update_id: 11,
				message: {
					message_id: 1,
					chat: { id: -9999 },
					from: { id: 1, is_bot: false },
					reply_to_message: { message_id: 1 },
					text: "x",
				},
			},
			{
				update_id: 12,
				message: {
					message_id: 2,
					chat: { id: -1001 },
					from: { id: 1, is_bot: false },
					text: "no reply",
				},
			},
			{
				update_id: 13,
				message: {
					message_id: 3,
					chat: { id: -1001 },
					from: { id: 1, is_bot: false },
					reply_to_message: { message_id: 424242 },
					text: "unknown",
				},
			},
			{
				update_id: 14,
				message: {
					message_id: 4,
					chat: { id: -1001 },
					from: { id: 1, is_bot: true },
					reply_to_message: { message_id: 424242 },
					text: "bot",
				},
			},
		];
		for (const payload of cases) {
			const r = await worker.fetch(
				req("/api/telegram/webhook", {
					method: "POST",
					body: payload,
					extraHeaders: h,
				}),
				env,
			);
			assert.equal((await r.json()).success, true);
		}
		assert.equal(
			env.DB.messages.length,
			0,
			"nothing stored from unmapped updates",
		);
	});

	it("enforces SUPPORT_USER_IDS allowlist", async () => {
		const env = makeEnv({ SUPPORT_USER_IDS: "999" });
		const s = await onboard(env, nextIp());
		const anchorId = telegramMsgSeq;
		const r = await worker.fetch(
			req("/api/telegram/webhook", {
				method: "POST",
				body: {
					update_id: 21,
					message: {
						message_id: 502,
						chat: { id: -1001 },
						from: { id: 777, first_name: "غریبه", is_bot: false },
						reply_to_message: { message_id: anchorId },
						text: "من پشتیبانی نیستم",
					},
				},
				extraHeaders: { "X-Telegram-Bot-Api-Secret-Token": "s3cret" },
			}),
			env,
		);
		assert.equal((await r.json()).success, true);
		const poll = await (
			await worker.fetch(
				req("/api/chat/conversations/current/messages?after=0&limit=50", {
					ip: nextIp(),
					token: s.visitorToken,
				}),
				env,
			)
		).json();
		assert.ok(!poll.messages.some((m) => m.text === "من پشتیبانی نیستم"));
	});

	it("closes via /close reply, notifies visitor, reopens on next visitor message", async () => {
		const env = makeEnv();
		const ip = nextIp();
		const s = await onboard(env, ip);
		const anchorId = telegramMsgSeq;
		const h = { "X-Telegram-Bot-Api-Secret-Token": "s3cret" };

		await worker.fetch(
			req("/api/telegram/webhook", {
				method: "POST",
				body: {
					update_id: 31,
					message: {
						message_id: 503,
						chat: { id: -1001 },
						from: { id: 777, first_name: "سارا", is_bot: false },
						reply_to_message: { message_id: anchorId },
						text: "/close",
					},
				},
				extraHeaders: h,
			}),
			env,
		);
		let cur = await (
			await worker.fetch(
				req("/api/chat/conversations/current", { ip, token: s.visitorToken }),
				env,
			)
		).json();
		assert.equal(cur.conversation.status, "closed");
		assert.ok(
			cur.messages.some((m) => m.sender === "system"),
			"visitor sees a close notice",
		);

		const send = await worker.fetch(
			req("/api/chat/conversations/current/messages", {
				method: "POST",
				ip,
				token: s.visitorToken,
				body: {
					text: "یه سؤال دیگه",
					clientMsgId: "550e8400-e29b-41d4-a716-446655440077",
				},
			}),
			env,
		);
		const sb = await send.json();
		assert.equal(sb.reopened, true);
		assert.equal(sb.status, "open");
		cur = await (
			await worker.fetch(
				req("/api/chat/conversations/current", { ip, token: s.visitorToken }),
				env,
			)
		).json();
		assert.equal(cur.conversation.status, "open");
	});

	it("keeps two conversations from crossing messages", async () => {
		const env = makeEnv();
		const a = await onboard(env, nextIp());
		const anchorA = telegramMsgSeq;
		const b = await onboard(env, nextIp(), {
			firstName: "علی",
			phone: "09987654321",
		});
		void anchorA;
		const anchorB = telegramMsgSeq;
		const h = { "X-Telegram-Bot-Api-Secret-Token": "s3cret" };
		await worker.fetch(
			req("/api/telegram/webhook", {
				method: "POST",
				body: {
					update_id: 41,
					message: {
						message_id: 504,
						chat: { id: -1001 },
						from: { id: 777, first_name: "س", is_bot: false },
						reply_to_message: { message_id: anchorB },
						text: "فقط برای علی",
					},
				},
				extraHeaders: h,
			}),
			env,
		);
		const pa = await (
			await worker.fetch(
				req("/api/chat/conversations/current/messages?after=0&limit=50", {
					ip: nextIp(),
					token: a.visitorToken,
				}),
				env,
			)
		).json();
		const pb = await (
			await worker.fetch(
				req("/api/chat/conversations/current/messages?after=0&limit=50", {
					ip: nextIp(),
					token: b.visitorToken,
				}),
				env,
			)
		).json();
		assert.ok(
			!pa.messages.some((m) => m.text === "فقط برای علی"),
			"A must not see B's reply",
		);
		assert.ok(
			pb.messages.some((m) => m.text === "فقط برای علی"),
			"B sees its reply",
		);
	});
});

describe("rate limiting", () => {
	it("429s runaway senders with Retry-After", async () => {
		const env = makeEnv();
		const ip = nextIp();
		const s = await onboard(env, ip);
		let last = 200;
		let retryAfter = "";
		for (let i = 0; i < 16; i++) {
			const r = await worker.fetch(
				req("/api/chat/conversations/current/messages", {
					method: "POST",
					ip,
					token: s.visitorToken,
					body: {
						text: `msg ${i}`,
						clientMsgId: `550e8400-e29b-41d4-a716-44665544${String(1000 + i)}`,
					},
				}),
				env,
			);
			last = r.status;
			if (last === 429) retryAfter = r.headers.get("Retry-After") || "";
		}
		assert.equal(last, 429);
		assert.ok(retryAfter, "Retry-After header present");
	});
});
