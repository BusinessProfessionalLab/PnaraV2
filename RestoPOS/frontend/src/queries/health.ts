import { useQuery } from "@tanstack/react-query";
import { healthService } from "@/services/health.service";
import { healthKeys } from "./keys";

/** Backend connectivity probe — drives the online/offline badge. */
export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: healthService.check,
    refetchInterval: 15_000,
  });
}
