import { getAccessToken, getRefreshToken, useAuthStore } from "./auth-store";
import type { AuthResponse } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh() {
  const token = getRefreshToken();
  if (!token) return false;
  if (!refreshing) {
    refreshing = (async () => {
      const res = await fetch("http://192.168.100.249:5000/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!res.ok) {
        useAuthStore.getState().logout();
        return false;
      }
      const session = (await res.json()) as AuthResponse;
      useAuthStore.getState().setSession(session);
      return true;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type") &&
    init.body
  ) {
    headers.set("Content-Type", "application/json");
  }
  const access = getAccessToken();
  if (access) headers.set("Authorization", `Bearer ${access}`);

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && retry) {
    const ok = await tryRefresh();
    if (ok) return apiFetch<T>(path, init, false);
  }
  const body = await parse(res);
  if (!res.ok) {
    const message =
      (body &&
        typeof body === "object" &&
        "detail" in body &&
        String(body.detail)) ||
      (body &&
        typeof body === "object" &&
        "title" in body &&
        String(body.title)) ||
      res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}

export const api = {
  login: (userName: string, password: string) =>
    apiFetch<AuthResponse>("http://192.168.100.249:5000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ userName, password }),
    }),
  refresh: (refreshToken: string) =>
    apiFetch<AuthResponse>("http://192.168.100.249:5000/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
  staff: () =>
    apiFetch<import("./types").StaffDto[]>(
      "http://192.168.100.249:5000/api/staff",
    ),
  createStaff: (payload: unknown) =>
    apiFetch<string>("http://192.168.100.249:5000/api/staff", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  currentShift: () =>
    apiFetch<import("./types").ShiftDto | null>(
      "http://192.168.100.249:5000/api/shifts/current",
    ),
  openShift: (openingCash: number, notes?: string) =>
    apiFetch<string>("http://192.168.100.249:5000/api/shifts/open", {
      method: "POST",
      body: JSON.stringify({ openingCash, notes }),
    }),
  closeShift: (shiftId: string, closingCash: number, notes?: string) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/shifts/${shiftId}/close`, {
      method: "POST",
      body: JSON.stringify({ shiftId, closingCash, notes }),
    }),
  categories: (includeHidden = false) =>
    apiFetch<import("./types").CategoryDto[]>(
      `http://192.168.100.249:5000/api/menu/categories?includeHidden=${includeHidden}`,
    ),
  createCategory: (payload: unknown) =>
    apiFetch<string>("http://192.168.100.249:5000/api/menu/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategory: (id: string, payload: unknown) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/menu/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id: string) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/menu/categories/${id}`, {
      method: "DELETE",
    }),
  menuItems: (activeOnly = true) =>
    apiFetch<import("./types").MenuItemDto[]>(
      `http://192.168.100.249:5000/api/menu/items?activeOnly=${activeOnly}`,
    ),
  menuItem: (id: string) =>
    apiFetch<import("./types").MenuItemDto>(
      `http://192.168.100.249:5000/api/menu/items/${id}`,
    ),
  createMenuItem: (payload: unknown) =>
    apiFetch<string>("http://192.168.100.249:5000/api/menu/items", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateMenuItem: (id: string, payload: unknown) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/menu/items/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...(payload as object), id }),
    }),
  deleteMenuItem: (id: string) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/menu/items/${id}`, {
      method: "DELETE",
    }),
  createModifier: (payload: unknown) =>
    apiFetch<string>("http://192.168.100.249:5000/api/menu/modifiers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateModifier: (id: string, payload: unknown) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/menu/modifiers/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...(payload as object), id }),
    }),
  deleteModifier: (id: string) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/menu/modifiers/${id}`, {
      method: "DELETE",
    }),
  addons: (activeOnly = true) =>
    apiFetch<import("./types").AddonDto[]>(
      `http://192.168.100.249:5000/api/menu/addons?activeOnly=${activeOnly}`,
    ),
  createAddon: (payload: unknown) =>
    apiFetch<string>("http://192.168.100.249:5000/api/menu/addons", { method: "POST", body: JSON.stringify(payload) }),
  updateAddon: (id: string, payload: unknown) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/menu/addons/${id}`, { method: "PUT", body: JSON.stringify({ ...(payload as object), id }) }),
  deleteAddon: (id: string) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/menu/addons/${id}`, { method: "DELETE" }),
  attachAddon: (menuItemId: string, addonId: string) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/menu/items/${menuItemId}/addons/${addonId}`, { method: "POST" }),
  detachAddon: (menuItemId: string, addonId: string) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/menu/items/${menuItemId}/addons/${addonId}`, { method: "DELETE" }),
  upsertRecipe: (payload: unknown) =>
    apiFetch<string>("http://192.168.100.249:5000/api/menu/recipes", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  createDraft: (payload: unknown) =>
    apiFetch<import("./types").OrderDto>(
      "http://192.168.100.249:5000/api/orders/drafts",
      { method: "POST", body: JSON.stringify(payload) },
    ),
  draftOrders: () =>
    apiFetch<import("./types").OrderDto[]>(
      "http://192.168.100.249:5000/api/orders/drafts",
    ),
  addItem: (orderId: string, payload: unknown) =>
    apiFetch<import("./types").OrderDto>(
      `http://192.168.100.249:5000/api/orders/${orderId}/items`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  removeItem: (orderId: string, itemId: string) =>
    apiFetch<import("./types").OrderDto>(
      `http://192.168.100.249:5000/api/orders/${orderId}/items/${itemId}`,
      { method: "DELETE" },
    ),
  applyDiscount: (orderId: string, percent: number, amount: number) =>
    apiFetch<import("./types").OrderDto>(
      `http://192.168.100.249:5000/api/orders/${orderId}/discount`,
      {
        method: "POST",
        body: JSON.stringify({ orderId, percent, amount }),
      },
    ),
  submitOrder: (orderId: string) =>
    apiFetch<import("./types").OrderDto>(
      `http://192.168.100.249:5000/api/orders/${orderId}/submit`,
      { method: "POST" },
    ),
  updateOrderStatus: (orderId: string, status: string) =>
    apiFetch<import("./types").OrderDto>(
      `http://192.168.100.249:5000/api/orders/${orderId}/status`,
      {
        method: "POST",
        body: JSON.stringify({ orderId, status }),
      },
    ),
  discardDraft: (orderId: string) =>
    apiFetch<void>(`http://192.168.100.249:5000/api/orders/${orderId}/draft`, {
      method: "DELETE",
    }),
  cancelOrder: (orderId: string, reason?: string) =>
    apiFetch<import("./types").OrderDto>(
      `http://192.168.100.249:5000/api/orders/${orderId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ orderId, reason }),
      },
    ),
  getOrder: (id: string) =>
    apiFetch<import("./types").OrderDto>(
      `http://192.168.100.249:5000/api/orders/${id}`,
    ),
  activeOrders: () =>
    apiFetch<import("./types").OrderDto[]>(
      "http://192.168.100.249:5000/api/orders/active",
    ),
  payCash: (orderId: string, amount: number) =>
    apiFetch<import("./types").OrderDto>(
      "http://192.168.100.249:5000/api/payments/cash",
      {
        method: "POST",
        body: JSON.stringify({ orderId, amount }),
      },
    ),
  payCardToCard: (orderId: string, amount: number, referenceNumber: string) =>
    apiFetch<import("./types").OrderDto>(
      "http://192.168.100.249:5000/api/payments/card-to-card",
      {
        method: "POST",
        body: JSON.stringify({ orderId, amount, referenceNumber }),
      },
    ),
  initiatePos: (orderId: string, deviceId: string) =>
    apiFetch<import("./types").PaymentDto>(
      "http://192.168.100.249:5000/api/payments/pos/initiate",
      {
        method: "POST",
        body: JSON.stringify({ orderId, deviceId }),
      },
    ),
  pollPos: (paymentId: string) =>
    apiFetch<import("./types").PaymentDto>(
      `http://192.168.100.249:5000/api/payments/pos/${paymentId}/poll`,
    ),
  posDevices: () =>
    apiFetch<import("./types").PosDeviceDto[]>(
      "http://192.168.100.249:5000/api/payments/devices",
    ),
  inventory: () =>
    apiFetch<import("./types").InventoryItemDto[]>(
      "http://192.168.100.249:5000/api/inventory",
    ),
  lowStock: () =>
    apiFetch<import("./types").InventoryItemDto[]>(
      "http://192.168.100.249:5000/api/inventory/low-stock",
    ),
  inventoryTx: (inventoryItemId?: string) =>
    apiFetch<import("./types").InventoryTransactionDto[]>(
      `http://192.168.100.249:5000/api/inventory/transactions${inventoryItemId ? `?inventoryItemId=${inventoryItemId}` : ""}`,
    ),
  createInventoryItem: (payload: unknown) =>
    apiFetch<string>("http://192.168.100.249:5000/api/inventory/items", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  receiveStock: (payload: unknown) =>
    apiFetch<string>("http://192.168.100.249:5000/api/inventory/receive", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  recordWaste: (payload: unknown) =>
    apiFetch<string>("http://192.168.100.249:5000/api/inventory/waste", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  customers: (term?: string) =>
    apiFetch<import("./types").CustomerDto[]>(
      `http://192.168.100.249:5000/api/customers${term ? `?term=${encodeURIComponent(term)}` : ""}`,
    ),
  customerByPhone: (phone: string) =>
    apiFetch<import("./types").CustomerDto>(
      `http://192.168.100.249:5000/api/customers/${encodeURIComponent(phone)}`,
    ),
  settings: () =>
    apiFetch<import("./types").StoreSettingsDto>(
      "http://192.168.100.249:5000/api/settings",
    ),
  updateSettings: (payload: unknown) =>
    apiFetch<import("./types").StoreSettingsDto>(
      "http://192.168.100.249:5000/api/settings",
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  reportProducts: (fromUtc: string, toUtc: string) =>
    apiFetch<import("./types").SalesByProductRow[]>(
      `http://192.168.100.249:5000/api/reports/sales/products?fromUtc=${fromUtc}&toUtc=${toUtc}`,
    ),
  reportCategories: (fromUtc: string, toUtc: string) =>
    apiFetch<import("./types").SalesByCategoryRow[]>(
      `http://192.168.100.249:5000/api/reports/sales/categories?fromUtc=${fromUtc}&toUtc=${toUtc}`,
    ),
  reportHourly: (fromUtc: string, toUtc: string) =>
    apiFetch<import("./types").HourlySalesRow[]>(
      `http://192.168.100.249:5000/api/reports/sales/hourly?fromUtc=${fromUtc}&toUtc=${toUtc}`,
    ),
  reportPeak: (fromUtc: string, toUtc: string) =>
    apiFetch<import("./types").HourlySalesRow[]>(
      `http://192.168.100.249:5000/api/reports/sales/peak-hours?fromUtc=${fromUtc}&toUtc=${toUtc}`,
    ),
  reportPerformance: (fromUtc: string, toUtc: string) =>
    apiFetch<import("./types").ProductPerformanceRow[]>(
      `http://192.168.100.249:5000/api/reports/sales/performance?fromUtc=${fromUtc}&toUtc=${toUtc}`,
    ),
  reportStaff: (fromUtc: string, toUtc: string) =>
    apiFetch<import("./types").StaffPerformanceRow[]>(
      `http://192.168.100.249:5000/api/reports/staff?fromUtc=${fromUtc}&toUtc=${toUtc}`,
    ),
  stockAlerts: () =>
    apiFetch<import("./types").StockAlertRow[]>(
      "http://192.168.100.249:5000/api/reports/stock-alerts",
    ),
  health: () =>
    apiFetch<{ product: string; status: string }>(
      "http://192.168.100.249:5000/api/health",
    ),
};
