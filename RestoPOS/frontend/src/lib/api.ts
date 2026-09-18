import { getAccessToken, getRefreshToken, useAuthStore } from "./auth-store";
import type {
  ApiResult,
  AuthResponse,
  BaseUnit,
  CardexRowDto,
  CategoryDto,
  CategorySalesDetailDto,
  CustomerDto,
  DashboardSummaryDto,
  DiningAreaDto,
  DiningTableDto,
  HourlyHeatmapRowDto,
  HourlySalesRow,
  InventoryItemDetailDto,
  InventoryItemListDto,
  InventoryTransactionListDto,
  InventoryValuationDto,
  MenuItemDto,
  MenuItemPerformanceReportDto,
  ModifierGroupDto,
  OrderDto,
  OrderStatus,
  PaginatedList,
  PaymentBreakdownReportDto,
  PaymentDto,
  PermissionCatalogItem,
  PosDeviceDto,
  ProductPerformanceRow,
  ProfitMarginReportDto,
  PurchaseInvoiceDetailDto,
  PurchaseInvoiceListDto,
  RecipeDto,
  RoleDto,
  SalesByCategoryRow,
  SalesByProductRow,
  SalesTimelineDto,
  ShiftDto,
  ShiftSummaryReportDto,
  StaffDto,
  StaffPerformanceRow,
  StockAlertRow,
  StockCountDetailDto,
  StockCountListDto,
  StockCountStatus,
  StockTransferDto,
  StockTransferStatus,
  StorageLocation,
  StoreSettingsDto,
  SupplierDto,
  TableStatus,
  TerminalReconciliationDto,
  TimelineInterval,
  TimePeriodPreset,
  WasteDetailDto,
  WasteReason,
  WasteReportRowDto,
} from "./types";

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
      const res = await fetch("/api/auth/refresh", {
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

export async function apiFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type") && init.body) {
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
      (body && typeof body === "object" && "detail" in body && String((body as { detail: unknown }).detail)) ||
      (body && typeof body === "object" && "title" in body && String((body as { title: unknown }).title)) ||
      (body && typeof body === "object" && "errors" in body && Array.isArray((body as ApiResult<unknown>).errors)
        ? (body as ApiResult<unknown>).errors!.join(" | ")
        : null) ||
      res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}

export function unwrapResult<T>(result: ApiResult<T> | T): T {
  if (result && typeof result === "object" && "succeeded" in (result as object)) {
    const r = result as ApiResult<T>;
    if (!r.succeeded) throw new ApiError(400, (r.errors ?? ["عملیات ناموفق"]).join(" | "), r);
    return r.value as T;
  }
  return result as T;
}

function q(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function mapInventoryItem(i: InventoryItemListDto) {
  return {
    ...i,
    unitOfMeasure: i.baseUnit,
    reorderPoint: i.minimumAlertStock,
    safetyStock: i.optimalStock,
    costPrice: i.lastPurchasePriceRials,
    averageCost: i.weightedAverageCostRials,
  };
}

export const api = {
  // ── Auth ──
  login: (userName: string, password: string) =>
    apiFetch<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ userName, password }) }),
  refresh: (refreshToken: string) =>
    apiFetch<AuthResponse>("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  health: () => apiFetch<{ product: string; status: string }>("/api/health"),

  // ── Staff / Roles ──
  staff: () => apiFetch<StaffDto[]>("/api/staff"),
  staffById: (staffId: string) => apiFetch<StaffDto>(`/api/staff/${staffId}`),
  createStaff: (payload: unknown) => apiFetch<string>("/api/staff", { method: "POST", body: JSON.stringify(payload) }),
  updateStaff: (staffId: string, payload: unknown) =>
    apiFetch<void>(`/api/staff/${staffId}`, { method: "PUT", body: JSON.stringify({ ...(payload as object), staffId }) }),
  deactivateStaff: (staffId: string) => apiFetch<void>(`/api/staff/${staffId}/deactivate`, { method: "POST" }),
  changeStaffPassword: (staffId: string, newPassword: string) =>
    apiFetch<void>(`/api/staff/${staffId}/password`, { method: "POST", body: JSON.stringify({ staffId, newPassword }) }),
  assignStaffRoles: (staffId: string, roles: string[]) =>
    apiFetch<void>(`/api/staff/${staffId}/roles`, { method: "POST", body: JSON.stringify({ staffId, roles }) }),
  staffRoles: () => apiFetch<RoleDto[]>("/api/staff/roles"),
  createStaffRole: (payload: unknown) => apiFetch<string>("/api/staff/roles", { method: "POST", body: JSON.stringify(payload) }),
  updateStaffRolePermissions: (roleId: string, permissions: string[]) =>
    apiFetch<void>(`/api/staff/roles/${roleId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ roleId, permissions }),
    }),
  roles: () => apiFetch<RoleDto[]>("/api/roles"),
  permissionCatalog: () => apiFetch<PermissionCatalogItem[]>("/api/roles/permissions"),
  createRole: (payload: unknown) => apiFetch<string>("/api/roles", { method: "POST", body: JSON.stringify(payload) }),
  updateRolePermissions: (roleId: string, permissions: string[]) =>
    apiFetch<void>(`/api/roles/${roleId}/permissions`, { method: "PUT", body: JSON.stringify({ roleId, permissions }) }),

  // ── Shifts ──
  currentShift: () => apiFetch<ShiftDto | null>("/api/shifts/current"),
  shiftHistory: (page = 1, pageSize = 50) =>
    apiFetch<PaginatedList<ShiftDto> | ShiftDto[]>(`/api/shifts/history${q({ page, pageSize })}`),
  openShift: (openingCash: number, notes?: string) =>
    apiFetch<string>("/api/shifts/open", { method: "POST", body: JSON.stringify({ openingCash, notes }) }),
  closeShift: (shiftId: string, closingCash: number, notes?: string) =>
    apiFetch<void>(`/api/shifts/${shiftId}/close`, {
      method: "POST",
      body: JSON.stringify({ shiftId, closingCash, notes }),
    }),
  cashDrop: (shiftId: string, amountRials: number, reason: string) =>
    apiFetch<string>(`/api/shifts/${shiftId}/cash-drop`, {
      method: "POST",
      body: JSON.stringify({ shiftId, amountRials, reason }),
    }),
  paidOut: (shiftId: string, amountRials: number, reason: string) =>
    apiFetch<string>(`/api/shifts/${shiftId}/paid-out`, {
      method: "POST",
      body: JSON.stringify({ shiftId, amountRials, reason }),
    }),

  // ── Menu ──
  categories: (includeHidden = false) =>
    apiFetch<CategoryDto[]>(`/api/menu/categories?includeHidden=${includeHidden}`),
  categoryById: (id: string) => apiFetch<CategoryDto>(`/api/menu/categories/${id}`),
  createCategory: (payload: unknown) =>
    apiFetch<string>("/api/menu/categories", { method: "POST", body: JSON.stringify(payload) }),
  updateCategory: (id: string, payload: unknown) =>
    apiFetch<void>(`/api/menu/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCategory: (id: string) => apiFetch<void>(`/api/menu/categories/${id}`, { method: "DELETE" }),
  reorderCategories: (orderedIds: string[]) =>
    apiFetch<void>("/api/menu/categories/reorder", { method: "PUT", body: JSON.stringify({ orderedIds }) }),
  menuItems: (activeOnly = true) => apiFetch<MenuItemDto[]>(`/api/menu/items?activeOnly=${activeOnly}`),
  menuItem: (id: string) => apiFetch<MenuItemDto>(`/api/menu/items/${id}`),
  createMenuItem: (payload: unknown) =>
    apiFetch<string>("/api/menu/items", { method: "POST", body: JSON.stringify(payload) }),
  updateMenuItem: (id: string, payload: unknown) =>
    apiFetch<void>(`/api/menu/items/${id}`, { method: "PUT", body: JSON.stringify({ ...(payload as object), id }) }),
  deleteMenuItem: (id: string) => apiFetch<void>(`/api/menu/items/${id}`, { method: "DELETE" }),
  toggleSoldOut: (id: string, isSoldOut: boolean) =>
    apiFetch<void>(`/api/menu/items/${id}/sold-out`, { method: "POST", body: JSON.stringify({ id, isSoldOut }) }),
  createModifier: (payload: unknown) =>
    apiFetch<string>("/api/menu/modifiers", { method: "POST", body: JSON.stringify(payload) }),
  updateModifier: (id: string, payload: unknown) =>
    apiFetch<void>(`/api/menu/modifiers/${id}`, { method: "PUT", body: JSON.stringify({ ...(payload as object), id }) }),
  deleteModifier: (id: string) => apiFetch<void>(`/api/menu/modifiers/${id}`, { method: "DELETE" }),
  modifierGroups: (menuItemId: string) =>
    apiFetch<ModifierGroupDto[]>(`/api/menu/items/${menuItemId}/modifier-groups`),
  createModifierGroup: (payload: unknown) =>
    apiFetch<string>("/api/menu/modifier-groups", { method: "POST", body: JSON.stringify(payload) }),
  updateModifierGroup: (id: string, payload: unknown) =>
    apiFetch<void>(`/api/menu/modifier-groups/${id}`, { method: "PUT", body: JSON.stringify({ ...(payload as object), id }) }),
  deleteModifierGroup: (id: string) => apiFetch<void>(`/api/menu/modifier-groups/${id}`, { method: "DELETE" }),
  addModifierGroupOption: (groupId: string, payload: unknown) =>
    apiFetch<string>(`/api/menu/modifier-groups/${groupId}/options`, { method: "POST", body: JSON.stringify(payload) }),
  upsertRecipe: (payload: unknown) =>
    apiFetch<string>("/api/menu/recipes", { method: "PUT", body: JSON.stringify(payload) }),
  getRecipe: (menuItemId: string) => apiFetch<RecipeDto | null>(`/api/menu/items/${menuItemId}/recipe`),
  deleteRecipe: (id: string) => apiFetch<void>(`/api/menu/recipes/${id}`, { method: "DELETE" }),

  // ── Orders ──
  createDraft: (payload: unknown) =>
    apiFetch<OrderDto>("/api/orders/drafts", { method: "POST", body: JSON.stringify(payload) }),
  addItem: (orderId: string, payload: unknown) =>
    apiFetch<OrderDto>(`/api/orders/${orderId}/items`, { method: "POST", body: JSON.stringify(payload) }),
  removeItem: (orderId: string, itemId: string) =>
    apiFetch<OrderDto>(`/api/orders/${orderId}/items/${itemId}`, { method: "DELETE" }),
  applyDiscount: (orderId: string, percent: number, amount: number) =>
    apiFetch<OrderDto>(`/api/orders/${orderId}/discount`, {
      method: "POST",
      body: JSON.stringify({ orderId, percent, amount }),
    }),
  applyServiceCharge: (orderId: string, amount: number) =>
    apiFetch<OrderDto>(`/api/orders/${orderId}/service-charge`, {
      method: "POST",
      body: JSON.stringify({ orderId, amount }),
    }),
  updateOrderNotes: (orderId: string, notes: string | null) =>
    apiFetch<OrderDto>(`/api/orders/${orderId}/notes`, {
      method: "PUT",
      body: JSON.stringify({ orderId, notes }),
    }),
  splitOrder: (orderId: string, orderItemIds: string[]) =>
    apiFetch<OrderDto>(`/api/orders/${orderId}/split`, {
      method: "POST",
      body: JSON.stringify({ orderId, orderItemIds }),
    }),
  mergeOrders: (targetOrderId: string, sourceOrderId: string) =>
    apiFetch<OrderDto>("/api/orders/merge", {
      method: "POST",
      body: JSON.stringify({ targetOrderId, sourceOrderId }),
    }),
  submitOrder: (orderId: string) => apiFetch<OrderDto>(`/api/orders/${orderId}/submit`, { method: "POST" }),
  updateOrderStatus: (orderId: string, status: string) =>
    apiFetch<OrderDto>(`/api/orders/${orderId}/status`, {
      method: "POST",
      body: JSON.stringify({ orderId, status }),
    }),
  discardDraft: (orderId: string) => apiFetch<void>(`/api/orders/${orderId}/draft`, { method: "DELETE" }),
  cancelOrder: (orderId: string, reason?: string) =>
    apiFetch<OrderDto>(`/api/orders/${orderId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ orderId, reason }),
    }),
  getOrder: (id: string) => apiFetch<OrderDto>(`/api/orders/${id}`),
  activeOrders: () => apiFetch<OrderDto[]>("/api/orders/active"),
  orderHistory: (params: { fromUtc?: string; toUtc?: string; status?: OrderStatus; page?: number; pageSize?: number } = {}) =>
    apiFetch<PaginatedList<OrderDto>>(`/api/orders/history${q(params)}`),

  // ── Payments ──
  payCash: (orderId: string, amount: number) =>
    apiFetch<OrderDto>("/api/payments/cash", { method: "POST", body: JSON.stringify({ orderId, amount }) }),
  payCardToCard: (orderId: string, amount: number, referenceNumber: string) =>
    apiFetch<OrderDto>("/api/payments/card-to-card", {
      method: "POST",
      body: JSON.stringify({ orderId, amount, referenceNumber }),
    }),
  payOnline: (orderId: string, amount: number, referenceNumber: string) =>
    apiFetch<OrderDto>("/api/payments/online", {
      method: "POST",
      body: JSON.stringify({ orderId, amount, referenceNumber }),
    }),
  initiatePos: (orderId: string, deviceId: string) =>
    apiFetch<PaymentDto>("/api/payments/pos/initiate", {
      method: "POST",
      body: JSON.stringify({ orderId, deviceId }),
    }),
  pollPos: (paymentId: string) => apiFetch<PaymentDto>(`/api/payments/pos/${paymentId}/poll`),
  paymentsByOrder: (orderId: string) => apiFetch<PaymentDto[]>(`/api/payments/by-order/${orderId}`),
  voidPayment: (paymentId: string, reason?: string) =>
    apiFetch<PaymentDto>(`/api/payments/${paymentId}/void`, {
      method: "POST",
      body: JSON.stringify({ paymentId, reason }),
    }),
  refundPayment: (paymentId: string, amount: number, reason?: string) =>
    apiFetch<PaymentDto>(`/api/payments/${paymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({ paymentId, amount, reason }),
    }),
  posDevices: () => apiFetch<PosDeviceDto[]>("/api/payments/devices"),
  listPosDevices: () => apiFetch<PosDeviceDto[]>("/api/pos-devices"),
  posDeviceById: (id: string) => apiFetch<PosDeviceDto>(`/api/pos-devices/${id}`),
  createPosDevice: (payload: unknown) =>
    apiFetch<string>("/api/pos-devices", { method: "POST", body: JSON.stringify(payload) }),
  updatePosDevice: (id: string, payload: unknown) =>
    apiFetch<void>(`/api/pos-devices/${id}`, { method: "PUT", body: JSON.stringify({ ...(payload as object), id }) }),
  deletePosDevice: (id: string) => apiFetch<void>(`/api/pos-devices/${id}`, { method: "DELETE" }),
  testPosDevice: (id: string) => apiFetch<{ ok: boolean; message?: string } | string>(`/api/pos-devices/${id}/test`, { method: "POST" }),

  // ── Inventory ──
  inventory: async () => {
    const res = await apiFetch<ApiResult<PaginatedList<InventoryItemListDto>> | PaginatedList<InventoryItemListDto> | InventoryItemListDto[]>(
      "/api/inventory/items?page=1&pageSize=200&activeOnly=true",
    );
    const unwrapped = unwrapResult(res as ApiResult<PaginatedList<InventoryItemListDto>> | PaginatedList<InventoryItemListDto>);
    const items = Array.isArray(unwrapped) ? unwrapped : unwrapped.items ?? [];
    return items.map(mapInventoryItem);
  },
  inventoryItemsPaged: async (params: {
    page?: number;
    pageSize?: number;
    category?: string;
    storageLocation?: StorageLocation;
    search?: string;
    activeOnly?: boolean;
  } = {}) => {
    const res = await apiFetch<ApiResult<PaginatedList<InventoryItemListDto>>>(`/api/inventory/items${q(params)}`);
    return unwrapResult(res);
  },
  inventoryItem: async (id: string) => {
    const res = await apiFetch<ApiResult<InventoryItemDetailDto>>(`/api/inventory/items/${id}`);
    return unwrapResult(res);
  },
  createInventoryItem: async (payload: unknown) => {
    const res = await apiFetch<ApiResult<string>>("/api/inventory/items", { method: "POST", body: JSON.stringify(payload) });
    return unwrapResult(res);
  },
  updateInventoryItem: async (id: string, payload: unknown) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/items/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...(payload as object), id }),
    });
    return unwrapResult(res);
  },
  deleteInventoryItem: async (id: string) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/items/${id}`, { method: "DELETE" });
    return unwrapResult(res);
  },
  lowStock: async () => {
    const res = await apiFetch<ApiResult<InventoryItemListDto[]>>("/api/inventory/low-stock");
    return unwrapResult(res).map(mapInventoryItem);
  },
  inventoryValuation: async () => {
    const res = await apiFetch<ApiResult<InventoryValuationDto>>("/api/inventory/valuation");
    return unwrapResult(res);
  },
  createPurchase: async (payload: unknown) => {
    const res = await apiFetch<ApiResult<string>>("/api/inventory/purchases", { method: "POST", body: JSON.stringify(payload) });
    return unwrapResult(res);
  },
  /** Maps legacy receive UI → approved purchase invoice */
  receiveStock: async (payload: {
    inventoryItemId: string;
    quantity: number;
    unitCost: number;
    notes?: string;
    batchReference?: string;
  }) => {
    return api.createPurchase({
      invoiceNumber: payload.batchReference || `RCV-${Date.now()}`,
      supplierName: "دریافت سریع",
      taxRials: 0,
      discountRials: 0,
      paymentStatus: "Paid",
      notes: payload.notes,
      items: [
        {
          inventoryItemId: payload.inventoryItemId,
          quantity: payload.quantity,
          unitPriceRials: payload.unitCost,
          lineDiscountRials: 0,
        },
      ],
    });
  },
  listPurchases: async (params: { page?: number; pageSize?: number; supplierId?: string; status?: string } = {}) => {
    const res = await apiFetch<ApiResult<PaginatedList<PurchaseInvoiceListDto>>>(`/api/inventory/purchases${q(params)}`);
    return unwrapResult(res);
  },
  getPurchase: async (id: string) => {
    const res = await apiFetch<ApiResult<PurchaseInvoiceDetailDto>>(`/api/inventory/purchases/${id}`);
    return unwrapResult(res);
  },
  createDraftPurchase: async (payload: unknown) => {
    const res = await apiFetch<ApiResult<string>>("/api/inventory/purchases/draft", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return unwrapResult(res);
  },
  updateDraftPurchase: async (id: string, payload: unknown) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/purchases/${id}/draft`, {
      method: "PUT",
      body: JSON.stringify({ ...(payload as object), id }),
    });
    return unwrapResult(res);
  },
  approvePurchase: async (id: string) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/purchases/${id}/approve`, { method: "POST" });
    return unwrapResult(res);
  },
  cancelPurchase: async (id: string) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/purchases/${id}/cancel`, { method: "POST" });
    return unwrapResult(res);
  },
  recordWaste: async (payload: { inventoryItemId: string; quantity: number; notes?: string } | { notes?: string; items: unknown[] }) => {
    const body =
      "items" in payload
        ? payload
        : {
            notes: payload.notes,
            items: [
              {
                inventoryItemId: payload.inventoryItemId,
                quantityInBase: payload.quantity,
                reason: "Spoilage" as WasteReason,
                notes: payload.notes,
              },
            ],
          };
    const res = await apiFetch<ApiResult<string>>("/api/inventory/waste", { method: "POST", body: JSON.stringify(body) });
    return unwrapResult(res);
  },
  wasteReports: async (params: { fromUtc?: string; toUtc?: string; reason?: WasteReason } = {}) => {
    const res = await apiFetch<ApiResult<WasteReportRowDto[]>>(`/api/inventory/waste/reports${q(params)}`);
    return unwrapResult(res);
  },
  listWaste: async (params: { fromUtc?: string; toUtc?: string; page?: number; pageSize?: number } = {}) => {
    const res = await apiFetch<ApiResult<PaginatedList<WasteDetailDto>>>(`/api/inventory/waste${q(params)}`);
    return unwrapResult(res);
  },
  getWaste: async (id: string) => {
    const res = await apiFetch<ApiResult<WasteDetailDto>>(`/api/inventory/waste/${id}`);
    return unwrapResult(res);
  },
  startStockCount: async (payload: unknown) => {
    const res = await apiFetch<ApiResult<string>>("/api/inventory/stock-counts/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return unwrapResult(res);
  },
  listStockCounts: async (params: { status?: StockCountStatus; page?: number; pageSize?: number } = {}) => {
    const res = await apiFetch<ApiResult<PaginatedList<StockCountListDto>>>(`/api/inventory/stock-counts${q(params)}`);
    return unwrapResult(res);
  },
  getStockCount: async (id: string) => {
    const res = await apiFetch<ApiResult<StockCountDetailDto>>(`/api/inventory/stock-counts/${id}`);
    return unwrapResult(res);
  },
  submitStockCounts: async (id: string, counts: { inventoryItemId: string; physicalCountQty: number }[]) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/stock-counts/${id}/counts`, {
      method: "PUT",
      body: JSON.stringify(counts),
    });
    return unwrapResult(res);
  },
  approveStockCount: async (id: string) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/stock-counts/${id}/approve`, { method: "POST" });
    return unwrapResult(res);
  },
  createTransfer: async (payload: unknown) => {
    const res = await apiFetch<ApiResult<string>>("/api/inventory/transfers", { method: "POST", body: JSON.stringify(payload) });
    return unwrapResult(res);
  },
  listTransfers: async (params: { status?: StockTransferStatus; inventoryItemId?: string; page?: number; pageSize?: number } = {}) => {
    const res = await apiFetch<ApiResult<PaginatedList<StockTransferDto>>>(`/api/inventory/transfers${q(params)}`);
    return unwrapResult(res);
  },
  completeTransfer: async (id: string) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/transfers/${id}/complete`, { method: "POST" });
    return unwrapResult(res);
  },
  cancelTransfer: async (id: string) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/transfers/${id}/cancel`, { method: "POST" });
    return unwrapResult(res);
  },
  cardex: async (itemId: string, fromUtc?: string, toUtc?: string) => {
    const res = await apiFetch<ApiResult<CardexRowDto[]>>(`/api/inventory/cardex/${itemId}${q({ fromUtc, toUtc })}`);
    return unwrapResult(res);
  },
  inventoryTx: async (inventoryItemId?: string, page = 1, pageSize = 100) => {
    const res = await apiFetch<ApiResult<PaginatedList<InventoryTransactionListDto>> | InventoryTransactionListDto[]>(
      `/api/inventory/transactions${q({ inventoryItemId, page, pageSize })}`,
    );
    const data = unwrapResult(res as ApiResult<PaginatedList<InventoryTransactionListDto>>);
    const items = Array.isArray(data) ? data : data.items ?? [];
    return items.map((t) => ({
      ...t,
      type: t.transactionType,
      quantity: t.quantityDelta,
      unitCost: t.unitCostRials,
      occurredAt: t.createdAtUtc,
    }));
  },
  listSuppliers: async (params: { page?: number; pageSize?: number; search?: string } = {}) => {
    const res = await apiFetch<ApiResult<PaginatedList<SupplierDto> | SupplierDto[]>>(`/api/inventory/suppliers${q(params)}`);
    return unwrapResult(res);
  },
  getSupplier: async (id: string) => {
    const res = await apiFetch<ApiResult<SupplierDto>>(`/api/inventory/suppliers/${id}`);
    return unwrapResult(res);
  },
  createSupplier: async (payload: unknown) => {
    const res = await apiFetch<ApiResult<string>>("/api/inventory/suppliers", { method: "POST", body: JSON.stringify(payload) });
    return unwrapResult(res);
  },
  updateSupplier: async (id: string, payload: unknown) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...(payload as object), id }),
    });
    return unwrapResult(res);
  },
  deleteSupplier: async (id: string) => {
    const res = await apiFetch<ApiResult>(`/api/inventory/suppliers/${id}`, { method: "DELETE" });
    return unwrapResult(res);
  },
  manualAdjustment: async (payload: { inventoryItemId: string; quantityDelta: number; notes?: string }) => {
    const res = await apiFetch<ApiResult<string>>("/api/inventory/adjustments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return unwrapResult(res);
  },

  // ── Customers ──
  customers: (term?: string) =>
    apiFetch<CustomerDto[]>(`/api/customers${term ? `?term=${encodeURIComponent(term)}` : ""}`),
  customersPaged: (page = 1, pageSize = 50, term?: string) =>
    apiFetch<PaginatedList<CustomerDto>>(`/api/customers/paged${q({ page, pageSize, term })}`),
  customerById: (id: string) => apiFetch<CustomerDto>(`/api/customers/by-id/${id}`),
  customerByPhone: (phone: string) => apiFetch<CustomerDto>(`/api/customers/${encodeURIComponent(phone)}`),
  createCustomer: (payload: unknown) =>
    apiFetch<CustomerDto>("/api/customers", { method: "POST", body: JSON.stringify(payload) }),
  updateCustomer: (id: string, payload: unknown) =>
    apiFetch<CustomerDto>(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify({ ...(payload as object), id }) }),
  deleteCustomer: (id: string) => apiFetch<void>(`/api/customers/${id}`, { method: "DELETE" }),
  adjustLoyalty: (id: string, pointsDelta: number, notes?: string) =>
    apiFetch<CustomerDto>(`/api/customers/${id}/loyalty`, {
      method: "POST",
      body: JSON.stringify({ id, pointsDelta, notes }),
    }),
  customerOrders: (id: string, page = 1, pageSize = 50) =>
    apiFetch<PaginatedList<OrderDto>>(`/api/customers/${id}/orders${q({ page, pageSize })}`),

  // ── Settings ──
  settings: () => apiFetch<StoreSettingsDto>("/api/settings"),
  updateSettings: (payload: unknown) =>
    apiFetch<StoreSettingsDto>("/api/settings", { method: "PUT", body: JSON.stringify(payload) }),

  // ── Tables ──
  diningAreas: (activeOnly = true) =>
    apiFetch<DiningAreaDto[]>(`/api/tables/areas${q({ activeOnly })}`),
  diningAreaById: (id: string) => apiFetch<DiningAreaDto>(`/api/tables/areas/${id}`),
  createDiningArea: (payload: unknown) =>
    apiFetch<string>("/api/tables/areas", { method: "POST", body: JSON.stringify(payload) }),
  updateDiningArea: (id: string, payload: unknown) =>
    apiFetch<void>(`/api/tables/areas/${id}`, { method: "PUT", body: JSON.stringify({ ...(payload as object), id }) }),
  deleteDiningArea: (id: string) => apiFetch<void>(`/api/tables/areas/${id}`, { method: "DELETE" }),
  diningTables: (activeOnly = true) => apiFetch<DiningTableDto[]>(`/api/tables${q({ activeOnly })}`),
  tablesByArea: (areaId: string, activeOnly = true) =>
    apiFetch<DiningTableDto[]>(`/api/tables/by-area/${areaId}${q({ activeOnly })}`),
  diningTableById: (id: string) => apiFetch<DiningTableDto>(`/api/tables/${id}`),
  createDiningTable: (payload: unknown) =>
    apiFetch<string>("/api/tables", { method: "POST", body: JSON.stringify(payload) }),
  updateDiningTable: (id: string, payload: unknown) =>
    apiFetch<void>(`/api/tables/${id}`, { method: "PUT", body: JSON.stringify({ ...(payload as object), id }) }),
  deleteDiningTable: (id: string) => apiFetch<void>(`/api/tables/${id}`, { method: "DELETE" }),
  updateTableStatus: (id: string, status: TableStatus) =>
    apiFetch<void>(`/api/tables/${id}/status`, { method: "POST", body: JSON.stringify({ id, status }) }),
  transferTable: (fromTableId: string, toTableId: string) =>
    apiFetch<void>("/api/tables/transfer", { method: "POST", body: JSON.stringify({ fromTableId, toTableId }) }),

  // ── Reports (legacy + new) ──
  reportProducts: (fromUtc: string, toUtc: string) =>
    apiFetch<SalesByProductRow[]>(`/api/reports/sales/products?fromUtc=${fromUtc}&toUtc=${toUtc}`),
  reportCategories: (fromUtc: string, toUtc: string) =>
    apiFetch<SalesByCategoryRow[]>(`/api/reports/sales/categories?fromUtc=${fromUtc}&toUtc=${toUtc}`),
  reportHourly: (fromUtc: string, toUtc: string) =>
    apiFetch<HourlySalesRow[]>(`/api/reports/sales/hourly?fromUtc=${fromUtc}&toUtc=${toUtc}`),
  reportPeak: (fromUtc: string, toUtc: string) =>
    apiFetch<HourlySalesRow[]>(`/api/reports/sales/peak-hours?fromUtc=${fromUtc}&toUtc=${toUtc}`),
  reportPerformance: (fromUtc: string, toUtc: string) =>
    apiFetch<ProductPerformanceRow[]>(`/api/reports/sales/performance?fromUtc=${fromUtc}&toUtc=${toUtc}`),
  reportStaff: (fromUtc: string, toUtc: string) =>
    apiFetch<StaffPerformanceRow[]>(`/api/reports/staff?fromUtc=${fromUtc}&toUtc=${toUtc}`),
  stockAlerts: () => apiFetch<StockAlertRow[]>("/api/reports/stock-alerts"),
  dashboardSummary: (preset: TimePeriodPreset = "Today", fromUtc?: string, toUtc?: string) =>
    apiFetch<DashboardSummaryDto>(`/api/reports/dashboard/summary${q({ preset, fromUtc, toUtc })}`),
  salesTimeline: (preset: TimePeriodPreset = "ThisMonth", interval: TimelineInterval = "Daily", fromUtc?: string, toUtc?: string) =>
    apiFetch<SalesTimelineDto>(`/api/reports/sales/timeline${q({ preset, interval, fromUtc, toUtc })}`),
  peakHoursHeatmap: (preset: TimePeriodPreset = "ThisMonth", fromUtc?: string, toUtc?: string) =>
    apiFetch<HourlyHeatmapRowDto[]>(`/api/reports/sales/peak-hours${q({ preset, fromUtc, toUtc })}`),
  paymentBreakdown: (preset: TimePeriodPreset = "Today", fromUtc?: string, toUtc?: string) =>
    apiFetch<PaymentBreakdownReportDto>(`/api/reports/payments/breakdown${q({ preset, fromUtc, toUtc })}`),
  terminalReports: (preset: TimePeriodPreset = "Today", fromUtc?: string, toUtc?: string) =>
    apiFetch<TerminalReconciliationDto[]>(`/api/reports/payments/terminals${q({ preset, fromUtc, toUtc })}`),
  menuItemsPerformance: (preset: TimePeriodPreset = "ThisMonth", topCount = 10, fromUtc?: string, toUtc?: string) =>
    apiFetch<MenuItemPerformanceReportDto>(
      `/api/reports/menu/items-performance${q({ preset, topCount, fromUtc, toUtc })}`,
    ),
  categorySalesDetail: (preset: TimePeriodPreset = "ThisMonth", fromUtc?: string, toUtc?: string) =>
    apiFetch<CategorySalesDetailDto[]>(`/api/reports/menu/category-sales${q({ preset, fromUtc, toUtc })}`),
  shiftZReport: (preset: TimePeriodPreset = "Today", cashierId?: string, fromUtc?: string, toUtc?: string) =>
    apiFetch<ShiftSummaryReportDto[]>(`/api/reports/shifts/z-report${q({ preset, cashierId, fromUtc, toUtc })}`),
  profitMargin: (preset: TimePeriodPreset = "ThisMonth", fromUtc?: string, toUtc?: string) =>
    apiFetch<ProfitMarginReportDto>(`/api/reports/cogs/profit-margin${q({ preset, fromUtc, toUtc })}`),
};

export type { BaseUnit };
