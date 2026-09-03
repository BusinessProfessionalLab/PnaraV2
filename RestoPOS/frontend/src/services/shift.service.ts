import { apiClient } from "@/api/client";
import type { ShiftDto } from "@/lib/types";

export interface OpenShiftRequest {
  openingCash: number;
  notes?: string;
}

export interface CloseShiftRequest {
  shiftId: string;
  closingCash: number;
  notes?: string;
}

/** Cashier shifts domain — pure API communication. */
export const shiftService = {
  current: () =>
    apiClient
      .get<ShiftDto | null>("/api/shifts/current")
      .then((r) => r.data),

  open: (openingCash: number, notes?: string) =>
    apiClient
      .post<string>("/api/shifts/open", { openingCash, notes } satisfies OpenShiftRequest)
      .then((r) => r.data),

  close: (shiftId: string, closingCash: number, notes?: string) =>
    apiClient
      .post<void>(`/api/shifts/${shiftId}/close`, {
        shiftId,
        closingCash,
        notes,
      } satisfies CloseShiftRequest)
      .then((r) => r.data),
};
