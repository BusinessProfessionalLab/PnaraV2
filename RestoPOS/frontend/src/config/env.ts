/**
 * Centralized environment configuration.
 *
 * All HTTP traffic goes to a single base URL resolved here:
 *   NEXT_PUBLIC_API_URL (see .env.example) — falls back to the original
 *   hard-coded dev backend so the app keeps working without an env file.
 */
export const env = {
  // Empty base → same-origin `/api/*` so Next.js rewrites reach the local API.
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
} as const;
