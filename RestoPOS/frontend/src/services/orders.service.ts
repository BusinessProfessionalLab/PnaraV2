import { apiClient } from "@/api/client";
import type {
  OrderDto,
  OrderStatus,
  OrderType,
  PaginatedList,
} from "@/lib/types";

export interface CreateDraftOrderRequest {
  orderType: OrderType;
  tableNumber: string | null;
  customerPhone: string | null;
  notes: string | null;
  diningTableId: string | null;
}

export interface AddOrderItemModifierRequest {
  menuItemModifierId: string | null;
  quantity: number;
  addonId: string | null;
}

export interface AddOrderItemRequest {
  orderId: string;
  menuItemId: string;
  quantity: number;
  notes: string | null;
  modifiers: AddOrderItemModifierRequest[] | null;
}

export interface ApplyDiscountRequest {
  orderId: string;
  percent: number;
  amount: number;
}

export interface ApplyServiceChargeRequest {
  orderId: string;
  amount: number;
}

export interface UpdateOrderNotesRequest {
  orderId: string;
  notes: string | null;
}

export interface SplitBillRequest {
  orderId: string;
  orderItemIds: string[];
}

export interface MergeBillsRequest {
  sourceOrderId: string;
  targetOrderId: string;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  status: OrderStatus;
}

export interface CancelOrderRequest {
  orderId: string;
  reason: string | null;
}

export interface OrderHistoryParams {
  fromUtc?: string;
  toUtc?: string;
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
}

/** Orders domain: draft lifecycle, live orders, billing and status changes. */
export const ordersService = {
  /** Creates an empty draft; lines are appended with `addItem`. */
  createDraft: (payload: CreateDraftOrderRequest) =>
    apiClient.post<OrderDto>("/api/orders/drafts", payload).then((r) => r.data),

  draftOrders: () =>
    apiClient.get<OrderDto[]>("/api/orders/drafts").then((r) => r.data),

  getOrder: (id: string) =>
    apiClient.get<OrderDto>(`/api/orders/${id}`).then((r) => r.data),

  activeOrders: () =>
    apiClient.get<OrderDto[]>("/api/orders/active").then((r) => r.data),

  history: (params: OrderHistoryParams = {}) =>
    apiClient
      .get<PaginatedList<OrderDto>>("/api/orders/history", { params })
      .then((r) => r.data),

  addItem: (orderId: string, payload: Omit<AddOrderItemRequest, "orderId">) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/items`, {
        ...payload,
        orderId,
      } satisfies AddOrderItemRequest)
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
      } satisfies ApplyDiscountRequest)
      .then((r) => r.data),

  applyServiceCharge: (orderId: string, amount: number) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/service-charge`, {
        orderId,
        amount,
      } satisfies ApplyServiceChargeRequest)
      .then((r) => r.data),

  updateNotes: (orderId: string, notes: string | null) =>
    apiClient
      .put<OrderDto>(`/api/orders/${orderId}/notes`, {
        orderId,
        notes,
      } satisfies UpdateOrderNotesRequest)
      .then((r) => r.data),

  splitBill: (orderId: string, orderItemIds: string[]) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/split`, {
        orderId,
        orderItemIds,
      } satisfies SplitBillRequest)
      .then((r) => r.data),

  mergeBills: (sourceOrderId: string, targetOrderId: string) =>
    apiClient
      .post<OrderDto>("/api/orders/merge", {
        sourceOrderId,
        targetOrderId,
      } satisfies MergeBillsRequest)
      .then((r) => r.data),

  submitOrder: (orderId: string) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/submit`)
      .then((r) => r.data),

  updateOrderStatus: (orderId: string, status: OrderStatus) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/status`, {
        orderId,
        status,
      } satisfies UpdateOrderStatusRequest)
      .then((r) => r.data),

  discardDraft: (orderId: string) =>
    apiClient.delete<void>(`/api/orders/${orderId}/draft`).then((r) => r.data),

  cancelOrder: (orderId: string, reason: string | null = null) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/cancel`, {
        orderId,
        reason,
      } satisfies CancelOrderRequest)
      .then((r) => r.data),
};
