import { apiClient } from "@/api/client";
import type { OrderDto, PaymentDto, PosDeviceDto } from "@/lib/types";

export interface CashPaymentRequest {
  orderId: string;
  amount: number;
}

export interface CardToCardPaymentRequest {
  orderId: string;
  amount: number;
  referenceNumber: string;
}

export interface PosInitiateRequest {
  orderId: string;
  deviceId: string;
}

/** Payments domain: cash, card-to-card and local POS-terminal payments. */
export const paymentsService = {
  payCash: (orderId: string, amount: number) =>
    apiClient
      .post<OrderDto>("/api/payments/cash", { orderId, amount } satisfies CashPaymentRequest)
      .then((r) => r.data),

  payCardToCard: (orderId: string, amount: number, referenceNumber: string) =>
    apiClient
      .post<OrderDto>("/api/payments/card-to-card", {
        orderId,
        amount,
        referenceNumber,
      } satisfies CardToCardPaymentRequest)
      .then((r) => r.data),

  initiatePos: (orderId: string, deviceId: string) =>
    apiClient
      .post<PaymentDto>("/api/payments/pos/initiate", {
        orderId,
        deviceId,
      } satisfies PosInitiateRequest)
      .then((r) => r.data),

  pollPos: (paymentId: string) =>
    apiClient
      .get<PaymentDto>(`/api/payments/pos/${paymentId}/poll`)
      .then((r) => r.data),

  posDevices: () =>
    apiClient.get<PosDeviceDto[]>("/api/payments/devices").then((r) => r.data),

  payOnline: (orderId: string, amount: number, referenceNumber: string) =>
    apiClient
      .post<OrderDto>("/api/payments/online", { orderId, amount, referenceNumber })
      .then((r) => r.data),

  paymentsByOrder: (orderId: string) =>
    apiClient.get<PaymentDto[]>(`/api/payments/by-order/${orderId}`).then((r) => r.data),

  voidPayment: (paymentId: string, reason?: string) =>
    apiClient
      .post<PaymentDto>(`/api/payments/${paymentId}/void`, { paymentId, reason })
      .then((r) => r.data),

  refundPayment: (paymentId: string, amount: number, reason?: string) =>
    apiClient
      .post<PaymentDto>(`/api/payments/${paymentId}/refund`, { paymentId, amount, reason })
      .then((r) => r.data),

  listPosDevicesAdmin: () =>
    apiClient.get<PosDeviceDto[]>("/api/pos-devices").then((r) => r.data),

  createPosDevice: (payload: unknown) =>
    apiClient.post<string>("/api/pos-devices", payload).then((r) => r.data),

  updatePosDevice: (id: string, payload: unknown) =>
    apiClient.put<void>(`/api/pos-devices/${id}`, { ...(payload as object), id }).then((r) => r.data),

  deletePosDevice: (id: string) =>
    apiClient.delete<void>(`/api/pos-devices/${id}`).then((r) => r.data),

  testPosDevice: (id: string) =>
    apiClient.post<{ ok?: boolean; message?: string } | string>(`/api/pos-devices/${id}/test`).then((r) => r.data),
};
