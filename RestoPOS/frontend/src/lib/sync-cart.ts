import { ApiError } from "@/api/errors";
import {
  ordersApi,
  type DraftOrderItem,
} from "@/api/controllers/orders/orders.api";
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

async function syncCartToServerInternal(): Promise<OrderDto> {
  const cart = useCartStore.getState();
  if (!cart.lines.length) throw new Error("سبد خرید خالی است.");
  const snapshot = {
    ...cart,
    lines: [...cart.lines],
  };

  const items: DraftOrderItem[] = snapshot.lines.map((line) => ({
    menuItemId: line.menuItemId,
    quantity: line.quantity,
    notes: line.notes || null,
    modifiers: line.modifiers.map((m) => ({
      menuItemModifierId: m.addonId ? null : m.id,
      addonId: m.addonId ?? null,
      quantity: m.quantity,
    })),
  }));

  if (cart.serverOrderId && !cart.dirty) {
    const order = await ordersApi.getOrder(cart.serverOrderId);
    if (order.status !== "Draft" || order.items.length > 0) return order;

    // Older servers ignored the items sent with the create-draft request. If
    // that left this browser linked to an empty draft, restore its local lines
    // through the existing add-item endpoint before returning it for payment.
    let restored = await addItemsToEmptyDraft(order, items);
    if (snapshot.discountPercent || snapshot.discountAmount) {
      restored = await ordersApi.applyDiscount(
        restored.id,
        snapshot.discountPercent,
        snapshot.discountAmount,
      );
    }
    useCartStore.getState().hydrateServer(restored.id, restored.orderNumber);
    return restored;
  }

  const draftPayload = {
    orderType: snapshot.orderType,
    tableNumber: snapshot.tableNumber || null,
    diningTableId: snapshot.diningTableId || null,
    customerPhone: snapshot.customerPhone || null,
    notes: snapshot.notes || null,
    items,
  };

  const syncOnce = async (retryCount = 0): Promise<OrderDto> => {
    const draft = await ordersApi.createDraft(draftPayload);

    try {
      // Keep this fallback for deployments where the API has not yet been
      // updated to accept items on CreateDraftOrderCommand.
      let last = await addItemsToEmptyDraft(draft, items);
      if (snapshot.discountPercent || snapshot.discountAmount) {
        last = await ordersApi.applyDiscount(
          last.id,
          snapshot.discountPercent,
          snapshot.discountAmount,
        );
      }
      useCartStore.getState().hydrateServer(last.id, last.orderNumber);
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

async function addItemsToEmptyDraft(order: OrderDto, items: DraftOrderItem[]): Promise<OrderDto> {
  if (order.items.length > 0 || items.length === 0) return order;

  let updated = order;
  for (const item of items) {
    updated = await ordersApi.addItem(order.id, item);
  }
  return updated;
}
