import { api } from "./api";
import { useCartStore } from "./cart-store";
import type { OrderDto } from "./types";

export async function syncCartToServer(): Promise<OrderDto> {
  const cart = useCartStore.getState();
  if (!cart.lines.length) throw new Error("سبد خالی است.");

  if (cart.serverOrderId) {
    try {
      await api.discardDraft(cart.serverOrderId);
    } catch {
      /* draft may already be gone */
    }
  }

  const draft = await api.createDraft({
    orderType: cart.orderType,
    tableNumber: cart.tableNumber || null,
    customerPhone: cart.customerPhone || null,
    notes: cart.notes || null,
  });

  let last = draft;
  for (const line of cart.lines) {
    last = await api.addItem(draft.id, {
      orderId: draft.id,
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      notes: line.notes || null,
      modifiers: line.modifiers.map((m) => ({ menuItemModifierId: m.id, quantity: m.quantity })),
    });
  }
  if (cart.discountPercent || cart.discountAmount) {
    last = await api.applyDiscount(draft.id, cart.discountPercent, cart.discountAmount);
  }
  useCartStore.getState().hydrateServer(last.id, last.orderNumber);
  return last;
}
