/**
 * Centralized environment configuration.
 *
 * All HTTP traffic goes to a single base URL resolved here:
 *   NEXT_PUBLIC_API_URL (see .env.example) — falls back to the original
 *   hard-coded dev backend so the app keeps working without an env file.
 */
export const env = {
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_URL ?? "http://192.168.100.249:5000").replace(/\/+$/, ""),
} as const;
