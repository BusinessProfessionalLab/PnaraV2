/**
 * Centralized query-key factories.
 *
 * Every query key in the app derives from these — components and mutations
 * never invent string keys, and invalidation always targets one scope.
 */
export const settingsKeys = {
  all: ["settings"] as const,
};

export const staffKeys = {
  all: ["staff"] as const,
};

export const shiftKeys = {
  all: ["shift"] as const,
};

export const healthKeys = {
  all: ["health"] as const,
};

export const customerKeys = {
  all: ["customers"] as const,
  list: (term?: string) => [...customerKeys.all, "list", term ?? ""] as const,
};

export const categoryKeys = {
  all: ["categories"] as const,
  list: (includeHidden: boolean) =>
    [...categoryKeys.all, "list", { includeHidden }] as const,
};

export const menuItemKeys = {
  all: ["menu"] as const,
  list: (activeOnly: boolean) =>
    [...menuItemKeys.all, "items", { activeOnly }] as const,
  detail: (id: string) => [...menuItemKeys.all, "item", id] as const,
};

export const addonKeys = {
  all: ["addons"] as const,
  list: (activeOnly: boolean) => [...addonKeys.all, { activeOnly }] as const,
};

export const inventoryKeys = {
  all: ["inventory"] as const,
  transactions: (inventoryItemId?: string) =>
    [...inventoryKeys.all, "transactions", inventoryItemId ?? ""] as const,
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
};

export const paymentKeys = {
  all: paymentsRoot,
  devices: [...paymentsRoot, "devices"] as const,
};

export const reportKeys = {
  all: ["reports"] as const,
  products: (fromUtc: string, toUtc: string) =>
    [...reportKeys.all, "products", { fromUtc, toUtc }] as const,
  categories: (fromUtc: string, toUtc: string) =>
    [...reportKeys.all, "categories", { fromUtc, toUtc }] as const,
  hourly: (fromUtc: string, toUtc: string) =>
    [...reportKeys.all, "hourly", { fromUtc, toUtc }] as const,
  performance: (fromUtc: string, toUtc: string) =>
    [...reportKeys.all, "performance", { fromUtc, toUtc }] as const,
  staff: (fromUtc: string, toUtc: string) =>
    [...reportKeys.all, "staff", { fromUtc, toUtc }] as const,
};
