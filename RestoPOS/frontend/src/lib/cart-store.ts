import { create } from "zustand";
import { persist } from "zustand/middleware";
import { priceCart } from "./currency";
import type { MenuItemDto, ModifierDto, OrderDto, OrderType } from "./types";

export type CartLine = {
  menuItemId: string;
  title: string;
  unitPrice: number;
  taxInclusive: boolean;
  discountPercent: number;
  quantity: number;
  ticketStation: string;
  notes: string;
  categoryId: string;
  modifiers: { id: string; name: string; extraPrice: number; quantity: number; addonId?: string }[];
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
  updateLine: (lineIndex: number, quantity: number, modifiers: ModifierDto[], notes: string) => void;
  updateQty: (lineIndex: number, quantity: number) => void;
  removeLine: (lineIndex: number) => void;
  clear: () => void;
  hydrateServer: (orderId: string, orderNumber: string) => void;
  loadDraft: (order: OrderDto) => void;
  totals: () => ReturnType<typeof priceCart>;
};

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
          menuItemId: item.id,
          title: item.title,
          unitPrice: item.basePrice,
          taxInclusive: item.taxInclusive,
          discountPercent: item.discountPercent > 0 ? item.discountPercent : item.categoryDiscountPercent ?? 0,
          quantity,
          ticketStation: item.ticketStation,
          notes,
          categoryId: item.categoryId,
          modifiers: modifiers.map((m) => ({
            id: m.id,
            name: m.name,
            extraPrice: m.extraPrice,
            quantity: m.quantity ?? 1,
            addonId: m.addonId,
          })),
        };
        set((s) => {
          const existingIndex = s.lines.findIndex((current) => current.menuItemId === line.menuItemId);
          if (existingIndex < 0) return { lines: [...s.lines, line], dirty: true };
          return {
            lines: s.lines.map((current, index) =>
              index === existingIndex ? { ...current, quantity: current.quantity + quantity } : current,
            ),
            dirty: true,
          };
        });
      },
      updateLine: (lineIndex, quantity, modifiers, notes) =>
        set((s) => ({
          lines: s.lines.map((line, index) =>
            index === lineIndex
              ? {
                  ...line,
                  quantity,
                  notes,
                  modifiers: modifiers.map((m) => ({
                    id: m.id,
                    name: m.name,
                    extraPrice: m.extraPrice,
                    quantity: m.quantity ?? 1,
                    addonId: m.addonId,
                  })),
                }
              : line,
          ),
          dirty: true,
        })),
      updateQty: (lineIndex, quantity) =>
        set((s) => ({
          lines:
            quantity <= 0
              ? s.lines.filter((_, index) => index !== lineIndex)
              : s.lines.map((l, index) => (index === lineIndex ? { ...l, quantity } : l)),
          dirty: true,
        })),
      removeLine: (lineIndex) =>
        set((s) => ({ lines: s.lines.filter((_, index) => index !== lineIndex), dirty: true })),
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
      loadDraft: (order) =>
        set({
          orderType: order.orderType,
          tableNumber: order.tableNumber ?? "",
          customerPhone: order.customerPhone ?? "",
          notes: order.notes ?? "",
          discountPercent: order.discountPercent,
          discountAmount: order.discountAmount,
          vatRate: order.taxRate,
          lines: order.items.map((item) => ({
            menuItemId: item.menuItemId,
            title: item.title,
            unitPrice: item.unitPrice,
            taxInclusive: true,
            discountPercent: item.discountPercent ?? 0,
            quantity: item.quantity,
            ticketStation: item.ticketStation,
            notes: item.notes ?? "",
            categoryId: "",
            modifiers: item.modifiers.map((modifier) => ({
              id: modifier.addonId ?? modifier.menuItemModifierId ?? "",
              name: modifier.name,
              extraPrice: modifier.extraPrice,
              quantity: modifier.quantity,
              addonId: modifier.addonId ?? undefined,
            })),
          })),
          serverOrderId: order.id,
          serverOrderNumber: order.orderNumber,
          dirty: false,
        }),
      totals: () => {
        const s = get();
        return priceCart(s.lines, s.vatRate, s.discountPercent, s.discountAmount);
      },
    }),
    { name: "toastiran-pos-cart" },
  ),
);
