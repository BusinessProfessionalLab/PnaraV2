import { create } from "zustand";
import { persist } from "zustand/middleware";
import { priceCart } from "./currency";
import type { MenuItemDto, ModifierDto, OrderType } from "./types";

export type CartLine = {
  clientId: string;
  menuItemId: string;
  title: string;
  unitPrice: number;
  taxInclusive: boolean;
  quantity: number;
  ticketStation: string;
  notes: string;
  categoryId: string;
  modifiers: { id: string; name: string; extraPrice: number; quantity: number }[];
};

type CartState = {
  orderType: OrderType;
  tableNumber: string;
  customerPhone: string;
  notes: string;
  discountPercent: number;
  discountAmount: number;
  vatRate: number;
  lines: CartLine[];
  serverOrderId: string | null;
  serverOrderNumber: string | null;
  dirty: boolean;
  setMeta: (patch: Partial<Pick<CartState, "orderType" | "tableNumber" | "customerPhone" | "notes" | "discountPercent" | "discountAmount" | "vatRate">>) => void;
  setVatRate: (vatRate: number) => void;
  addLine: (item: MenuItemDto, quantity: number, modifiers: ModifierDto[], notes?: string) => void;
  updateQty: (clientId: string, quantity: number) => void;
  removeLine: (clientId: string) => void;
  clear: () => void;
  hydrateServer: (orderId: string, orderNumber: string) => void;
  totals: () => ReturnType<typeof priceCart>;
};

function id() {
  const g = typeof globalThis === "undefined" ? undefined : (globalThis as { crypto?: Crypto }).crypto;

  if (g?.randomUUID) {
    return g.randomUUID();
  }

  if (g?.getRandomValues) {
    const bytes = new Uint8Array(16);
    g.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      orderType: "DineIn",
      tableNumber: "",
      customerPhone: "",
      notes: "",
      discountPercent: 0,
      discountAmount: 0,
      vatRate: 0.1,
      lines: [],
      serverOrderId: null,
      serverOrderNumber: null,
      dirty: false,
      setMeta: (patch) => set({ ...patch, dirty: true }),
      setVatRate: (vatRate: number) => set({ vatRate }),
      addLine: (item, quantity, modifiers, notes = "") => {
        const line: CartLine = {
          clientId: id(),
          menuItemId: item.id,
          title: item.title,
          unitPrice: item.basePrice,
          taxInclusive: item.taxInclusive,
          quantity,
          ticketStation: item.ticketStation,
          notes,
          categoryId: item.categoryId,
          modifiers: modifiers.map((m) => ({
            id: m.id,
            name: m.name,
            extraPrice: m.extraPrice,
            quantity: 1,
          })),
        };
        set((s) => ({ lines: [...s.lines, line], dirty: true }));
      },
      updateQty: (clientId, quantity) =>
        set((s) => ({
          lines:
            quantity <= 0
              ? s.lines.filter((l) => l.clientId !== clientId)
              : s.lines.map((l) => (l.clientId === clientId ? { ...l, quantity } : l)),
          dirty: true,
        })),
      removeLine: (clientId) =>
        set((s) => ({ lines: s.lines.filter((l) => l.clientId !== clientId), dirty: true })),
      clear: () =>
        set({
          lines: [],
          serverOrderId: null,
          serverOrderNumber: null,
          notes: "",
          discountAmount: 0,
          discountPercent: 0,
          dirty: false,
        }),
      hydrateServer: (orderId, orderNumber) =>
        set({ serverOrderId: orderId, serverOrderNumber: orderNumber, dirty: false }),
      totals: () => {
        const s = get();
        return priceCart(s.lines, s.vatRate, s.discountPercent, s.discountAmount);
      },
    }),
    { name: "toastiran-pos-cart" },
  ),
);
