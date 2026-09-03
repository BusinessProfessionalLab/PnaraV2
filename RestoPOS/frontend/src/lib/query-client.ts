import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/api/errors";

/**
 * Single QueryClient factory — configured once and shared by the whole app.
 *
 * · staleTime 15s      → settings/menu/stock are reused while fresh
 * · retry 1            → one automatic retry for transient failures only
 * · refetchOnWindowFocus off → we drive refetches explicitly (polling, mutations)
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) =>
          failureCount < 1 &&
          !(isApiError(error) && error.status >= 400 && error.status < 500),
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
