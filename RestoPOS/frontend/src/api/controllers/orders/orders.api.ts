import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { inventoryKeys, orderKeys } from "@/api/keys";
import type {
  OrderDto,
  OrderStatus,
  OrderType,
  PaginatedList,
} from "@/lib/types";

export interface DraftOrderItemModifier {
  menuItemModifierId?: string | null;
  addonId?: string | null;
  quantity: number;
}

export interface DraftOrderItem {
  menuItemId: string;
  quantity: number;
  notes?: string | null;
  modifiers: DraftOrderItemModifier[];
}

export interface CreateDraftRequest {
  orderType: OrderType;
  tableNumber: string | null;
  diningTableId?: string | null;
  customerPhone: string | null;
  notes: string | null;
  items: DraftOrderItem[];
}

export interface OrderHistoryParams {
  fromUtc?: string;
  toUtc?: string;
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
}

/** OrdersController — `api/orders` (draft lifecycle, live boards, status). */
export const ordersApi = {
  activeOrders: () =>
    apiClient.get<OrderDto[]>("/api/orders/active").then((r) => r.data),

  draftOrders: () =>
    apiClient.get<OrderDto[]>("/api/orders/drafts").then((r) => r.data),

  getOrder: (id: string) =>
    apiClient.get<OrderDto>(`/api/orders/${id}`).then((r) => r.data),

  orderHistory: (params: OrderHistoryParams = {}) =>
    apiClient
      .get<PaginatedList<OrderDto>>("/api/orders/history", { params })
      .then((r) => r.data),

  createDraft: (payload: CreateDraftRequest) =>
    apiClient.post<OrderDto>("/api/orders/drafts", payload).then((r) => r.data),

  addItem: (orderId: string, payload: DraftOrderItem) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/items`, payload)
      .then((r) => r.data),

  removeItem: (orderId: string, itemId: string) =>
    apiClient
      .delete<OrderDto>(`/api/orders/${orderId}/items/${itemId}`)
      .then((r) => r.data),

  applyDiscount: (orderId: string, percent: number, amount: number) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/discount`, {
        orderId,
        percent,
        amount,
      })
      .then((r) => r.data),

  applyServiceCharge: (orderId: string, amount: number) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/service-charge`, {
        orderId,
        amount,
      })
      .then((r) => r.data),

  updateNotes: (orderId: string, notes: string | null) =>
    apiClient
      .put<OrderDto>(`/api/orders/${orderId}/notes`, { orderId, notes })
      .then((r) => r.data),

  splitOrder: (orderId: string, orderItemIds: string[]) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/split`, { orderId, orderItemIds })
      .then((r) => r.data),

  mergeOrders: (targetOrderId: string, sourceOrderId: string) =>
    apiClient
      .post<OrderDto>("/api/orders/merge", { targetOrderId, sourceOrderId })
      .then((r) => r.data),

  submitOrder: (orderId: string) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/submit`)
      .then((r) => r.data),

  updateOrderStatus: (orderId: string, status: OrderStatus) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/status`, { orderId, status })
      .then((r) => r.data),

  discardDraft: (orderId: string) =>
    apiClient.delete<void>(`/api/orders/${orderId}/draft`).then((r) => r.data),

  cancelOrder: (orderId: string, reason?: string) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/cancel`, { orderId, reason })
      .then((r) => r.data),
};

/* --------------------------------- hooks -------------------------------- */

export interface PollingOptions {
  /** Automatic background refetch interval in ms (default: off). */
  refetchInterval?: number | false;
}

/** All orders currently flowing through kitchen/bar (Submitted…Ready). */
export function useActiveOrders(options?: PollingOptions) {
  return useQuery({
    queryKey: orderKeys.active,
    queryFn: ordersApi.activeOrders,
    refetchInterval: options?.refetchInterval,
  });
}

/** Orders that still await payment — polled by the POS register. */
export function useActiveUnpaidOrders() {
  return useQuery({
    queryKey: orderKeys.unpaid,
    queryFn: async () => {
      const orders = await ordersApi.activeOrders();
      return orders.filter(
        (order) => order.status !== "Paid" && order.status !== "Cancelled",
      );
    },
    refetchInterval: 10_000,
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ""),
    queryFn: () => ordersApi.getOrder(id as string),
    enabled: Boolean(id),
  });
}

/** Fetches one order on demand (reopening a saved draft at the register). */
export function useGetOrder() {
  return useMutation({ mutationFn: ordersApi.getOrder });
}

export function useDraftOrders() {
  return useQuery({
    queryKey: orderKeys.drafts,
    queryFn: ordersApi.draftOrders,
  });
}

export function useOrderHistory(params: OrderHistoryParams = {}) {
  return useQuery({
    queryKey: [
      ...orderKeys.all,
      "history",
      {
        fromUtc: params.fromUtc,
        toUtc: params.toUtc,
        status: params.status,
        page: params.page,
        pageSize: params.pageSize,
      },
    ] as const,
    queryFn: () => ordersApi.orderHistory(params),
  });
}

/** Sends the synced draft to kitchen/bar. */
export function useSubmitOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ordersApi.submitOrder,
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
      ordersApi.updateOrderStatus(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orderKeys.active }),
  });
}

/** Removes a locally saved draft (cashier discard). */
export function useDiscardDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ordersApi.discardDraft,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orderKeys.unpaid }),
  });
}

function invalidateOrder(queryClient: ReturnType<typeof useQueryClient>) {
  return () => {
    queryClient.invalidateQueries({ queryKey: orderKeys.all });
    queryClient.invalidateQueries({ queryKey: orderKeys.unpaid });
  };
}

export function useCreateDraftOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ordersApi.createDraft,
    onSuccess: invalidateOrder(queryClient),
  });
}

export function useAddOrderItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: DraftOrderItem;
    }) => ordersApi.addItem(orderId, payload),
    onSuccess: invalidateOrder(queryClient),
  });
}

export function useRemoveOrderItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      itemId,
    }: {
      orderId: string;
      itemId: string;
    }) => ordersApi.removeItem(orderId, itemId),
    onSuccess: invalidateOrder(queryClient),
  });
}

export function useApplyDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      percent,
      amount,
    }: {
      orderId: string;
      percent: number;
      amount: number;
    }) => ordersApi.applyDiscount(orderId, percent, amount),
    onSuccess: invalidateOrder(queryClient),
  });
}

export function useApplyServiceCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, amount }: { orderId: string; amount: number }) =>
      ordersApi.applyServiceCharge(orderId, amount),
    onSuccess: invalidateOrder(queryClient),
  });
}

export function useUpdateOrderNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      notes,
    }: {
      orderId: string;
      notes: string | null;
    }) => ordersApi.updateNotes(orderId, notes),
    onSuccess: invalidateOrder(queryClient),
  });
}

export function useSplitOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      orderItemIds,
    }: {
      orderId: string;
      orderItemIds: string[];
    }) => ordersApi.splitOrder(orderId, orderItemIds),
    onSuccess: invalidateOrder(queryClient),
  });
}

export function useMergeOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      targetOrderId,
      sourceOrderId,
    }: {
      targetOrderId: string;
      sourceOrderId: string;
    }) => ordersApi.mergeOrders(targetOrderId, sourceOrderId),
    onSuccess: invalidateOrder(queryClient),
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      ordersApi.cancelOrder(orderId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.active });
      queryClient.invalidateQueries({ queryKey: orderKeys.unpaid });
    },
  });
}
