/**
 * Centralized query-key factories.
 *
 * Every query key in the app derives from these — controller modules and
 * components never invent string keys, and invalidation always targets one
 * scope. Each backend controller owns its own key namespace.
 *
 * Each factory keeps its root as a local const so the object literal never
 * references itself (which confuses TypeScript's inference).
 */

/* ------------------------------- health -------------------------------- */

const healthRoot = ["health"] as const;
export const healthKeys = { all: healthRoot };

/* ------------------------------- settings ------------------------------ */

const settingsRoot = ["settings"] as const;
export const settingsKeys = { all: settingsRoot };

/* --------------------------- staff / roles ---------------------------- */

const staffRoot = ["staff"] as const;
export const staffKeys = {
  all: staffRoot,
  detail: (id: string) => [...staffRoot, "detail", id] as const,
  roles: [...staffRoot, "roles"] as const,
};

const rolesRoot = ["roles"] as const;
export const roleKeys = {
  all: rolesRoot,
  list: [...rolesRoot, "list"] as const,
  permissions: [...rolesRoot, "permissions"] as const,
};

/* -------------------------------- shifts ------------------------------- */

const shiftRoot = ["shift"] as const;
export const shiftKeys = {
  all: shiftRoot,
  history: (page: number, pageSize: number) =>
    [...shiftRoot, "history", { page, pageSize }] as const,
};

/* --------------------------------- menu -------------------------------- */

const categoryRoot = ["categories"] as const;
export const categoryKeys = {
  all: categoryRoot,
  list: (includeHidden: boolean) =>
    [...categoryRoot, "list", { includeHidden }] as const,
  detail: (id: string) => [...categoryRoot, "detail", id] as const,
};

const menuItemRoot = ["menu"] as const;
export const menuItemKeys = {
  all: menuItemRoot,
  list: (activeOnly: boolean) =>
    [...menuItemRoot, "items", { activeOnly }] as const,
  detail: (id: string) => [...menuItemRoot, "item", id] as const,
  groups: (menuItemId: string) =>
    [...menuItemRoot, "item", menuItemId, "groups"] as const,
  recipe: (menuItemId: string) =>
    [...menuItemRoot, "item", menuItemId, "recipe"] as const,
};

const addonRoot = ["addons"] as const;
export const addonKeys = {
  all: addonRoot,
  list: (activeOnly: boolean) => [...addonRoot, { activeOnly }] as const,
};

/* -------------------------------- orders ------------------------------- */

const ordersRoot = ["orders"] as const;
export const orderKeys = {
  all: ordersRoot,
  active: [...ordersRoot, "active"] as const,
  unpaid: [...ordersRoot, "unpaid"] as const,
  drafts: [...ordersRoot, "drafts"] as const,
  detail: (id: string) => [...ordersRoot, "detail", id] as const,
};

/* ------------------------------- payments ------------------------------ */

const paymentsRoot = ["payments"] as const;
export const paymentKeys = {
  all: paymentsRoot,
  devices: [...paymentsRoot, "devices"] as const,
};

const posDeviceRoot = ["pos-devices"] as const;
export const posDeviceKeys = {
  all: posDeviceRoot,
  detail: (id: string) => [...posDeviceRoot, "detail", id] as const,
};

/* ------------------------------- inventory ----------------------------- */

const inventoryRoot = ["inventory"] as const;
export const inventoryKeys = {
  all: inventoryRoot,
  item: (id: string) => [...inventoryRoot, "item", id] as const,
  lowStock: [...inventoryRoot, "low-stock"] as const,
  valuation: [...inventoryRoot, "valuation"] as const,
  transactions: (inventoryItemId?: string) =>
    [...inventoryRoot, "transactions", inventoryItemId ?? ""] as const,
  cardex: (itemId: string, fromUtc?: string, toUtc?: string) =>
    [...inventoryRoot, "cardex", itemId, { fromUtc, toUtc }] as const,
  purchases: (params: Record<string, unknown> = {}) =>
    [...inventoryRoot, "purchases", params] as const,
  purchase: (id: string) => [...inventoryRoot, "purchase", id] as const,
  waste: (params: Record<string, unknown> = {}) =>
    [...inventoryRoot, "waste", params] as const,
  wasteReports: (params: Record<string, unknown> = {}) =>
    [...inventoryRoot, "waste-reports", params] as const,
  wasteDetail: (id: string) => [...inventoryRoot, "waste", id] as const,
  stockCounts: (params: Record<string, unknown> = {}) =>
    [...inventoryRoot, "stock-counts", params] as const,
  stockCount: (id: string) => [...inventoryRoot, "stock-count", id] as const,
  transfers: (params: Record<string, unknown> = {}) =>
    [...inventoryRoot, "transfers", params] as const,
  suppliers: (params: Record<string, unknown> = {}) =>
    [...inventoryRoot, "suppliers", params] as const,
  supplier: (id: string) => [...inventoryRoot, "supplier", id] as const,
};

const stockAlertRoot = ["stock-alerts"] as const;
export const stockAlertKeys = { all: stockAlertRoot };

/* ------------------------------- customers ----------------------------- */

const customerRoot = ["customers"] as const;
export const customerKeys = {
  all: customerRoot,
  list: (term?: string) => [...customerRoot, "list", term ?? ""] as const,
  paged: (page: number, pageSize: number, term?: string) =>
    [...customerRoot, "paged", { page, pageSize, term: term ?? "" }] as const,
  detail: (id: string) => [...customerRoot, "detail", id] as const,
  orders: (id: string) => [...customerRoot, "orders", id] as const,
};

/* --------------------------------- tables ------------------------------ */

const diningAreaRoot = ["dining-areas"] as const;
export const diningAreaKeys = {
  all: diningAreaRoot,
  list: (activeOnly: boolean) =>
    [...diningAreaRoot, "list", { activeOnly }] as const,
  detail: (id: string) => [...diningAreaRoot, "detail", id] as const,
};

const diningTableRoot = ["dining-tables"] as const;
export const diningTableKeys = {
  all: diningTableRoot,
  list: (activeOnly: boolean) =>
    [...diningTableRoot, "list", { activeOnly }] as const,
  byArea: (areaId: string, activeOnly: boolean) =>
    [...diningTableRoot, "by-area", areaId, { activeOnly }] as const,
  detail: (id: string) => [...diningTableRoot, "detail", id] as const,
};

/* -------------------------------- reports ------------------------------ */

const reportRoot = ["reports"] as const;
export const reportKeys = {
  all: reportRoot,
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
  dashboard: (preset: string, fromUtc?: string | null, toUtc?: string | null) =>
    [...reportRoot, "dashboard", { preset, fromUtc, toUtc }] as const,
  timeline: (
    preset: string,
    interval: string,
    fromUtc?: string | null,
    toUtc?: string | null,
  ) => [...reportRoot, "timeline", { preset, interval, fromUtc, toUtc }] as const,
  heatmap: (preset: string, fromUtc?: string | null, toUtc?: string | null) =>
    [...reportRoot, "heatmap", { preset, fromUtc, toUtc }] as const,
  paymentBreakdown: (
    preset: string,
    fromUtc?: string | null,
    toUtc?: string | null,
  ) =>
    [...reportRoot, "payment-breakdown", { preset, fromUtc, toUtc }] as const,
  terminals: (preset: string, fromUtc?: string | null, toUtc?: string | null) =>
    [...reportRoot, "terminals", { preset, fromUtc, toUtc }] as const,
  menuPerformance: (
    preset: string,
    topCount: number,
    fromUtc?: string | null,
    toUtc?: string | null,
  ) =>
    [...reportRoot, "menu-performance", { preset, topCount, fromUtc, toUtc }] as const,
  categorySales: (
    preset: string,
    fromUtc?: string | null,
    toUtc?: string | null,
  ) => [...reportRoot, "category-sales", { preset, fromUtc, toUtc }] as const,
  zReport: (
    preset: string,
    cashierId?: string,
    fromUtc?: string | null,
    toUtc?: string | null,
  ) =>
    [...reportRoot, "z-report", { preset, cashierId, fromUtc, toUtc }] as const,
  profitMargin: (
    preset: string,
    fromUtc?: string | null,
    toUtc?: string | null,
  ) => [...reportRoot, "profit-margin", { preset, fromUtc, toUtc }] as const,
  customerReturn: (
    preset: string,
    fromUtc?: string | null,
    toUtc?: string | null,
  ) => [...reportRoot, "customer-return", { preset, fromUtc, toUtc }] as const,
};
