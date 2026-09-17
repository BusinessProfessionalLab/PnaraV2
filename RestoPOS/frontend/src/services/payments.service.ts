import { apiClient } from "@/api/client";
import type { OrderDto, PaymentDto, PosDeviceDto } from "@/lib/types";

export interface InitiatePosPaymentRequest {
  orderId: string;
  deviceId: string;
}

export interface ConfirmCashPaymentRequest {
  orderId: string;
  amount: number;
}

export interface RecordCardToCardRequest {
  orderId: string;
  amount: number;
  referenceNumber: string | null;
}

export interface RecordOnlineGatewayRequest {
  orderId: string;
  amount: number;
  referenceNumber: string | null;
}

export interface VoidPaymentRequest {
  paymentId: string;
  reason: string | null;
}

export interface RefundPaymentRequest {
  paymentId: string;
  amount: number;
  reason: string | null;
  voidOrder: boolean;
}

/** Payments domain: cash, card-to-card, gateway and local POS terminals. */
export const paymentsService = {
  initiatePos: (orderId: string, deviceId: string) =>
    apiClient
      .post<PaymentDto>("/api/payments/pos/initiate", {
        orderId,
        deviceId,
      } satisfies InitiatePosPaymentRequest)
      .then((r) => r.data),

  pollPos: (paymentId: string) =>
    apiClient
      .get<PaymentDto>(`/api/payments/pos/${paymentId}/poll`)
      .then((r) => r.data),

  payCash: (orderId: string, amount: number) =>
    apiClient
      .post<OrderDto>("/api/payments/cash", { orderId, amount } satisfies ConfirmCashPaymentRequest)
      .then((r) => r.data),

  payCardToCard: (orderId: string, amount: number, referenceNumber: string | null) =>
    apiClient
      .post<OrderDto>("/api/payments/card-to-card", {
        orderId,
        amount,
        referenceNumber,
      } satisfies RecordCardToCardRequest)
      .then((r) => r.data),

  recordOnline: (orderId: string, amount: number, referenceNumber: string | null) =>
    apiClient
      .post<OrderDto>("/api/payments/online", {
        orderId,
        amount,
        referenceNumber,
      } satisfies RecordOnlineGatewayRequest)
      .then((r) => r.data),

  byOrder: (orderId: string) =>
    apiClient
      .get<PaymentDto[]>(`/api/payments/by-order/${orderId}`)
      .then((r) => r.data),

  voidPayment: (paymentId: string, reason: string | null = null) =>
    apiClient
      .post<PaymentDto>(`/api/payments/${paymentId}/void`, {
        paymentId,
        reason,
      } satisfies VoidPaymentRequest)
      .then((r) => r.data),

  refund: (
    paymentId: string,
    amount: number,
    reason: string | null = null,
    voidOrder = false,
  ) =>
    apiClient
      .post<PaymentDto>(`/api/payments/${paymentId}/refund`, {
        paymentId,
        amount,
        reason,
        voidOrder,
      } satisfies RefundPaymentRequest)
      .then((r) => r.data),

  /** Bank-card terminals configured for the store. */
  posDevices: (activeOnly = true) =>
    apiClient
      .get<PosDeviceDto[]>("/api/payments/devices", { params: { activeOnly } })
      .then((r) => r.data),
};
