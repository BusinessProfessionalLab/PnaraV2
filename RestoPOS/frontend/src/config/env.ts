/**
 * Centralized environment configuration.
 *
 * Every outbound HTTP/WebSocket URL in the app is derived from `apiBaseUrl`
 * (via `apiUrl`) — no module hard-codes a host any more.
 *
 *   NEXT_PUBLIC_API_URL (see .env.example) — defaults to the store LAN backend
 *   so the app keeps working without an env file.
 */
const FALLBACK_API_BASE_URL = "http://192.168.100.249:5000";

export const env = {
  // Empty/blank NEXT_PUBLIC_API_URL is treated as unset so a copied
  // `.env.example` (which ships an empty value) can never blank the base URL.
  apiBaseUrl: (
    process.env.NEXT_PUBLIC_API_URL?.trim() || FALLBACK_API_BASE_URL
  ).replace(/\/+$/, ""),
} as const;

/**
 * Absolute URL for a backend path, e.g. `apiUrl("/api/settings")`.
 * Already-absolute URLs are returned untouched, so passing one is safe.
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${env.apiBaseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}
