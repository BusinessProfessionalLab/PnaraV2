/**
 * Centralized environment configuration.
 *
 * Every outbound HTTP/WebSocket URL in the app is derived from `apiBaseUrl`
 * (via `apiUrl`) — no module hard-codes a host any more.
 *
 *   NEXT_PUBLIC_API_URL (see .env.example) — defaults to same-origin requests.
 */
export const env = {
  // An empty value keeps production API requests on the ASP.NET origin.
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_URL?.trim() ?? "").replace(/\/+$/, ""),
} as const;

/**
 * Absolute URL for a backend path, e.g. `apiUrl("/api/settings")`.
 * Already-absolute URLs are returned untouched, so passing one is safe.
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${env.apiBaseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}
