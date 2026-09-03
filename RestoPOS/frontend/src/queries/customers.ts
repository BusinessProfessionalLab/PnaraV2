import { useQuery } from "@tanstack/react-query";
import { customersService } from "@/services/customers.service";
import { customerKeys } from "./keys";

/**
 * Loyalty customer list. `term` is the server-side search filter, so it is
 * part of the query key — every distinct search is cached separately.
 */
export function useCustomers(term?: string) {
  return useQuery({
    queryKey: customerKeys.list(term),
    queryFn: () => customersService.list(term),
  });
}
