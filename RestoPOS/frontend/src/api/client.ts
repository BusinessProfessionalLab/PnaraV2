/**
 * The single shared axios instance for the whole application.
 *
 *  · base URL + timeout from env config
 *  · request interceptor attaches the persisted bearer token
 *  · response interceptor handles 401 with a single-flight refresh + retry
 *  · all failures are normalized into ApiError
 *
 * Services are the only modules that talk to this instance — components never
 * see axios (they consume TanStack Query hooks).
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env } from "@/config/env";
import { getAccessToken, getRefreshToken, useAuthStore } from "@/lib/auth-store";
import type { AuthResponse } from "@/lib/types";
import { ApiError, extractText } from "./errors";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    /** Marks an already-refreshed retry to avoid refresh loops. */
    _retry?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

/* ---------------------------- auth header ---------------------------- */

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

/* ------------------------ refresh (single flight) -------------------- */

let refreshPromise: Promise<boolean> | null = null;

/** Forces the auth session out when refresh is impossible. */
function expireSession() {
  useAuthStore.getState().logout();
}

/**
 * Refreshes the session exactly once — concurrent 401s share the same
 * in-flight promise instead of firing parallel refresh calls.
 */
function refreshSession(): Promise<boolean> {
  const token = getRefreshToken();
  if (!token) {
    expireSession();
    return Promise.resolve(false);
  }
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        // Raw axios on purpose: bypasses interceptors so a failed refresh
        // cannot trigger another refresh.
        const { data } = await axios.post<AuthResponse>(
          `${env.apiBaseUrl}/api/auth/refresh`,
          { refreshToken: token },
          { timeout: 15_000 },
        );
        useAuthStore.getState().setSession(data);
        return true;
      } catch {
        expireSession();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/* --------------------------- error handling -------------------------- */

function describeError(error: AxiosError): { status: number; message: string; payload?: unknown; code?: string } {
  // Avoid axios.isCancel type-predicate narrowing AxiosError → never.
  if ((axios.isCancel as (v: unknown) => boolean)(error)) {
    return { status: 0, message: error.message || "cancelled", code: "ERR_CANCELED" };
  }
  const response = error.response;
  const status = response?.status ?? 0;
  const payload = response?.data;
  const extracted = extractText(payload);
  const fallback =
    status > 0 ? response?.statusText ?? error.message : error.message;

  return {
    status,
    message: extracted || fallback,
    payload,
    code: typeof error.code === "string" ? error.code : undefined,
  };
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    // Silent pass-through for cancelled requests (query signals).
    if ((axios.isCancel as (v: unknown) => boolean)(error)) return Promise.reject(error);

    const axError = error as AxiosError;
    // One 401 → refresh → replay the original request.
    if (axError.response?.status === 401 && axError.config && !(axError.config as InternalAxiosRequestConfig)._retry) {
      const config = axError.config as InternalAxiosRequestConfig;
      config._retry = true;
      const refreshed = await refreshSession();
      if (refreshed) {
        const token = getAccessToken();
        if (token) config.headers.set("Authorization", `Bearer ${token}`);
        return apiClient(config);
      }
    }

    const { status, message, payload, code } = describeError(axError);
    return Promise.reject(new ApiError(status, message, payload, code));
  },
);
