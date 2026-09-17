import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ordersService } from "@/services/orders.service";
import { paymentsService } from "@/services/payments.service";
import type { OrderDto } from "@/lib/types";
import { customerKeys, inventoryKeys, orderKeys, paymentKeys } from "./keys";

export interface UsePosDevicesOptions {
  enabled?: boolean;
}

/** Bank-card terminals configured for the store. */
export function usePosDevices(options?: UsePosDevicesOptions) {
  return useQuery({
    queryKey: paymentKeys.devices,
    queryFn: () => paymentsService.posDevices(),
    enabled: options?.enabled,
  });
}

/** Payment attempts recorded against one order. */
export function useOrderPayments(orderId: string | null) {
  return useQuery({
    queryKey: paymentKeys.byOrder(orderId ?? "none"),
    queryFn: () => paymentsService.byOrder(orderId as string),
    enabled: Boolean(orderId),
  });
}

/** Invalidates everything a finished sale changes. */
function invalidateAfterSale(queryClient: ReturnType<typeof useQueryClient>) {
  return () => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    queryClient.invalidateQueries({ queryKey: customerKeys.all });
    queryClient.invalidateQueries({ queryKey: orderKeys.unpaid });
  };
}

export function usePayCash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, amount }: { orderId: string; amount: number }) =>
      paymentsService.payCash(orderId, amount),
    onSuccess: invalidateAfterSale(queryClient),
  });
}

export function usePayCardToCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      amount,
      referenceNumber,
    }: {
      orderId: string;
      amount: number;
      referenceNumber: string | null;
    }) => paymentsService.payCardToCard(orderId, amount, referenceNumber),
    onSuccess: invalidateAfterSale(queryClient),
  });
}

/** Manually recorded online-gateway settlement (back-office correction). */
export function useRecordOnlinePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      amount,
      referenceNumber,
    }: {
      orderId: string;
      amount: number;
      referenceNumber: string | null;
    }) => paymentsService.recordOnline(orderId, amount, referenceNumber),
    onSuccess: invalidateAfterSale(queryClient),
  });
}

export function useVoidPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason?: string | null }) =>
      paymentsService.voidPayment(paymentId, reason ?? null),
    onSuccess: invalidateAfterSale(queryClient),
  });
}

export function useRefundPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paymentId,
      amount,
      reason,
      voidOrder,
    }: {
      paymentId: string;
      amount: number;
      reason?: string | null;
      voidOrder?: boolean;
    }) =>
      paymentsService.refund(paymentId, amount, reason ?? null, voidOrder ?? false),
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
          ? await ordersService.submitOrder(order.id)
          : order;
      const payment = await paymentsService.initiatePos(submitted.id, deviceId);
      if (payment.status === "Settled") {
        return ordersService.getOrder(submitted.id);
      }
      const started = Date.now();
      while (Date.now() - started < 45_000) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const polled = await paymentsService.pollPos(payment.id);
        if (polled.status === "Settled") {
          return ordersService.getOrder(submitted.id);
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
