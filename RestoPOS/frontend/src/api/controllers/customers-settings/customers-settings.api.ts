import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { customerKeys, settingsKeys } from "@/api/keys";
import type {
  CustomerDto,
  OrderDto,
  PaginatedList,
  StoreSettingsDto,
} from "@/lib/types";

export interface CreateCustomerVariables {
  phoneNumber: string;
  fullName?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  personalityType?: string | null;
  favoriteProducts?: string[];
  tags?: string[];
  notes?: string | null;
  marketingConsent?: boolean;
  registrationSource?: string;
}

export type LoyaltyPointTransactionDto = {
  id: string;
  type: string;
  pointsDelta: number;
  balanceAfter: number;
  orderId?: string | null;
  notes?: string | null;
  occurredAtUtc: string;
};

export type LoyaltyTierRuleDto = {
  name: string;
  minimumVisits: number;
  minimumSpendRials: number;
  pointsMultiplier: number;
  cashbackPercent: number;
};

export type LoyaltyProgramSettingsDto = {
  earnMode: "Amount" | "Visit" | "Percent";
  earnAmountRials: number;
  earnPoints: number;
  earnEveryVisits: number;
  earnPercent: number;
  thankYouSmsEnabled: boolean;
  smsEnabled: boolean;
  smsQuietHoursStart: string;
  smsQuietHoursEnd: string;
  thankYouSmsTemplate: string;
  cashbackPercent: number;
  cashbackMaxRials: number;
  cashbackMinSpendRials: number;
  cashbackProductIds: string[];
  rewardPointsThreshold: number;
  rewardDiscountRials: number;
  rewardProductName: string;
  tiers: LoyaltyTierRuleDto[];
  lapsedCustomerDays: number;
};

export type LoyaltyCampaignDto = {
  id: string;
  name: string;
  body: string;
  queuedAtUtc: string;
  scheduledAtUtc?: string | null;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  convertedCount: number;
  attributedRevenueRials: number;
};

/**
 * CustomersAndSettingsController — the backend groups the `api/customers`
 * and `api/settings` routes in one controller, so they share one module here.
 */
export const customersSettingsApi = {
  /* ------------------------------ customers ----------------------------- */
  customers: (term?: string) =>
    apiClient
      .get<CustomerDto[]>("/api/customers", {
        params: term ? { term } : undefined,
      })
      .then((r) => r.data),

  customersPaged: (page = 1, pageSize = 50, term?: string) =>
    apiClient
      .get<PaginatedList<CustomerDto>>("/api/customers/paged", {
        params: { page, pageSize, term },
      })
      .then((r) => r.data),

  customerById: (id: string) =>
    apiClient.get<CustomerDto>(`/api/customers/by-id/${id}`).then((r) => r.data),

  customerByPhone: (phone: string) =>
    apiClient
      .get<CustomerDto>(`/api/customers/${encodeURIComponent(phone)}`)
      .then((r) => r.data),

  createCustomer: (payload: CreateCustomerVariables) =>
    apiClient.post<CustomerDto>("/api/customers", payload).then((r) => r.data),

  updateCustomer: (id: string, payload: Record<string, unknown>) =>
    apiClient
      .put<CustomerDto>(`/api/customers/${id}`, { ...payload, id })
      .then((r) => r.data),

  deleteCustomer: (id: string) =>
    apiClient.delete<void>(`/api/customers/${id}`).then((r) => r.data),

  adjustLoyalty: (id: string, pointsDelta: number, notes?: string) =>
    apiClient
      .post<CustomerDto>(`/api/customers/${id}/loyalty`, {
        id,
        pointsDelta,
        notes,
      })
      .then((r) => r.data),

  customerPointHistory: (id: string, page = 1, pageSize = 50) =>
    apiClient.get<PaginatedList<LoyaltyPointTransactionDto>>(`/api/customers/${id}/loyalty/transactions`, { params: { page, pageSize } }).then((r) => r.data),

  customerOrders: (id: string, page = 1, pageSize = 50) =>
    apiClient
      .get<PaginatedList<OrderDto>>(`/api/customers/${id}/orders`, {
        params: { page, pageSize },
      })
      .then((r) => r.data),

  registerOnlineCustomer: (payload: { phoneNumber: string; fullName: string; marketingConsent: boolean }) =>
    apiClient.post<CustomerDto>("/api/customers/online-registration", payload).then((r) => r.data),

  loyaltySettings: () =>
    apiClient.get<LoyaltyProgramSettingsDto>("/api/customers/loyalty/settings").then((r) => r.data),

  updateLoyaltySettings: (payload: LoyaltyProgramSettingsDto) =>
    apiClient.put<LoyaltyProgramSettingsDto>("/api/customers/loyalty/settings", payload).then((r) => r.data),

  loyaltyCampaigns: (page = 1, pageSize = 25) =>
    apiClient.get<PaginatedList<LoyaltyCampaignDto>>("/api/customers/loyalty/campaigns", { params: { page, pageSize } }).then((r) => r.data),

  queueLoyaltyCampaign: (payload: { name: string; body: string; customerIds?: string[]; filter?: Record<string, unknown>; scheduledAtUtc?: string | null }) =>
    apiClient.post<LoyaltyCampaignDto>("/api/customers/loyalty/campaigns", payload).then((r) => r.data),

  /* ------------------------------- settings ------------------------------ */
  settings: () =>
    apiClient.get<StoreSettingsDto>("/api/settings").then((r) => r.data),

  updateSettings: (payload: Record<string, unknown>) =>
    apiClient
      .put<StoreSettingsDto>("/api/settings", payload)
      .then((r) => r.data),
};

/* --------------------------------- hooks -------------------------------- */

export interface UseSettingsOptions {
  enabled?: boolean;
}

/** Current store settings (shared by admin, POS header and theme engine). */
export function useSettings(options?: UseSettingsOptions) {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: customersSettingsApi.settings,
    enabled: options?.enabled,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersSettingsApi.updateSettings,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

/**
 * Loyalty customer list. `term` is the server-side search filter, so it is
 * part of the query key — every distinct search is cached separately.
 */
export function useCustomers(term?: string) {
  return useQuery({
    queryKey: customerKeys.list(term),
    queryFn: () => customersSettingsApi.customers(term),
  });
}

export function useCustomersPaged(page = 1, pageSize = 50, term?: string) {
  return useQuery({
    queryKey: customerKeys.paged(page, pageSize, term),
    queryFn: () => customersSettingsApi.customersPaged(page, pageSize, term),
  });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ""),
    queryFn: () => customersSettingsApi.customerById(id as string),
    enabled: Boolean(id),
  });
}

export function useCustomerByPhone(phone: string | null) {
  return useQuery({
    queryKey: [...customerKeys.all, "phone", phone ?? ""] as const,
    queryFn: () => customersSettingsApi.customerByPhone(phone as string),
    enabled: Boolean(phone),
  });
}

export function useCustomerPointHistory(id: string | null) {
  return useQuery({
    queryKey: [...customerKeys.all, "loyalty-transactions", id ?? ""] as const,
    queryFn: () => customersSettingsApi.customerPointHistory(id as string),
    enabled: Boolean(id),
  });
}

export function useCustomerOrders(id: string | null) {
  return useQuery({
    queryKey: customerKeys.orders(id ?? ""),
    queryFn: () => customersSettingsApi.customerOrders(id as string),
    enabled: Boolean(id),
  });
}

export function useLoyaltySettings() {
  return useQuery({
    queryKey: [...customerKeys.all, "loyalty-settings"],
    queryFn: customersSettingsApi.loyaltySettings,
  });
}

export function useUpdateLoyaltySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersSettingsApi.updateLoyaltySettings,
    onSuccess: (settings) => queryClient.setQueryData([...customerKeys.all, "loyalty-settings"], settings),
  });
}

export function useLoyaltyCampaigns() {
  return useQuery({
    queryKey: [...customerKeys.all, "loyalty-campaigns"],
    queryFn: () => customersSettingsApi.loyaltyCampaigns(),
  });
}

export function useQueueLoyaltyCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersSettingsApi.queueLoyaltyCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...customerKeys.all, "loyalty-campaigns"] }),
  });
}

function invalidateCustomers(queryClient: ReturnType<typeof useQueryClient>) {
  return () => queryClient.invalidateQueries({ queryKey: customerKeys.all });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersSettingsApi.createCustomer,
    onSuccess: invalidateCustomers(queryClient),
  });
}

export function useRegisterOnlineCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersSettingsApi.registerOnlineCustomer,
    onSuccess: invalidateCustomers(queryClient),
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => customersSettingsApi.updateCustomer(id, payload),
    onSuccess: invalidateCustomers(queryClient),
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersSettingsApi.deleteCustomer,
    onSuccess: invalidateCustomers(queryClient),
  });
}

export function useAdjustLoyalty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      pointsDelta,
      notes,
    }: {
      id: string;
      pointsDelta: number;
      notes?: string;
    }) => customersSettingsApi.adjustLoyalty(id, pointsDelta, notes),
    onSuccess: invalidateCustomers(queryClient),
  });
}
