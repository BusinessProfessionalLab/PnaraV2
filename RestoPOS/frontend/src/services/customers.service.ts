import { apiClient } from "@/api/client";
import type { CustomerDto, OrderDto, PaginatedList } from "@/lib/types";

export interface CreateCustomerRequest {
  phoneNumber: string | null;
  fullName: string | null;
}

export interface UpdateCustomerRequest {
  id: string;
  fullName: string | null;
  phoneNumber: string | null;
}

export interface AdjustLoyaltyPointsRequest {
  customerId: string;
  delta: number;
  notes: string | null;
}

/** Loyalty customers domain — pure API communication. */
export const customersService = {
  list: (term?: string) =>
    apiClient
      .get<CustomerDto[]>("/api/customers", {
        params: term ? { term } : undefined,
      })
      .then((r) => r.data),

  paged: (page = 1, pageSize = 50, term?: string) =>
    apiClient
      .get<PaginatedList<CustomerDto>>("/api/customers/paged", {
        params: { page, pageSize, ...(term ? { term } : {}) },
      })
      .then((r) => r.data),

  create: (payload: CreateCustomerRequest) =>
    apiClient.post<CustomerDto>("/api/customers", payload).then((r) => r.data),

  byId: (id: string) =>
    apiClient.get<CustomerDto>(`/api/customers/by-id/${id}`).then((r) => r.data),

  byPhone: (phone: string) =>
    apiClient
      .get<CustomerDto>(`/api/customers/${encodeURIComponent(phone)}`)
      .then((r) => r.data),

  update: (id: string, payload: Omit<UpdateCustomerRequest, "id">) =>
    apiClient
      .put<CustomerDto>(`/api/customers/${id}`, { ...payload, id } satisfies UpdateCustomerRequest)
      .then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<void>(`/api/customers/${id}`).then((r) => r.data),

  adjustLoyaltyPoints: (id: string, delta: number, notes: string | null = null) =>
    apiClient
      .post<CustomerDto>(`/api/customers/${id}/loyalty`, {
        customerId: id,
        delta,
        notes,
      } satisfies AdjustLoyaltyPointsRequest)
      .then((r) => r.data),

  orders: (id: string, page = 1, pageSize = 50) =>
    apiClient
      .get<PaginatedList<OrderDto>>(`/api/customers/${id}/orders`, {
        params: { page, pageSize },
      })
      .then((r) => r.data),
};
