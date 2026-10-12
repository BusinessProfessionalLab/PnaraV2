import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const astro = readFileSync(
	join(root, "src", "components", "chat", "LiveChat.astro"),
	"utf8",
);
const client = readFileSync(
	join(root, "src", "components", "chat", "live-chat.ts"),
	"utf8",
);
const layout = readFileSync(
	join(root, "src", "layouts", "Layout.astro"),
	"utf8",
);

describe("widget accessibility + behavior contract (static)", () => {
	it("FAB has an accessible Persian label and expand state", () => {
		assert.match(astro, /aria-label="گفتگو با پشتیبانی"/);
		assert.match(astro, /aria-expanded/);
		assert.match(astro, /aria-controls="pnara-chat-panel"/);
	});
	it("panel is a labelled dialog with close + minimize controls", () => {
		assert.match(astro, /role="dialog"/);
		assert.match(astro, /aria-labelledby="pnara-chat-title"/);
		assert.match(astro, /aria-label="بستن گفتگو"/);
		assert.match(astro, /aria-label="کوچک کردن گفتگو"/);
	});
	it("form fields are labelled, errors use role=alert", () => {
		for (const id of [
			"pnara-chat-firstname",
			"pnara-chat-lastname",
			"pnara-chat-cafename",
			"pnara-chat-phone",
		]) {
			assert.ok(astro.includes(`for="${id}"`), `label for ${id}`);
		}
		assert.match(astro, /role="alert"/);
	});
	it("new support messages use a single polite live region", () => {
		assert.match(astro, /aria-live="polite"/);
		assert.match(client, /announceNewSupport|srStatus/);
	});
	it("keyboard: Escape closes, focus moves into the panel", () => {
		assert.match(client, /key === "Escape"/);
		assert.match(client, /lastFocus/);
	});
	it("respects prefers-reduced-motion", () => {
		assert.match(astro, /prefers-reduced-motion/);
	});
	it("safe rendering: no innerHTML for message text; dir=auto bubbles", () => {
		assert.ok(
			!/innerHTML\s*=/.test(client.replace(/```[\s\S]*?```/g, "")),
			"no innerHTML assignments in client",
		);
		assert.match(client, /textContent/);
		assert.match(astro + client, /dir.*auto/);
	});
	it("polls with a cursor, pauses when hidden/closed, backs off on 429", () => {
		assert.match(client, /after=\$\{state\.after\}/);
		assert.match(client, /document\.hidden/);
		assert.match(client, /pollBackoffMs/);
	});
	it("sends the server-issued token via header + cookies", () => {
		assert.match(client, /X-Visitor-Token/);
		assert.match(client, /credentials.*include/);
	});
	it("mounted globally from Layout (all pages)", () => {
		assert.match(layout, /LiveChat/);
	});
	it("does not fake agent presence", () => {
		assert.ok(
			!/آنلاین|online.*now|سبز.*وضعیت/i.test(astro.replace(/ساعات کاری/g, "")),
			"no live presence claim",
		);
		assert.match(astro, /ساعات کاری/);
	});
});
