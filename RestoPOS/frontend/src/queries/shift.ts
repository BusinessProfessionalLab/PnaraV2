import { useQuery } from "@tanstack/react-query";
import { shiftService } from "@/services/shift.service";
import { shiftKeys } from "./keys";

/** The currently open (or absent) cashier shift. */
export function useCurrentShift() {
  return useQuery({ queryKey: shiftKeys.all, queryFn: shiftService.current });
}
