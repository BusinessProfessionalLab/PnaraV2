import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shiftService } from "@/services/shift.service";
import type { ShiftHistoryParams } from "@/services/shift.service";
import { shiftKeys } from "./keys";

/** The currently open (or absent) cashier shift. */
export function useCurrentShift() {
  return useQuery({ queryKey: shiftKeys.all, queryFn: shiftService.current });
}

export function useShiftHistory(params: ShiftHistoryParams = {}) {
  return useQuery({
    queryKey: shiftKeys.history(params),
    queryFn: () => shiftService.history(params),
  });
}

export function useOpenShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ openingCash, notes }: { openingCash: number; notes?: string | null }) =>
      shiftService.open(openingCash, notes ?? null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftKeys.all }),
  });
}

export function useCloseShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      shiftId,
      closingCash,
      notes,
    }: {
      shiftId: string;
      closingCash: number;
      notes?: string | null;
    }) => shiftService.close(shiftId, closingCash, notes ?? null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftKeys.all }),
  });
}

/** Cash added to the drawer mid-shift (recorded as a movement). */
export function useAddCashDrop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      shiftId,
      amountRials,
      reason,
    }: {
      shiftId: string;
      amountRials: number;
      reason?: string | null;
    }) => shiftService.addCashDrop(shiftId, amountRials, reason ?? null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftKeys.all }),
  });
}

/** Cash taken out of the drawer mid-shift (petty cash, expenses). */
export function useAddPaidOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      shiftId,
      amountRials,
      reason,
    }: {
      shiftId: string;
      amountRials: number;
      reason?: string | null;
    }) => shiftService.addPaidOut(shiftId, amountRials, reason ?? null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftKeys.all }),
  });
}
