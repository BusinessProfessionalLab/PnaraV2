import { apiClient } from "@/api/client";

export type HealthStatus = { product: string; status: string };

/** Server health probe used by the POS connection badge. */
export const healthService = {
  check: () =>
    apiClient.get<HealthStatus>("/api/health").then((r) => r.data),
};
