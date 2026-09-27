import { apiClient } from "@/api/client";
import type { PaginatedList, ShiftDto, ShiftHistoryDto } from "@/lib/types";

export interface OpenShiftRequest {
  openingCash: number;
  notes: string | null;
}

export interface CloseShiftRequest {
  shiftId: string;
  closingCash: number;
  notes: string | null;
}

export interface AddCashDropRequest {
  shiftId: string;
  amountRials: number;
  reason: string | null;
}

export interface AddPaidOutRequest {
  shiftId: string;
  amountRials: number;
  reason: string | null;
}

export interface ShiftHistoryParams {
  fromUtc?: string;
  toUtc?: string;
  staffId?: string;
  page?: number;
  pageSize?: number;
}

/** Cashier shifts domain — pure API communication. */
export const shiftService = {
  /**
   * The currently open shift. The endpoint returns a `ShiftDto`; it is typed
   * nullable so callers keep handling “no open shift” without assertions.
   */
  current: () =>
    apiClient
      .get<ShiftDto | null>("/api/shifts/current")
      .then((r) => r.data),

  history: (params: ShiftHistoryParams = {}) =>
    apiClient
      .get<PaginatedList<ShiftHistoryDto>>("/api/shifts/history", { params })
      .then((r) => r.data),

  open: (openingCash: number, notes: string | null = null) =>
    apiClient
      .post<string>("/api/shifts/open", {
        openingCash,
        notes,
      } satisfies OpenShiftRequest)
      .then((r) => r.data),

  close: (shiftId: string, closingCash: number, notes: string | null = null) =>
    apiClient
      .post<void>(`/api/shifts/${shiftId}/close`, {
        shiftId,
        closingCash,
        notes,
      } satisfies CloseShiftRequest)
      .then((r) => r.data),

  addCashDrop: (shiftId: string, amountRials: number, reason: string | null = null) =>
    apiClient
      .post<string>(`/api/shifts/${shiftId}/cash-drop`, {
        shiftId,
        amountRials,
        reason,
      } satisfies AddCashDropRequest)
      .then((r) => r.data),

  addPaidOut: (shiftId: string, amountRials: number, reason: string | null = null) =>
    apiClient
      .post<string>(`/api/shifts/${shiftId}/paid-out`, {
        shiftId,
        amountRials,
        reason,
      } satisfies AddPaidOutRequest)
      .then((r) => r.data),
};
