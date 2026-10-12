import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
		}),
	],
	test: {
		// node:test suites (tests/chat/) run via `npm run test:chat`, not vitest.
		exclude: ["node_modules", "tests/chat/**"],
	},
});
