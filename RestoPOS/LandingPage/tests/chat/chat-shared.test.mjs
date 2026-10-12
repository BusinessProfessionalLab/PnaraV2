import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isValidClientMsgId,
	isValidIranMobile,
	mergeMessages,
	normalizeDigits,
	normalizePhoneNumber,
	shortRef,
	tokenizeMessage,
	validateMessageText,
	validateOnboarding,
} from "../../shared/chat-shared.js";

describe("normalizeDigits", () => {
	it("converts Persian and Arabic digits to ASCII", () => {
		assert.equal(normalizeDigits("۰۹۱۲۳۴۵۶۷۸۹"), "09123456789");
		assert.equal(normalizeDigits("٠٩١٢٣٤٥٦٧٨٩"), "09123456789");
		assert.equal(normalizeDigits("abc۱۲۳"), "abc123");
		assert.equal(normalizeDigits(""), "");
	});
});

describe("phone normalization + validation", () => {
	it("accepts plain 09xxxxxxxxx", () => {
		assert.equal(normalizePhoneNumber("09123456789"), "09123456789");
		assert.ok(isValidIranMobile("09123456789"));
	});
	it("accepts Persian digits with spaces/dashes", () => {
		assert.equal(normalizePhoneNumber("۰۹۱۲ ۳۴۵ ۶۷۸۹"), "09123456789");
		assert.ok(isValidIranMobile("۰۹۱۲-۳۴۵-۶۷۸۹"));
	});
	it("accepts +98 / 0098 / 98 prefixes", () => {
		assert.equal(normalizePhoneNumber("+989123456789"), "09123456789");
		assert.equal(normalizePhoneNumber("00989123456789"), "09123456789");
		assert.equal(normalizePhoneNumber("989123456789"), "09123456789");
		assert.ok(isValidIranMobile("+989123456789"));
	});
	it("rejects landlines, short numbers, latin garbage", () => {
		assert.ok(!isValidIranMobile("02112345678"));
		assert.ok(!isValidIranMobile("0912345678"));
		assert.ok(!isValidIranMobile("091234567890"));
		assert.ok(!isValidIranMobile("not-a-number"));
		assert.ok(!isValidIranMobile(""));
	});
});

describe("validateOnboarding", () => {
	const good = {
		firstName: "مریم",
		lastName: "رضایی",
		cafeName: "کافه ونوشه",
		phone: "09123456789",
	};
	it("accepts valid input and normalizes the phone", () => {
		const r = validateOnboarding({ ...good, phone: "۰۹۱۲۳۴۵۶۷۸۹" });
		assert.equal(r.ok, true);
		assert.equal(r.value.phone, "09123456789");
	});
	it("rejects blank / whitespace-only values", () => {
		const r = validateOnboarding({
			firstName: "  ",
			lastName: "",
			cafeName: "\t",
			phone: "",
		});
		assert.equal(r.ok, false);
		assert.deepEqual(Object.keys(r.errors).sort(), [
			"cafeName",
			"firstName",
			"lastName",
			"phone",
		]);
	});
	it("rejects invalid mobile", () => {
		const r = validateOnboarding({ ...good, phone: "12345" });
		assert.equal(r.ok, false);
		assert.equal(r.errors.phone, "invalid_mobile");
	});
	it("rejects overlong fields", () => {
		const r = validateOnboarding({
			...good,
			firstName: "x".repeat(81),
			cafeName: "y".repeat(121),
		});
		assert.equal(r.ok, false);
		assert.equal(r.errors.firstName, "too_long");
		assert.equal(r.errors.cafeName, "too_long");
	});
	it("trims names", () => {
		const r = validateOnboarding({ ...good, firstName: "  مریم " });
		assert.equal(r.ok, true);
		assert.equal(r.value.firstName, "مریم");
	});
});

describe("validateMessageText", () => {
	it("accepts normal text and trims", () => {
		assert.deepEqual(validateMessageText("  سلام  "), {
			ok: true,
			value: "سلام",
		});
	});
	it("rejects empty / whitespace-only", () => {
		assert.equal(validateMessageText("   ").ok, false);
		assert.equal(validateMessageText("").ok, false);
	});
	it("rejects >2000 chars", () => {
		assert.equal(validateMessageText("x".repeat(2001)).ok, false);
		assert.equal(validateMessageText("x".repeat(2000)).ok, true);
	});
});

describe("isValidClientMsgId", () => {
	it("accepts uuid-like keys, rejects junk", () => {
		assert.ok(isValidClientMsgId("550e8400-e29b-41d4-a716-446655440000"));
		assert.ok(!isValidClientMsgId("hi"));
		assert.ok(!isValidClientMsgId("<script>"));
		assert.ok(!isValidClientMsgId("x".repeat(65)));
	});
});

describe("mergeMessages", () => {
	it("dedupes by id and clientMsgId and sorts ascending", () => {
		const a = [
			{ id: 2, text: "b", clientMsgId: "ck-2" },
			{ id: 1, text: "a", clientMsgId: null },
		];
		const b = [
			{ id: 2, text: "b-dup", clientMsgId: "ck-2" },
			{ id: 3, text: "c", clientMsgId: "ck-3" },
		];
		const out = mergeMessages(a, b);
		assert.deepEqual(
			out.map((m) => m.id),
			[1, 2, 3],
		);
	});
	it("treats a resent pending (same clientMsgId, temp id) as duplicate", () => {
		const existing = [{ id: -1, text: "x", clientMsgId: "ck-9" }];
		const out = mergeMessages(existing, [
			{ id: 7, text: "x", clientMsgId: "ck-9" },
		]);
		assert.equal(out.length, 1);
	});
});

describe("shortRef", () => {
	it("builds a #XXXXXX ref", () => {
		assert.equal(shortRef("a1b2c3def"), "#A1B2C3");
		assert.equal(shortRef("ab"), "#ABXXXX");
	});
});

describe("tokenizeMessage", () => {
	it("keeps plain text as one token", () => {
		assert.deepEqual(tokenizeMessage("سلام دنیا"), [
			{ kind: "text", text: "سلام دنیا" },
		]);
	});
	it("extracts https links only (no javascript:)", () => {
		const toks = tokenizeMessage("ببین https://pnara.ir/x و تمام");
		const link = toks.find((t) => t.kind === "link");
		assert.ok(link && link.href === "https://pnara.ir/x");
		assert.ok(
			!toks.some(
				(t) => t.kind === "link" && String(t.href).startsWith("javascript"),
			),
		);
	});
	it("does not linkify javascript: URLs", () => {
		const toks = tokenizeMessage("javascript:alert(1)");
		assert.ok(toks.every((t) => t.kind === "text"));
	});
	it("detects Iranian mobiles incl. Persian digits", () => {
		const toks = tokenizeMessage("تماس: ۰۹۱۲۳۴۵۶۷۸۹ ممنون");
		const ph = toks.find((t) => t.kind === "phone");
		assert.ok(ph && ph.href === "tel:09123456789");
	});
	it("leaves landlines as text", () => {
		const toks = tokenizeMessage("تلفن 02112345678");
		assert.ok(toks.every((t) => t.kind !== "phone"));
	});
});
