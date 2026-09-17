/**
 * Centralized query-key factories.
 *
 * Every query key in the app derives from these — components and mutations
 * never invent string keys, and invalidation always targets one scope.
 */

export const settingsKeys = {
  all: ["settings"] as const,
};

const staffRoot = ["staff"] as const;

export const staffKeys = {
  all: staffRoot,
  detail: (staffId: string) => [...staffRoot, "detail", staffId] as const,
  roles: [...staffRoot, "roles"] as const,
};

const roleRoot = ["roles"] as const;

export const roleKeys = {
  all: roleRoot,
  permissions: [...roleRoot, "permissions"] as const,
};

const shiftRoot = ["shift"] as const;

export const shiftKeys = {
  all: shiftRoot,
  history: (params: object) => [...shiftRoot, "history", params] as const,
};

export const healthKeys = {
  all: ["health"] as const,
};

const customerRoot = ["customers"] as const;

export const customerKeys = {
  all: customerRoot,
  list: (term?: string) => [...customerRoot, "list", term ?? ""] as const,
  paged: (page: number, pageSize: number, term?: string) =>
    [...customerRoot, "paged", { page, pageSize, term: term ?? "" }] as const,
  detail: (id: string) => [...customerRoot, "detail", id] as const,
  orders: (id: string, page: number, pageSize: number) =>
    [...customerRoot, "orders", id, { page, pageSize }] as const,
};

const menuRoot = ["menu"] as const;
const categoryRoot = [...menuRoot, "categories"] as const;
const menuItemRoot = [...menuRoot, "items"] as const;
const modifierGroupRoot = [...menuRoot, "modifier-groups"] as const;
const recipeRoot = [...menuRoot, "recipes"] as const;

export const categoryKeys = {
  all: categoryRoot,
  list: (includeHidden: boolean) => [...categoryRoot, "list", { includeHidden }] as const,
  detail: (id: string) => [...categoryRoot, "detail", id] as const,
};

export const menuItemKeys = {
  all: menuItemRoot,
  list: (activeOnly: boolean) => [...menuItemRoot, "list", { activeOnly }] as const,
  detail: (id: string) => [...menuItemRoot, "detail", id] as const,
};

export const modifierGroupKeys = {
  all: modifierGroupRoot,
  byItem: (menuItemId: string) => [...modifierGroupRoot, menuItemId] as const,
};

export const recipeKeys = {
  all: recipeRoot,
  byItem: (menuItemId: string) => [...recipeRoot, menuItemId] as const,
};

const inventoryRoot = ["inventory"] as const;

export const inventoryKeys = {
  all: inventoryRoot,
  list: (params: object) => [...inventoryRoot, "items", "list", params] as const,
  detail: (id: string) => [...inventoryRoot, "items", "detail", id] as const,
  lowStock: [...inventoryRoot, "items", "low-stock"] as const,
  valuation: [...inventoryRoot, "valuation"] as const,
  transactions: (params: object) => [...inventoryRoot, "transactions", params] as const,
  cardex: (itemId: string, params: object) =>
    [...inventoryRoot, "cardex", itemId, params] as const,
  purchases: (params: object) => [...inventoryRoot, "purchases", "list", params] as const,
  purchase: (id: string) => [...inventoryRoot, "purchases", "detail", id] as const,
  waste: (params: object) => [...inventoryRoot, "waste", "list", params] as const,
  wasteDetail: (id: string) => [...inventoryRoot, "waste", "detail", id] as const,
  wasteReports: (params: object) => [...inventoryRoot, "waste", "reports", params] as const,
  stockCounts: (params: object) =>
    [...inventoryRoot, "stock-counts", "list", params] as const,
  stockCount: (id: string) => [...inventoryRoot, "stock-counts", "detail", id] as const,
  transfers: (params: object) => [...inventoryRoot, "transfers", "list", params] as const,
  suppliers: (params: object) => [...inventoryRoot, "suppliers", "list", params] as const,
  supplier: (id: string) => [...inventoryRoot, "suppliers", "detail", id] as const,
};

export const stockAlertKeys = {
  all: ["stock-alerts"] as const,
};

const ordersRoot = ["orders"] as const;
const paymentsRoot = ["payments"] as const;

export const orderKeys = {
  all: ordersRoot,
  active: [...ordersRoot, "active"] as const,
  unpaid: [...ordersRoot, "unpaid"] as const,
  drafts: [...ordersRoot, "drafts"] as const,
  detail: (id: string) => [...ordersRoot, "detail", id] as const,
  history: (params: object) => [...ordersRoot, "history", params] as const,
};

export const paymentKeys = {
  all: paymentsRoot,
  devices: [...paymentsRoot, "devices"] as const,
  byOrder: (orderId: string) => [...paymentsRoot, "by-order", orderId] as const,
};

const posDeviceRoot = ["pos-devices"] as const;

export const posDeviceKeys = {
  all: posDeviceRoot,
  list: (activeOnly: boolean) => [...posDeviceRoot, "list", { activeOnly }] as const,
  detail: (id: string) => [...posDeviceRoot, "detail", id] as const,
};

const tableRoot = ["tables"] as const;

export const tableKeys = {
  all: tableRoot,
  areas: (activeOnly: boolean) => [...tableRoot, "areas", { activeOnly }] as const,
  area: (id: string) => [...tableRoot, "area", id] as const,
  list: (activeOnly: boolean) => [...tableRoot, "list", { activeOnly }] as const,
  byArea: (areaId: string, activeOnly: boolean) =>
    [...tableRoot, "by-area", areaId, { activeOnly }] as const,
  detail: (id: string) => [...tableRoot, "detail", id] as const,
};

const reportRoot = ["reports"] as const;

export const reportKeys = {
  all: reportRoot,
  dashboard: (params: object) => [...reportRoot, "dashboard", params] as const,
  timeline: (params: object) => [...reportRoot, "sales", "timeline", params] as const,
  peakHours: (params: object) => [...reportRoot, "sales", "peak-hours", params] as const,
  products: (fromUtc: string, toUtc: string) =>
    [...reportRoot, "products", { fromUtc, toUtc }] as const,
  categories: (fromUtc: string, toUtc: string) =>
    [...reportRoot, "categories", { fromUtc, toUtc }] as const,
  hourly: (fromUtc: string, toUtc: string) =>
    [...reportRoot, "hourly", { fromUtc, toUtc }] as const,
  performance: (fromUtc: string, toUtc: string) =>
    [...reportRoot, "performance", { fromUtc, toUtc }] as const,
  staff: (fromUtc: string, toUtc: string) =>
    [...reportRoot, "staff", { fromUtc, toUtc }] as const,
  paymentBreakdown: (params: object) =>
    [...reportRoot, "payments", "breakdown", params] as const,
  terminals: (params: object) => [...reportRoot, "payments", "terminals", params] as const,
  menuItemsPerformance: (params: object) =>
    [...reportRoot, "menu", "items-performance", params] as const,
  menuCategorySales: (params: object) =>
    [...reportRoot, "menu", "category-sales", params] as const,
  zReport: (params: object) => [...reportRoot, "shifts", "z-report", params] as const,
  profitMargin: (params: object) => [...reportRoot, "cogs", "profit-margin", params] as const,
};
