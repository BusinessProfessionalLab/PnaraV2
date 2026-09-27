import { ApiError } from "@/api/errors";
import { ordersService } from "@/services/orders.service";
import { useCartStore } from "./cart-store";
import type { OrderDto } from "./types";

let syncInFlight: Promise<OrderDto> | null = null;

export async function syncCartToServer(): Promise<OrderDto> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = syncCartToServerInternal().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

/**
 * Draft orders are created empty (`CreateDraftOrderCommand` carries no lines);
 * every cart line is then appended with `POST /api/orders/{orderId}/items`
 * before the order-level discount is applied.
 */
async function syncCartToServerInternal(): Promise<OrderDto> {
  const cart = useCartStore.getState();
  if (!cart.lines.length) throw new Error("سبد خرید خالی است.");
  if (cart.serverOrderId && !cart.dirty) {
    return ordersService.getOrder(cart.serverOrderId);
  }

  const snapshot = {
    ...cart,
    lines: [...cart.lines],
  };

  const syncOnce = async (retryCount = 0): Promise<OrderDto> => {
    const draft = await ordersService.createDraft({
      orderType: snapshot.orderType,
      tableNumber: snapshot.tableNumber || null,
      customerPhone: snapshot.customerPhone || null,
      notes: snapshot.notes || null,
      diningTableId: null,
    });

    try {
      let last = draft;
      for (const line of snapshot.lines) {
        last = await ordersService.addItem(last.id, {
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          notes: line.notes || null,
          modifiers: line.modifiers.length
            ? line.modifiers.map((modifier) => ({
                menuItemModifierId: modifier.id,
                addonId: modifier.addonId ?? null,
                quantity: modifier.quantity,
              }))
            : null,
        });
      }
      if (snapshot.discountPercent || snapshot.discountAmount) {
        last = await ordersService.applyDiscount(
          last.id,
          snapshot.discountPercent,
          snapshot.discountAmount,
        );
      }
      useCartStore.getState().hydrateServer(last.id, last.orderNumber ?? "");
      return last;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && retryCount === 0) {
        return syncOnce(1);
      }
      throw error;
    }
  };

  return syncOnce();
}
