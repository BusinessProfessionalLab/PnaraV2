import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { shiftKeys } from "@/api/keys";
import type { PaginatedList, ShiftDto } from "@/lib/types";

export interface OpenShiftVariables {
  openingCash: number;
  notes?: string;
}

export interface CloseShiftVariables {
  shiftId: string;
  closingCash: number;
  notes?: string;
}

export interface CashDrawerVariables {
  shiftId: string;
  amountRials: number;
  reason: string;
}

/** ShiftsController — `api/shifts` (cashier shift + cash drawer). */
export const shiftsApi = {
  current: () =>
    apiClient.get<ShiftDto | null>("/api/shifts/current").then((r) => r.data),

  history: (page = 1, pageSize = 50) =>
    apiClient
      .get<PaginatedList<ShiftDto> | ShiftDto[]>("/api/shifts/history", {
        params: { page, pageSize },
      })
      .then((r) => r.data),

  open: (openingCash: number, notes?: string) =>
    apiClient
      .post<string>("/api/shifts/open", { openingCash, notes })
      .then((r) => r.data),

  close: (shiftId: string, closingCash: number, notes?: string) =>
    apiClient
      .post<void>(`/api/shifts/${shiftId}/close`, {
        shiftId,
        closingCash,
        notes,
      })
      .then((r) => r.data),

  cashDrop: (shiftId: string, amountRials: number, reason: string) =>
    apiClient
      .post<string>(`/api/shifts/${shiftId}/cash-drop`, {
        shiftId,
        amountRials,
        reason,
      })
      .then((r) => r.data),

  paidOut: (shiftId: string, amountRials: number, reason: string) =>
    apiClient
      .post<string>(`/api/shifts/${shiftId}/paid-out`, {
        shiftId,
        amountRials,
        reason,
      })
      .then((r) => r.data),
};

/** The currently open (or absent) cashier shift. */
export function useCurrentShift() {
  return useQuery({
    queryKey: shiftKeys.all,
    queryFn: shiftsApi.current,
  });
}

export function useShiftHistory(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: shiftKeys.history(page, pageSize),
    queryFn: () => shiftsApi.history(page, pageSize),
  });
}

export function useOpenShift() {
  return useMutation({
    mutationFn: ({ openingCash, notes }: OpenShiftVariables) =>
      shiftsApi.open(openingCash, notes),
  });
}

export function useCloseShift() {
  return useMutation({
    mutationFn: ({ shiftId, closingCash, notes }: CloseShiftVariables) =>
      shiftsApi.close(shiftId, closingCash, notes),
  });
}

export function useCashDrop() {
  return useMutation({
    mutationFn: ({ shiftId, amountRials, reason }: CashDrawerVariables) =>
      shiftsApi.cashDrop(shiftId, amountRials, reason),
  });
}

export function usePaidOut() {
  return useMutation({
    mutationFn: ({ shiftId, amountRials, reason }: CashDrawerVariables) =>
      shiftsApi.paidOut(shiftId, amountRials, reason),
  });
}
