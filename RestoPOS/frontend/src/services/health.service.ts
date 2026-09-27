import { apiClient } from "@/api/client";

/**
 * Server health probe used by the POS connection badge. Both probes are
 * documented without a response body, so only the HTTP outcome matters.
 */
export const healthService = {
  check: () => apiClient.get<void>("/api/health").then((r) => r.data),
};
