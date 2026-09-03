import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ordersService } from "@/services/orders.service";
import { inventoryKeys, orderKeys } from "./keys";

export interface PollingOptions {
  /** Automatic background refetch interval in ms (default: off). */
  refetchInterval?: number | false;
}

/** All orders currently flowing through kitchen/bar (Submitted…Ready). */
export function useActiveOrders(options?: PollingOptions) {
  return useQuery({
    queryKey: orderKeys.active,
    queryFn: ordersService.activeOrders,
    refetchInterval: options?.refetchInterval,
  });
}

/** Orders that still await payment — polled by the POS register. */
export function useActiveUnpaidOrders() {
  return useQuery({
    queryKey: orderKeys.unpaid,
    queryFn: async () => {
      const orders = await ordersService.activeOrders();
      return orders.filter(
        (order) => order.status !== "Paid" && order.status !== "Cancelled",
      );
    },
    refetchInterval: 10_000,
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? "none"),
    queryFn: () => ordersService.getOrder(id as string),
    enabled: Boolean(id),
  });
}

/** Fetches one order on demand (reopening a saved draft at the register). */
export function useGetOrder() {
  return useMutation({ mutationFn: ordersService.getOrder });
}

/** Sends the synced draft to kitchen/bar. */
export function useSubmitOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ordersService.submitOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.unpaid });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

/** Kitchen/bar board status progression. */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      ordersService.updateOrderStatus(id, status as never),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orderKeys.active }),
  });
}

/** Removes a locally saved draft (cashier discard). */
export function useDiscardDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ordersService.discardDraft,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orderKeys.unpaid }),
  });
}
