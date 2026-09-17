import { apiClient } from "@/api/client";
import type { StoreSettingsDto } from "@/lib/types";

export type UpdateStoreSettingsRequest = {
  storeName: string | null;
  logoUrl: string | null;
  taxIdentificationNumber: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  vatRate: number;
  loyaltyPointsPerMillionRial: number;
  thermalPrinterHost: string | null;
  thermalPrinterPort: number;
};

/** Settings (store identity / brand / receipt) domain — pure API communication. */
export const settingsService = {
  get: () =>
    apiClient.get<StoreSettingsDto>("/api/settings").then((r) => r.data),

  update: (payload: UpdateStoreSettingsRequest) =>
    apiClient
      .put<StoreSettingsDto>("/api/settings", payload)
      .then((r) => r.data),
};
