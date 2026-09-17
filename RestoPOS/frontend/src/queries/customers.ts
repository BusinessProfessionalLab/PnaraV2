import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customersService } from "@/services/customers.service";
import type {
  AdjustLoyaltyPointsRequest,
  CreateCustomerRequest,
  UpdateCustomerRequest,
} from "@/services/customers.service";
import { customerKeys, orderKeys } from "./keys";

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

export function usePagedCustomers(page = 1, pageSize = 50, term?: string) {
  return useQuery({
    queryKey: customerKeys.paged(page, pageSize, term),
    queryFn: () => customersService.paged(page, pageSize, term),
  });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? "none"),
    queryFn: () => customersService.byId(id as string),
    enabled: Boolean(id),
  });
}

export function useCustomerByPhone(phone: string | null) {
  return useQuery({
    queryKey: customerKeys.detail(`phone:${phone ?? ""}`),
    queryFn: () => customersService.byPhone(phone as string),
    enabled: Boolean(phone),
  });
}

export function useCustomerOrders(id: string | null, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: customerKeys.orders(id ?? "none", page, pageSize),
    queryFn: () => customersService.orders(id as string, page, pageSize),
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCustomerRequest) => customersService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Omit<UpdateCustomerRequest, "id">;
    }) => customersService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersService.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

/** Loyalty point correction (support gesture, campaign bonus, …). */
export function useAdjustLoyaltyPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: AdjustLoyaltyPointsRequest & { id: string }) =>
      customersService.adjustLoyaltyPoints(id, payload.delta, payload.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}
