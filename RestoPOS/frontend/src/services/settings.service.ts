import { apiClient } from "@/api/client";
import type { StoreSettingsDto } from "@/lib/types";

/** Settings (store identity / brand / receipt) domain — pure API communication. */
export const settingsService = {
  get: () =>
    apiClient.get<StoreSettingsDto>("/api/settings").then((r) => r.data),

  update: (payload: Record<string, unknown>) =>
    apiClient
      .put<StoreSettingsDto>("/api/settings", payload)
      .then((r) => r.data),
};
