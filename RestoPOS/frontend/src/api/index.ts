/**
 * Public surface of the API architecture.
 *
 * · `apiClient` — the one shared axios instance
 * · `@/api/keys` — central query-key factories
 * · `@/api/controllers/*` — one module per backend controller, each holding
 *   its HTTP functions plus the `useQuery` / `useMutation` hooks that wrap them.
 */
export { apiClient } from "./axios";
export { ApiError, errorMessage, isApiError } from "./errors";
export { createQueryClient } from "./query-client";

export * from "./keys";

export { authApi, useLogin } from "./controllers/auth/auth.api";
export { healthApi, useHealth } from "./controllers/health/health.api";
export { shiftsApi, useCurrentShift, useShiftHistory, useOpenShift, useCloseShift, useCashDrop, usePaidOut } from "./controllers/shifts/shifts.api";
export {
  customersSettingsApi,
  useSettings,
  useUpdateSettings,
  useCustomers,
  useCustomersPaged,
  useCustomer,
  useCustomerByPhone,
  useCustomerOrders,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useAdjustLoyalty,
} from "./controllers/customers-settings/customers-settings.api";
export * from "./controllers/staff/staff.api";
export * from "./controllers/tables/tables.api";
export * from "./controllers/payments/payments.api";
export * from "./controllers/orders/orders.api";
export * from "./controllers/menu/menu.api";
export * from "./controllers/inventory/inventory.api";
export * from "./controllers/reports/reports.api";
