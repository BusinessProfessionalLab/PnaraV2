/**
 * Centralized application metadata.
 *
 * `version` is the single source of truth for the version shown anywhere in
 * the UI (sidebar, version/change-log page, …). Bump it once here when a new
 * release ships; never hardcode a version inside a component.
 */
export const appConfig = {
  appName: "ToastIran POS",
  version: "1.4.0",
} as const;
