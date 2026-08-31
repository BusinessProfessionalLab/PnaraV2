import { ApiError, api } from "./api";
import { useCartStore } from "./cart-store";
import type { OrderDto } from "./types";

export async function syncCartToServer(): Promise<OrderDto> {
  const cart = useCartStore.getState();
  if (!cart.lines.length) throw new Error("سبد خرید خالی است.");

  const snapshot = {
    ...cart,
    lines: [...cart.lines],
  };

  const draftPayload = {
    orderType: snapshot.orderType,
    tableNumber: snapshot.tableNumber || null,
    customerPhone: snapshot.customerPhone || null,
    notes: snapshot.notes || null,
  };

  const syncOnce = async (retryCount = 0): Promise<OrderDto> => {
    const state = useCartStore.getState();
    if (state.serverOrderId) {
      try {
        await api.discardDraft(state.serverOrderId);
      } catch {
        /* draft may already be gone */
      }
    }

    const draft = await api.createDraft(draftPayload);

    try {
      let last = draft;
      for (const line of snapshot.lines) {
        last = await api.addItem(last.id, {
          orderId: last.id,
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          notes: line.notes || null,
          modifiers: line.modifiers.map((m) => ({ menuItemModifierId: m.id, quantity: m.quantity })),
        });
      }
      if (snapshot.discountPercent || snapshot.discountAmount) {
        last = await api.applyDiscount(last.id, snapshot.discountPercent, snapshot.discountAmount);
      }
      useCartStore.getState().hydrateServer(last.id, last.orderNumber);
      return last;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && retryCount === 0) {
        try {
          await api.discardDraft(draft.id);
        } catch {
          /* partial draft may already be gone */
        }
        return syncOnce(1);
      }
      throw error;
    }
  };

  return syncOnce();
}
