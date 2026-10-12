import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index.js";

// Smoke tests for the migrated live-chat Worker (no D1 / no network needed:
// health + unknown-route + legacy guards never touch storage or Telegram).

describe("migrated pnara worker", () => {
	it("reports health (unit style)", async () => {
		const request = new Request("http://example.com/api/chat/health");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.service).toBe("pnara-chat");
	});

	it("reports health (integration style)", async () => {
		const response = await SELF.fetch("http://example.com/api/chat/health");
		expect(response.status).toBe(200);
	});

	it("returns 404 JSON for unknown /api/ routes", async () => {
		const response = await SELF.fetch(
			"http://example.com/api/does-not-exist",
		);
		expect(response.status).toBe(404);
	});

	it("rejects the legacy contact form from a forbidden origin", async () => {
		const response = await SELF.fetch("http://example.com/", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "https://evil.test",
			},
			body: JSON.stringify({}),
		});
		expect(response.status).toBe(403);
	});

	it("returns 503 for chat APIs when D1 is not bound", async () => {
		const request = new Request("http://example.com/api/chat/session", {
			headers: { Origin: "https://pnara.ir" },
		});
		const ctx = createExecutionContext();
		// No DB binding on purpose: the frontend shows its offline state.
		const response = await worker.fetch(request, {}, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(503);
	});
});
