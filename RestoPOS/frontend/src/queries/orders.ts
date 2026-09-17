import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ordersService } from "@/services/orders.service";
import type { OrderHistoryParams } from "@/services/orders.service";
import type { OrderStatus } from "@/lib/types";
import { customerKeys, inventoryKeys, orderKeys } from "./keys";

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

/** Orders that already left the active board, filterable by range/status. */
export function useOrderHistory(params: OrderHistoryParams = {}) {
  return useQuery({
    queryKey: orderKeys.history(params),
    queryFn: () => ordersService.history(params),
  });
}

export function useDraftOrders() {
  return useQuery({
    queryKey: orderKeys.drafts,
    queryFn: ordersService.draftOrders,
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
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      ordersService.updateOrderStatus(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orderKeys.active }),
  });
}

/** Appends a line to a draft (the API creates drafts without items). */
export function useAddOrderItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      ...payload
    }: {
      orderId: string;
      menuItemId: string;
      quantity: number;
      notes: string | null;
      modifiers: { menuItemModifierId: string | null; quantity: number; addonId: string | null }[] | null;
    }) => ordersService.addItem(orderId, payload),
    onSuccess: (order) =>
      queryClient.setQueryData(orderKeys.detail(order.id), order),
  });
}

export function useApplyOrderDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, percent, amount }: { id: string; percent: number; amount: number }) =>
      ordersService.applyDiscount(id, percent, amount),
    onSuccess: (order) => queryClient.setQueryData(orderKeys.detail(order.id), order),
  });
}

export function useApplyServiceCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      ordersService.applyServiceCharge(id, amount),
    onSuccess: (order) => queryClient.setQueryData(orderKeys.detail(order.id), order),
  });
}

export function useUpdateOrderNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string | null }) =>
      ordersService.updateNotes(id, notes),
    onSuccess: (order) => queryClient.setQueryData(orderKeys.detail(order.id), order),
  });
}

/** Splits the given lines into their own bill. */
export function useSplitBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, orderItemIds }: { id: string; orderItemIds: string[] }) =>
      ordersService.splitBill(id, orderItemIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderKeys.unpaid }),
  });
}

export function useMergeBills() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceOrderId,
      targetOrderId,
    }: {
      sourceOrderId: string;
      targetOrderId: string;
    }) => ordersService.mergeBills(sourceOrderId, targetOrderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderKeys.unpaid }),
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string | null }) =>
      ordersService.cancelOrder(id, reason ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.unpaid });
      queryClient.invalidateQueries({ queryKey: orderKeys.active });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
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
