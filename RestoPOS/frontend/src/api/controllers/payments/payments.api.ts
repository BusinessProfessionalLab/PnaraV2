import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import {
  customerKeys,
  inventoryKeys,
  orderKeys,
  paymentKeys,
  posDeviceKeys,
} from "@/api/keys";
import type { OrderDto, PaymentDto, PosDeviceDto } from "@/lib/types";
import { ordersApi } from "@/api/controllers/orders/orders.api";

export interface PayCashVariables {
  orderId: string;
  amount: number;
}

export interface PayCardToCardVariables {
  orderId: string;
  amount: number;
  referenceNumber: string;
}

/**
 * PaymentsController — `api/payments` and `api/pos-devices`.
 * Cash / card / online settlement plus the terminal fleet.
 */
export const paymentsApi = {
  payCash: (orderId: string, amount: number) =>
    apiClient
      .post<OrderDto>("/api/payments/cash", { orderId, amount })
      .then((r) => r.data),

  payCardToCard: (orderId: string, amount: number, referenceNumber: string) =>
    apiClient
      .post<OrderDto>("/api/payments/card-to-card", {
        orderId,
        amount,
        referenceNumber,
      })
      .then((r) => r.data),

  payOnline: (orderId: string, amount: number, referenceNumber: string) =>
    apiClient
      .post<OrderDto>("/api/payments/online", {
        orderId,
        amount,
        referenceNumber,
      })
      .then((r) => r.data),

  initiatePos: (orderId: string, deviceId: string) =>
    apiClient
      .post<PaymentDto>("/api/payments/pos/initiate", { orderId, deviceId })
      .then((r) => r.data),

  pollPos: (paymentId: string) =>
    apiClient
      .get<PaymentDto>(`/api/payments/pos/${paymentId}/poll`)
      .then((r) => r.data),

  posDevices: () =>
    apiClient.get<PosDeviceDto[]>("/api/payments/devices").then((r) => r.data),

  paymentsByOrder: (orderId: string) =>
    apiClient
      .get<PaymentDto[]>(`/api/payments/by-order/${orderId}`)
      .then((r) => r.data),

  voidPayment: (paymentId: string, reason?: string) =>
    apiClient
      .post<PaymentDto>(`/api/payments/${paymentId}/void`, {
        paymentId,
        reason,
      })
      .then((r) => r.data),

  refundPayment: (paymentId: string, amount: number, reason?: string) =>
    apiClient
      .post<PaymentDto>(`/api/payments/${paymentId}/refund`, {
        paymentId,
        amount,
        reason,
      })
      .then((r) => r.data),

  /* ------------------------------ pos-devices ---------------------------- */
  listPosDevices: () =>
    apiClient.get<PosDeviceDto[]>("/api/pos-devices").then((r) => r.data),

  posDeviceById: (id: string) =>
    apiClient.get<PosDeviceDto>(`/api/pos-devices/${id}`).then((r) => r.data),

  createPosDevice: (payload: Record<string, unknown>) =>
    apiClient.post<string>("/api/pos-devices", payload).then((r) => r.data),

  updatePosDevice: (id: string, payload: Record<string, unknown>) =>
    apiClient
      .put<void>(`/api/pos-devices/${id}`, { ...payload, id })
      .then((r) => r.data),

  deletePosDevice: (id: string) =>
    apiClient.delete<void>(`/api/pos-devices/${id}`).then((r) => r.data),

  testPosDevice: (id: string) =>
    apiClient
      .post<{ ok?: boolean; message?: string } | string>(
        `/api/pos-devices/${id}/test`,
      )
      .then((r) => r.data),
};

/* --------------------------------- hooks -------------------------------- */

/** Invalidates everything a finished sale changes. */
function invalidateAfterSale(queryClient: ReturnType<typeof useQueryClient>) {
  return () => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    queryClient.invalidateQueries({ queryKey: customerKeys.all });
    queryClient.invalidateQueries({ queryKey: orderKeys.unpaid });
  };
}

export interface UsePosDevicesOptions {
  enabled?: boolean;
}

/** Bank-card terminals configured for the store. */
export function usePosDevices(options?: UsePosDevicesOptions) {
  return useQuery({
    queryKey: paymentKeys.devices,
    queryFn: paymentsApi.posDevices,
    enabled: options?.enabled,
  });
}

export function usePayCash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, amount }: PayCashVariables) =>
      paymentsApi.payCash(orderId, amount),
    onSuccess: invalidateAfterSale(queryClient),
  });
}

export function usePayCardToCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, amount, referenceNumber }: PayCardToCardVariables) =>
      paymentsApi.payCardToCard(orderId, amount, referenceNumber),
    onSuccess: invalidateAfterSale(queryClient),
  });
}

export function usePayOnline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, amount, referenceNumber }: PayCardToCardVariables) =>
      paymentsApi.payOnline(orderId, amount, referenceNumber),
    onSuccess: invalidateAfterSale(queryClient),
  });
}

/**
 * Local POS-terminal flow: submit the order when it is still a draft, ask the
 * device to settle, then poll until it reports Settled/Failed (max 45s).
 * Resolves with the fresh paid order so callers can print receipts.
 */
export function useSettleWithPos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      order,
      deviceId,
    }: {
      order: OrderDto;
      deviceId: string;
    }): Promise<OrderDto> => {
      const submitted =
        order.status === "Draft"
          ? await ordersApi.submitOrder(order.id)
          : order;
      const payment = await paymentsApi.initiatePos(submitted.id, deviceId);
      if (payment.status === "Settled") {
        return ordersApi.getOrder(submitted.id);
      }
      const started = Date.now();
      while (Date.now() - started < 45_000) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const polled = await paymentsApi.pollPos(payment.id);
        if (polled.status === "Settled") {
          return ordersApi.getOrder(submitted.id);
        }
        if (polled.status === "Failed") {
          throw new Error("تراکنش کارت‌خوان ناموفق بود.");
        }
      }
      throw new Error("زمان انتظار کارت‌خوان به پایان رسید.");
    },
    onSuccess: invalidateAfterSale(queryClient),
  });
}

export function usePaymentsByOrder(orderId: string | null) {
  return useQuery({
    queryKey: [...paymentKeys.all, "by-order", orderId ?? ""] as const,
    queryFn: () => paymentsApi.paymentsByOrder(orderId as string),
    enabled: Boolean(orderId),
  });
}

function invalidatePayments(queryClient: ReturnType<typeof useQueryClient>) {
  return () => {
    queryClient.invalidateQueries({ queryKey: paymentKeys.all });
    queryClient.invalidateQueries({ queryKey: orderKeys.all });
  };
}

export function useVoidPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason?: string }) =>
      paymentsApi.voidPayment(paymentId, reason),
    onSuccess: invalidatePayments(queryClient),
  });
}

export function useRefundPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paymentId,
      amount,
      reason,
    }: {
      paymentId: string;
      amount: number;
      reason?: string;
    }) => paymentsApi.refundPayment(paymentId, amount, reason),
    onSuccess: invalidatePayments(queryClient),
  });
}

/* pos-devices admin */

/** Terminal fleet read from the dedicated `api/pos-devices` route. */
export function usePosDevicesAdmin() {
  return useQuery({
    queryKey: posDeviceKeys.all,
    queryFn: paymentsApi.listPosDevices,
  });
}

export function usePosDevice(id: string | null) {
  return useQuery({
    queryKey: posDeviceKeys.detail(id ?? ""),
    queryFn: () => paymentsApi.posDeviceById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreatePosDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: paymentsApi.createPosDevice,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: posDeviceKeys.all }),
  });
}

export function useUpdatePosDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => paymentsApi.updatePosDevice(id, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: posDeviceKeys.all }),
  });
}

export function useDeletePosDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: paymentsApi.deletePosDevice,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: posDeviceKeys.all }),
  });
}

export function useTestPosDevice() {
  return useMutation({ mutationFn: paymentsApi.testPosDevice });
}
