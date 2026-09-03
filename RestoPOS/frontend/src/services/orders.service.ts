import { apiClient } from "@/api/client";
import type { OrderDto, OrderStatus, OrderType } from "@/lib/types";

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
  customerPhone: string | null;
  notes: string | null;
  items: DraftOrderItem[];
}

export interface ApplyDiscountRequest {
  orderId: string;
  percent: number;
  amount: number;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  status: OrderStatus;
}

export interface CancelOrderRequest {
  orderId: string;
  reason?: string;
}

/** Orders domain: draft lifecycle, live orders, status changes. */
export const ordersService = {
  createDraft: (payload: CreateDraftRequest) =>
    apiClient.post<OrderDto>("/api/orders/drafts", payload).then((r) => r.data),

  draftOrders: () =>
    apiClient.get<OrderDto[]>("/api/orders/drafts").then((r) => r.data),

  getOrder: (id: string) =>
    apiClient.get<OrderDto>(`/api/orders/${id}`).then((r) => r.data),

  activeOrders: () =>
    apiClient.get<OrderDto[]>("/api/orders/active").then((r) => r.data),

  addItem: (orderId: string, payload: Record<string, unknown>) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/items`, payload)
      .then((r) => r.data),

  removeItem: (orderId: string, itemId: string) =>
    apiClient
      .delete<OrderDto>(`/api/orders/${orderId}/items/${itemId}`)
      .then((r) => r.data),

  applyDiscount: (orderId: string, percent: number, amount: number) =>
    apiClient
      .post<OrderDto>("/api/orders/" + orderId + "/discount", {
        orderId,
        percent,
        amount,
      } satisfies ApplyDiscountRequest)
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

  cancelOrder: (orderId: string, reason?: string) =>
    apiClient
      .post<OrderDto>(`/api/orders/${orderId}/cancel`, {
        orderId,
        reason,
      } satisfies CancelOrderRequest)
      .then((r) => r.data),
};
