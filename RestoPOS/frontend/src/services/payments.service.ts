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
};
