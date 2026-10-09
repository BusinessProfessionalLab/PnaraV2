import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { healthKeys } from "@/api/keys";

export type HealthStatus = { product: string; status: string };

/**
 * Health probe. Backend exposes this as a minimal API endpoint
 * (`Program.cs` → `/health` and `/api/health`), not a controller.
 */
export const healthApi = {
  check: () =>
    apiClient.get<HealthStatus>("/api/health").then((r) => r.data),
};

/** Backend connectivity probe — drives the online/offline badge. */
export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: healthApi.check,
    refetchInterval: 15_000,
  });
}
